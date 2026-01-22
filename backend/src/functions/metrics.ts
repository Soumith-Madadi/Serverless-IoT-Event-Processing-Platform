import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const TEST_USER_ID = 'soumithmadadi'; // For testing: route all requests to this account

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('Metrics handler received event:', JSON.stringify(event, null, 2));

  try {
    const tableName = process.env.EVENTS_TABLE;
    if (!tableName) {
      throw new Error('EVENTS_TABLE environment variable not set');
    }

    // For testing: always use soumithmadadi account
    const userId = TEST_USER_ID;

    const now = Date.now();
    const fifteenMinutesAgo = now - (15 * 60 * 1000);
    const oneHourAgo = now - (60 * 60 * 1000);
    const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);

    const totalScan = await docClient.send(new ScanCommand({
      TableName: tableName,
      FilterExpression: '#userId = :userId',
      ExpressionAttributeNames: {
        '#userId': 'userId',
      },
      ExpressionAttributeValues: {
        ':userId': userId,
      },
      Select: 'COUNT',
    }));

    const recentEvents = await docClient.send(new QueryCommand({
      TableName: tableName,
      IndexName: 'SourceTimestampIndex',
      KeyConditionExpression: '#source = :source AND #timestamp >= :timestamp',
      FilterExpression: '#userId = :userId',
      ExpressionAttributeNames: {
        '#source': 'source',
        '#timestamp': 'timestamp',
        '#userId': 'userId',
      },
      ExpressionAttributeValues: {
        ':source': 'iot_sensors',
        ':timestamp': fifteenMinutesAgo,
        ':userId': userId,
      },
      Select: 'COUNT',
    }));

    const iotEventsLastHour = await docClient.send(new QueryCommand({
      TableName: tableName,
      IndexName: 'SourceTimestampIndex',
      KeyConditionExpression: '#source = :source AND #timestamp >= :timestamp',
      FilterExpression: '#userId = :userId',
      ExpressionAttributeNames: {
        '#source': 'source',
        '#timestamp': 'timestamp',
        '#userId': 'userId',
      },
      ExpressionAttributeValues: {
        ':source': 'iot_sensors',
        ':timestamp': oneHourAgo,
        ':userId': userId,
      },
      Select: 'COUNT',
    }));

    const stockEventsLastHour = await docClient.send(new QueryCommand({
      TableName: tableName,
      IndexName: 'SourceTimestampIndex',
      KeyConditionExpression: '#source = :source AND #timestamp >= :timestamp',
      FilterExpression: '#userId = :userId',
      ExpressionAttributeNames: {
        '#source': 'source',
        '#timestamp': 'timestamp',
        '#userId': 'userId',
      },
      ExpressionAttributeValues: {
        ':source': 'stock_market',
        ':timestamp': oneHourAgo,
        ':userId': userId,
      },
      Select: 'COUNT',
    }));

    const sensorReadings = await docClient.send(new QueryCommand({
      TableName: tableName,
      IndexName: 'TypeTimestampIndex',
      KeyConditionExpression: '#type = :type AND #timestamp >= :timestamp',
      FilterExpression: '#userId = :userId',
      ExpressionAttributeNames: {
        '#type': 'type',
        '#timestamp': 'timestamp',
        '#userId': 'userId',
      },
      ExpressionAttributeValues: {
        ':type': 'sensor_reading',
        ':timestamp': oneHourAgo,
        ':userId': userId,
      },
      Select: 'COUNT',
    }));

    const priceUpdates = await docClient.send(new QueryCommand({
      TableName: tableName,
      IndexName: 'TypeTimestampIndex',
      KeyConditionExpression: '#type = :type AND #timestamp >= :timestamp',
      FilterExpression: '#userId = :userId',
      ExpressionAttributeNames: {
        '#type': 'type',
        '#timestamp': 'timestamp',
        '#userId': 'userId',
      },
      ExpressionAttributeValues: {
        ':type': 'stock_price',
        ':timestamp': oneHourAgo,
        ':userId': userId,
      },
      Select: 'COUNT',
    }));

    const metrics = {
      totalEvents: totalScan.Count || 0,
      recentEvents: recentEvents.Count || 0,
      lastHour: {
        iotSensors: iotEventsLastHour.Count || 0,
        stockMarket: stockEventsLastHour.Count || 0,
        sensorReadings: sensorReadings.Count || 0,
        priceUpdates: priceUpdates.Count || 0,
      },
      timeWindows: {
        fifteenMinutes: fifteenMinutesAgo,
        oneHour: oneHourAgo,
        twentyFourHours: twentyFourHoursAgo,
        currentTime: now,
      },
      sources: ['iot_sensors', 'stock_market'],
      eventTypes: ['sensor_reading', 'stock_price'],
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
      body: JSON.stringify(metrics),
    };

  } catch (error) {
    console.error('Error in metrics handler:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
