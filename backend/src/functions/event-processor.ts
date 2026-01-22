import { EventBridgeEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { Event, validateEvent, IoTSensorEvent, EventMetadata } from '../schemas/event';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});
const eventBridgeClient = new EventBridgeClient({});

const EVENTS_TABLE = process.env.EVENTS_TABLE!;
const DEVICES_TABLE = process.env.DEVICES_TABLE!;
const EVENT_BUCKET = process.env.EVENT_BUCKET!;
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME!;
const ENVIRONMENT = process.env.ENVIRONMENT!;
const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID || 'soumithmadadi';

interface EventProcessorEvent {
  source: string;
  detailType: string;
  detail: Event;
  time: string;
  id: string;
}

interface EventProcessorResponse {
  success: boolean;
  eventId: string;
  timestamp: number;
  errors?: string[];
}

export const handler = async (
  event: EventBridgeEvent<string, EventProcessorEvent>
): Promise<EventProcessorResponse> => {
  console.log('Event processor received event - V2:', JSON.stringify(event, null, 2));

  const errors: string[] = [];
  const eventId = event.detail.id;
  const timestamp = Date.now();

  try {
    const validatedEvent = validateEvent(event.detail);
    console.log('Validated event:', JSON.stringify(validatedEvent, null, 2));

    await storeEventInDynamoDB(validatedEvent);

    await storeEventInS3(validatedEvent);

    // Update device status if this is an IoT sensor event
    if (validatedEvent.source === 'iot_sensors' && validatedEvent.type === 'sensor_reading') {
      await updateDeviceStatus(validatedEvent as IoTSensorEvent);
    }

    await emitProcessedEvent(validatedEvent);

    console.log(`Successfully processed event ${eventId}`);

    return {
      success: true,
      eventId,
      timestamp,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error processing event ${eventId}:`, errorMessage);
    errors.push(errorMessage);

    await emitErrorEvent(event.detail as unknown as Event, errorMessage);

    return {
      success: false,
      eventId,
      timestamp,
      errors,
    };
  }
};

async function storeEventInDynamoDB(event: Event): Promise<void> {
  const ttl = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);

  // Extract deviceId from IoT events for GSI
  let deviceId: string | undefined;
  if (event.source === 'iot_sensors' && event.type === 'sensor_reading') {
    const sensorEvent = event as IoTSensorEvent;
    deviceId = sensorEvent.data.deviceId;
  }

  // Extract userId from event metadata, fallback to DEFAULT_USER_ID
  const userId = event.metadata?.userId || DEFAULT_USER_ID;
  
  // Ensure metadata exists and add userId
  const metadata: EventMetadata = {
    version: event.metadata?.version || '1.0.0',
    tags: event.metadata?.tags,
    priority: event.metadata?.priority,
    correlationId: event.metadata?.correlationId,
    userId: userId,
  };

  const item: any = {
    id: event.id,
    timestamp: event.timestamp,
    source: event.source,
    type: event.type,
    data: event.data,
    metadata: metadata,
    userId: userId, // Add userId as top-level attribute for easier querying (from event.metadata.userId)
    ttl,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Add deviceId for GSI if available
  if (deviceId) {
    item.deviceId = deviceId;
  }

  const command = new PutCommand({
    TableName: EVENTS_TABLE,
    Item: item,
    ConditionExpression: 'attribute_not_exists(id)',
  });

  try {
    await docClient.send(command);
    console.log(`Stored event ${event.id} in DynamoDB`);
  } catch (error) {
    if (error instanceof Error && error.name === 'ConditionalCheckFailedException') {
      console.log(`Event ${event.id} already exists in DynamoDB (idempotency)`);
      return;
    }
    throw error;
  }
}

async function updateDeviceStatus(event: IoTSensorEvent): Promise<void> {
  const deviceId = event.data.deviceId;
  if (!deviceId) {
    return;
  }

  try {
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    // Update last seen timestamp
    updateExpressions.push('#lastSeen = :lastSeen');
    expressionAttributeNames['#lastSeen'] = 'lastSeen';
    expressionAttributeValues[':lastSeen'] = Date.now();

    // Update status to online if device is sending data
    updateExpressions.push('#status = :status');
    expressionAttributeNames['#status'] = 'status';
    expressionAttributeValues[':status'] = 'active';

    // Update battery level if provided
    if (event.data.batteryLevel !== undefined) {
      updateExpressions.push('#batteryLevel = :batteryLevel');
      expressionAttributeNames['#batteryLevel'] = 'batteryLevel';
      expressionAttributeValues[':batteryLevel'] = event.data.batteryLevel;
    }

    // Update signal strength if provided
    if (event.data.signalStrength !== undefined) {
      updateExpressions.push('#signalStrength = :signalStrength');
      expressionAttributeNames['#signalStrength'] = 'signalStrength';
      expressionAttributeValues[':signalStrength'] = event.data.signalStrength;
    }

    const command = new UpdateCommand({
      TableName: DEVICES_TABLE,
      Key: { deviceId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    });

    await docClient.send(command);
    console.log(`Updated device status for ${deviceId}`);
  } catch (error) {
    // Don't fail event processing if device update fails
    console.error(`Failed to update device status for ${deviceId}:`, error);
  }
}

async function storeEventInS3(event: Event): Promise<void> {
  const date = new Date(event.timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');

  const key = `events/${year}/${month}/${day}/${hour}/${event.id}.json`;

  const command = new PutObjectCommand({
    Bucket: EVENT_BUCKET,
    Key: key,
    Body: JSON.stringify(event, null, 2),
    ContentType: 'application/json',
    Metadata: {
      'event-id': event.id,
      'event-source': event.source,
      'event-type': event.type,
      'timestamp': event.timestamp.toString(),
    },
  });

  await s3Client.send(command);
  console.log(`Stored event ${event.id} in S3: ${key}`);
}

async function emitProcessedEvent(event: Event): Promise<void> {
  const processedEvent = {
    Source: 'event-processor',
    DetailType: 'event.processed',
    Detail: JSON.stringify({
      originalEvent: event,
      processedAt: Date.now(),
      environment: ENVIRONMENT,
    }),
    EventBusName: EVENT_BUS_NAME,
  };

  const command = new PutEventsCommand({
    Entries: [processedEvent],
  });

  await eventBridgeClient.send(command);
  console.log(`Emitted processed event for ${event.id}`);
}

async function emitErrorEvent(originalEvent: Event, errorMessage: string): Promise<void> {
  const errorEvent = {
    Source: 'event-processor',
    DetailType: 'event.processing.error',
    Detail: JSON.stringify({
      originalEvent,
      error: errorMessage,
      errorAt: Date.now(),
      environment: ENVIRONMENT,
    }),
    EventBusName: EVENT_BUS_NAME,
  };

  const command = new PutEventsCommand({
    Entries: [errorEvent],
  });

  await eventBridgeClient.send(command);
  console.log(`Emitted error event for ${originalEvent.id}`);
}

export async function queryEvents(
  source?: string,
  type?: string,
  startTime?: number,
  endTime?: number,
  limit: number = 100
): Promise<Event[]> {
  let queryParams: any = {
    TableName: EVENTS_TABLE,
    Limit: limit,
    ScanIndexForward: false,
  };

  if (source) {
    queryParams.IndexName = 'SourceTimestampIndex';
    queryParams.KeyConditionExpression = '#source = :source';
    queryParams.ExpressionAttributeNames = { '#source': 'source' };
    queryParams.ExpressionAttributeValues = { ':source': source };
  } else if (type) {
    queryParams.IndexName = 'TypeTimestampIndex';
    queryParams.KeyConditionExpression = '#type = :type';
    queryParams.ExpressionAttributeNames = { '#type': 'type' };
    queryParams.ExpressionAttributeValues = { ':type': type };
  } else {
    queryParams.KeyConditionExpression = '#timestamp BETWEEN :startTime AND :endTime';
    queryParams.ExpressionAttributeNames = { '#timestamp': 'timestamp' };
    queryParams.ExpressionAttributeValues = {
      ':startTime': startTime || 0,
      ':endTime': endTime || Date.now(),
    };
  }

  const command = new QueryCommand(queryParams);
  const response = await docClient.send(command);

  return (response.Items || []).map(item => ({
    id: item.id,
    timestamp: item.timestamp,
    source: item.source,
    type: item.type,
    data: item.data,
    metadata: item.metadata,
  })) as Event[];
}
