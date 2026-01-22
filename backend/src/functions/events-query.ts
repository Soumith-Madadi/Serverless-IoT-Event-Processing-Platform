import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const EVENTS_TABLE = process.env.EVENTS_TABLE!;
const TEST_USER_ID = 'soumithmadadi'; // For testing: route all requests to this account

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('Events query handler received event:', JSON.stringify(event, null, 2));

  try {
    const queryParams = event.queryStringParameters || {};
    const source = queryParams.source;
    const type = queryParams.type;
    const limit = parseInt(queryParams.limit || '100', 10);
    const startTime = queryParams.startTime ? parseInt(queryParams.startTime, 10) : undefined;
    const endTime = queryParams.endTime ? parseInt(queryParams.endTime, 10) : undefined;

    // For testing: always use soumithmadadi account
    const userId = TEST_USER_ID;

    let events: any[] = [];

    // Query events filtered by userId
    if (source) {
      // Query by source and filter by userId
      const queryParams: any = {
        TableName: EVENTS_TABLE,
        IndexName: 'SourceTimestampIndex',
        KeyConditionExpression: '#source = :source',
        FilterExpression: '#userId = :userId',
        ExpressionAttributeNames: {
          '#source': 'source',
          '#userId': 'userId',
        },
        ExpressionAttributeValues: {
          ':source': source,
          ':userId': userId,
        },
        Limit: limit,
        ScanIndexForward: false,
      };

      if (startTime && endTime) {
        queryParams.KeyConditionExpression += ' AND #timestamp BETWEEN :startTime AND :endTime';
        queryParams.ExpressionAttributeNames['#timestamp'] = 'timestamp';
        queryParams.ExpressionAttributeValues[':startTime'] = startTime;
        queryParams.ExpressionAttributeValues[':endTime'] = endTime;
      } else if (startTime) {
        queryParams.KeyConditionExpression += ' AND #timestamp >= :startTime';
        queryParams.ExpressionAttributeNames['#timestamp'] = 'timestamp';
        queryParams.ExpressionAttributeValues[':startTime'] = startTime;
      }

      const response = await docClient.send(new QueryCommand(queryParams));
      events = (response.Items || []).map(item => ({
        id: item.id,
        timestamp: item.timestamp,
        source: item.source,
        type: item.type,
        data: item.data,
        metadata: item.metadata,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }));
    } else if (type) {
      // Query by type and filter by userId
      const queryParams: any = {
        TableName: EVENTS_TABLE,
        IndexName: 'TypeTimestampIndex',
        KeyConditionExpression: '#type = :type',
        FilterExpression: '#userId = :userId',
        ExpressionAttributeNames: {
          '#type': 'type',
          '#userId': 'userId',
        },
        ExpressionAttributeValues: {
          ':type': type,
          ':userId': userId,
        },
        Limit: limit,
        ScanIndexForward: false,
      };

      if (startTime && endTime) {
        queryParams.KeyConditionExpression += ' AND #timestamp BETWEEN :startTime AND :endTime';
        queryParams.ExpressionAttributeNames['#timestamp'] = 'timestamp';
        queryParams.ExpressionAttributeValues[':startTime'] = startTime;
        queryParams.ExpressionAttributeValues[':endTime'] = endTime;
      } else if (startTime) {
        queryParams.KeyConditionExpression += ' AND #timestamp >= :startTime';
        queryParams.ExpressionAttributeNames['#timestamp'] = 'timestamp';
        queryParams.ExpressionAttributeValues[':startTime'] = startTime;
      }

      const response = await docClient.send(new QueryCommand(queryParams));
      events = (response.Items || []).map(item => ({
        id: item.id,
        timestamp: item.timestamp,
        source: item.source,
        type: item.type,
        data: item.data,
        metadata: item.metadata,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }));
    } else {
      // Scan with userId filter
      const scanParams: any = {
        TableName: EVENTS_TABLE,
        FilterExpression: '#userId = :userId',
        ExpressionAttributeNames: {
          '#userId': 'userId',
        },
        ExpressionAttributeValues: {
          ':userId': userId,
        },
        Limit: limit,
      };

      if (startTime || endTime) {
        if (startTime && endTime) {
          scanParams.FilterExpression += ' AND #timestamp BETWEEN :startTime AND :endTime';
        } else if (startTime) {
          scanParams.FilterExpression += ' AND #timestamp >= :startTime';
        } else if (endTime) {
          scanParams.FilterExpression += ' AND #timestamp <= :endTime';
        }
        scanParams.ExpressionAttributeNames['#timestamp'] = 'timestamp';
        if (startTime) scanParams.ExpressionAttributeValues[':startTime'] = startTime;
        if (endTime) scanParams.ExpressionAttributeValues[':endTime'] = endTime;
      }

      const response = await docClient.send(new ScanCommand(scanParams));
      events = (response.Items || [])
        .sort((a, b) => b.timestamp - a.timestamp) // Sort by timestamp descending
        .slice(0, limit)
        .map(item => ({
          id: item.id,
          timestamp: item.timestamp,
          source: item.source,
          type: item.type,
          data: item.data,
          metadata: item.metadata,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        }));
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
      body: JSON.stringify({
        events,
        count: events.length,
        limit,
        filters: {
          source,
          type,
          startTime,
          endTime,
          userId,
        },
      }),
    };

  } catch (error) {
    console.error('Error in events query handler:', error);
    
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
