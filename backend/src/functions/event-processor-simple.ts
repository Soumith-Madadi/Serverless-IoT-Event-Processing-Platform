import { EventBridgeEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});
const eventBridgeClient = new EventBridgeClient({});

const EVENTS_TABLE = process.env.EVENTS_TABLE!;
const EVENT_BUCKET = process.env.EVENT_BUCKET!;
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME!;
const ENVIRONMENT = process.env.ENVIRONMENT!;

interface EventProcessorEvent {
  source: string;
  detailType: string;
  detail: {
    id: string;
    source: string;
    type: string;
    timestamp: number;
    data: any;
    metadata?: any;
  };
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
  event: EventBridgeEvent<string, any>
): Promise<EventProcessorResponse> => {
  console.log('Event processor received event - SIMPLE VERSION:', JSON.stringify(event, null, 2));

  const errors: string[] = [];
  const timestamp = Date.now();
  let eventData: any;

  try {
    // EventBridge sends detail as a JSON string, so we need to parse it
    const detail = typeof event.detail === 'string' ? JSON.parse(event.detail) : event.detail;
    eventData = detail;
    
    if (!eventData || !eventData.id || !eventData.source || !eventData.type) {
      throw new Error('Invalid event structure');
    }
    
    const eventId = eventData.id;

    await storeEventInDynamoDB(eventData);

    await storeEventInS3(eventData);

    await emitProcessedEvent(eventData);

    console.log(`Successfully processed event ${eventData.id}`);

    return {
      success: true,
      eventId: eventData.id,
      timestamp,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const eventId = eventData?.id || 'unknown';
    console.error(`Error processing event ${eventId}:`, errorMessage);
    errors.push(errorMessage);

    await emitErrorEvent(eventData, errorMessage);

    return {
      success: false,
      eventId: eventData?.id || 'unknown',
      timestamp,
      errors,
    };
  }
};

async function storeEventInDynamoDB(event: any): Promise<void> {
  const ttl = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);

  const item = {
    id: event.id,
    timestamp: event.timestamp,
    source: event.source,
    type: event.type,
    data: event.data,
    metadata: event.metadata || {},
    ttl,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const command = new PutCommand({
    TableName: EVENTS_TABLE,
    Item: item,
  });

  await docClient.send(command);
  console.log(`Event stored in DynamoDB: ${event.id}`);
}

async function storeEventInS3(event: any): Promise<void> {
  const key = `events/${event.source}/${event.type}/${event.id}.json`;
  
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
  console.log(`Event stored in S3: ${key}`);
}

async function emitProcessedEvent(event: any): Promise<void> {
  const command = new PutEventsCommand({
    Entries: [
      {
        Source: 'event-processor',
        DetailType: 'event.processed',
        Detail: JSON.stringify({
          originalEvent: event,
          processedAt: Date.now(),
          processor: 'event-processor-simple',
        }),
        EventBusName: EVENT_BUS_NAME,
      },
    ],
  });

  await eventBridgeClient.send(command);
  console.log(`Processed event emitted to EventBridge: ${event.id}`);
}

async function emitErrorEvent(event: any, errorMessage: string): Promise<void> {
  const command = new PutEventsCommand({
    Entries: [
      {
        Source: 'event-processor',
        DetailType: 'event.error',
        Detail: JSON.stringify({
          originalEvent: event,
          error: errorMessage,
          timestamp: Date.now(),
          processor: 'event-processor-simple',
        }),
        EventBusName: EVENT_BUS_NAME,
      },
    ],
  });

  await eventBridgeClient.send(command);
  console.log(`Error event emitted to EventBridge: ${event.id}`);
}
