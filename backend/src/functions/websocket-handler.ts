import { APIGatewayProxyEvent, APIGatewayProxyResult, APIGatewayProxyWebsocketEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { Event, EventFilters, ReplayConfig } from '../schemas/event';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const eventBridgeClient = new EventBridgeClient({});

const EVENTS_TABLE = process.env.EVENTS_TABLE!;
const DEVICES_TABLE = process.env.DEVICES_TABLE!;
const COMMANDS_TABLE = process.env.COMMANDS_TABLE!;
const ALERTS_TABLE = process.env.ALERTS_TABLE!;
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME!;
const ENVIRONMENT = process.env.ENVIRONMENT!;
const TEST_USER_ID = 'soumithmadadi'; // For testing: route all requests to this account

interface WebSocketMessage {
  action: string;
  data?: any;
  requestId?: string;
}

interface WebSocketResponse {
  action: string;
  data?: any;
  error?: string;
  requestId?: string;
  timestamp: number;
}

interface ConnectionInfo {
  connectionId: string;
  userId?: string;
  subscriptions: string[];
  deviceSubscriptions: string[]; // Device IDs
  alertSubscriptions: boolean; // Subscribe to all alerts
  replayConfig?: ReplayConfig;
  lastActivity: number;
}

const connections = new Map<string, ConnectionInfo>();

export const handler = async (
  event: APIGatewayProxyWebsocketEventV2
): Promise<APIGatewayProxyResultV2> => {
  console.log('WebSocket handler received event:', JSON.stringify(event, null, 2));

  const { routeKey, connectionId } = event.requestContext;
  const body = event.body;
  const endpoint = `https://${event.requestContext.domainName}/${event.requestContext.stage}`;
  const apiGateway = new ApiGatewayManagementApiClient({ endpoint });

  try {
    switch (routeKey) {
      case '$connect':
        return await handleConnect(connectionId, event);
      
      case '$disconnect':
        return await handleDisconnect(connectionId);
      
      case '$default':
        return await handleMessage(connectionId, body || null, apiGateway);
      
      default:
        console.log(`Unknown route key: ${routeKey}`);
        return { statusCode: 400, body: 'Unknown route' };
    }
  } catch (error) {
    console.error('WebSocket handler error:', error);
    return { statusCode: 500, body: 'Internal server error' };
  }
};

async function handleConnect(connectionId: string, event: APIGatewayProxyWebsocketEventV2): Promise<APIGatewayProxyResultV2> {
  console.log(`Client connected: ${connectionId}`);
  
  connections.set(connectionId, {
    connectionId,
    userId: undefined,
    subscriptions: [],
    deviceSubscriptions: [],
    alertSubscriptions: false,
    lastActivity: Date.now(),
  });

  await emitConnectionEvent(connectionId, 'connected');

  return { statusCode: 200, body: 'Connected' };
}

async function handleDisconnect(connectionId: string): Promise<APIGatewayProxyResult> {
  console.log(`Client disconnected: ${connectionId}`);
  
  connections.delete(connectionId);

  await emitConnectionEvent(connectionId, 'disconnected');

  return { statusCode: 200, body: 'Disconnected' };
}

async function handleMessage(
  connectionId: string,
  body: string | null,
  apiGateway: ApiGatewayManagementApiClient
): Promise<APIGatewayProxyResult> {
  if (!body) {
    return { statusCode: 400, body: 'No message body' };
  }

  try {
    const message: WebSocketMessage = JSON.parse(body);
    console.log(`Received message from ${connectionId}:`, message);

    const response: WebSocketResponse = {
      action: message.action,
      requestId: message.requestId,
      timestamp: Date.now(),
    };

    switch (message.action) {
      case 'subscribe':
        await handleSubscribe(connectionId, message.data, response);
        break;
      
      case 'unsubscribe':
        await handleUnsubscribe(connectionId, message.data, response);
        break;
      
      case 'subscribe_devices':
        await handleSubscribeDevices(connectionId, message.data, response);
        break;
      
      case 'unsubscribe_devices':
        await handleUnsubscribeDevices(connectionId, message.data, response);
        break;
      
      case 'subscribe_alerts':
        await handleSubscribeAlerts(connectionId, message.data, response);
        break;
      
      case 'unsubscribe_alerts':
        await handleUnsubscribeAlerts(connectionId, response);
        break;
      
      case 'query_events':
        await handleQueryEvents(connectionId, message.data, response);
        break;
      
      case 'start_replay':
        await handleStartReplay(connectionId, message.data, response);
        break;
      
      case 'stop_replay':
        await handleStopReplay(connectionId, response);
        break;
      
      case 'ping':
        response.data = { pong: true };
        break;
      
      default:
        response.error = `Unknown action: ${message.action}`;
    }

    await sendToConnection(apiGateway, connectionId, response);

    return { statusCode: 200, body: 'Message processed' };

  } catch (error) {
    console.error(`Error processing message from ${connectionId}:`, error);
    
    const errorResponse: WebSocketResponse = {
      action: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now(),
    };

    await sendToConnection(apiGateway, connectionId, errorResponse);
    return { statusCode: 200, body: 'Error processed' };
  }
}

async function handleSubscribe(
  connectionId: string,
  data: any,
  response: WebSocketResponse
): Promise<void> {
  const connection = connections.get(connectionId);
  if (!connection) {
    response.error = 'Connection not found';
    return;
  }

  const { sources, types } = data || {};
  
  if (sources && Array.isArray(sources)) {
    connection.subscriptions.push(...sources);
  }
  
  if (types && Array.isArray(types)) {
    connection.subscriptions.push(...types);
  }

  connection.subscriptions = [...new Set(connection.subscriptions)];
  connection.lastActivity = Date.now();

  response.data = {
    subscribed: connection.subscriptions,
    message: 'Successfully subscribed to events',
  };

  console.log(`Client ${connectionId} subscribed to:`, connection.subscriptions);
}

async function handleUnsubscribe(
  connectionId: string,
  data: any,
  response: WebSocketResponse
): Promise<void> {
  const connection = connections.get(connectionId);
  if (!connection) {
    response.error = 'Connection not found';
    return;
  }

  const { sources, types } = data || {};
  const toUnsubscribe = [...(sources || []), ...(types || [])];

  connection.subscriptions = connection.subscriptions.filter(
    sub => !toUnsubscribe.includes(sub)
  );
  connection.lastActivity = Date.now();

  response.data = {
    subscribed: connection.subscriptions,
    message: 'Successfully unsubscribed from events',
  };

  console.log(`Client ${connectionId} unsubscribed from:`, toUnsubscribe);
}

async function handleSubscribeDevices(
  connectionId: string,
  data: any,
  response: WebSocketResponse
): Promise<void> {
  const connection = connections.get(connectionId);
  if (!connection) {
    response.error = 'Connection not found';
    return;
  }

  const { deviceIds } = data || {};
  
  if (deviceIds && Array.isArray(deviceIds)) {
    connection.deviceSubscriptions.push(...deviceIds);
    connection.deviceSubscriptions = [...new Set(connection.deviceSubscriptions)];
  }

  connection.lastActivity = Date.now();

  response.data = {
    subscribedDevices: connection.deviceSubscriptions,
    message: 'Successfully subscribed to devices',
  };

  console.log(`Client ${connectionId} subscribed to devices:`, connection.deviceSubscriptions);
}

async function handleUnsubscribeDevices(
  connectionId: string,
  data: any,
  response: WebSocketResponse
): Promise<void> {
  const connection = connections.get(connectionId);
  if (!connection) {
    response.error = 'Connection not found';
    return;
  }

  const { deviceIds } = data || {};
  
  if (deviceIds && Array.isArray(deviceIds)) {
    connection.deviceSubscriptions = connection.deviceSubscriptions.filter(
      id => !deviceIds.includes(id)
    );
  } else {
    // Unsubscribe from all devices
    connection.deviceSubscriptions = [];
  }

  connection.lastActivity = Date.now();

  response.data = {
    subscribedDevices: connection.deviceSubscriptions,
    message: 'Successfully unsubscribed from devices',
  };

  console.log(`Client ${connectionId} unsubscribed from devices:`, deviceIds || 'all');
}

async function handleSubscribeAlerts(
  connectionId: string,
  data: any,
  response: WebSocketResponse
): Promise<void> {
  const connection = connections.get(connectionId);
  if (!connection) {
    response.error = 'Connection not found';
    return;
  }

  connection.alertSubscriptions = true;
  connection.lastActivity = Date.now();

  response.data = {
    subscribed: true,
    message: 'Successfully subscribed to alerts',
  };

  console.log(`Client ${connectionId} subscribed to alerts`);
}

async function handleUnsubscribeAlerts(
  connectionId: string,
  response: WebSocketResponse
): Promise<void> {
  const connection = connections.get(connectionId);
  if (!connection) {
    response.error = 'Connection not found';
    return;
  }

  connection.alertSubscriptions = false;
  connection.lastActivity = Date.now();

  response.data = {
    subscribed: false,
    message: 'Successfully unsubscribed from alerts',
  };

  console.log(`Client ${connectionId} unsubscribed from alerts`);
}

async function handleQueryEvents(
  connectionId: string,
  filters: EventFilters,
  response: WebSocketResponse
): Promise<void> {
  try {
    const events = await queryEventsFromDynamoDB(filters);
    response.data = {
      events,
      count: events.length,
      filters,
    };
  } catch (error) {
    response.error = `Failed to query events: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

async function handleStartReplay(
  connectionId: string,
  config: ReplayConfig,
  response: WebSocketResponse
): Promise<void> {
  const connection = connections.get(connectionId);
  if (!connection) {
    response.error = 'Connection not found';
    return;
  }

  connection.replayConfig = config;
  connection.lastActivity = Date.now();

  startReplay(connectionId, config).catch(error => {
    console.error(`Replay error for ${connectionId}:`, error);
  });

  response.data = {
    message: 'Replay started',
    config,
  };
}

async function handleStopReplay(
  connectionId: string,
  response: WebSocketResponse
): Promise<void> {
  const connection = connections.get(connectionId);
  if (!connection) {
    response.error = 'Connection not found';
    return;
  }

  connection.replayConfig = undefined;
  connection.lastActivity = Date.now();

  response.data = {
    message: 'Replay stopped',
  };
}

async function queryEventsFromDynamoDB(filters: EventFilters): Promise<Event[]> {
  const { sources, types, startTime, endTime, limit = 100 } = filters;
  
  // For testing: always use soumithmadadi account
  const userId = TEST_USER_ID;

  let queryParams: any = {
    TableName: EVENTS_TABLE,
    Limit: limit,
    ScanIndexForward: false,
  };

  if (sources && sources.length > 0) {
    const sourceQueries = await Promise.all(
      sources.map(source => {
        const params: any = {
          ...queryParams,
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
        };
        
        if (startTime && endTime) {
          params.KeyConditionExpression += ' AND #timestamp BETWEEN :startTime AND :endTime';
          params.ExpressionAttributeNames['#timestamp'] = 'timestamp';
          params.ExpressionAttributeValues[':startTime'] = startTime;
          params.ExpressionAttributeValues[':endTime'] = endTime;
        }
        
        return docClient.send(new QueryCommand(params));
      })
    );

    const allItems = sourceQueries.flatMap(response => response.Items || []);
    return allItems.map(item => ({
      id: item.id,
      timestamp: item.timestamp,
      source: item.source,
      type: item.type,
      data: item.data,
      metadata: item.metadata,
    })) as Event[];
  }

  if (types && types.length > 0) {

    const typeQueries = await Promise.all(
      types.map(type => {
        const params: any = {
          ...queryParams,
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
        };
        
        if (startTime && endTime) {
          params.KeyConditionExpression += ' AND #timestamp BETWEEN :startTime AND :endTime';
          params.ExpressionAttributeNames['#timestamp'] = 'timestamp';
          params.ExpressionAttributeValues[':startTime'] = startTime;
          params.ExpressionAttributeValues[':endTime'] = endTime;
        }
        
        return docClient.send(new QueryCommand(params));
      })
    );

    const allItems = typeQueries.flatMap(response => response.Items || []);
    return allItems.map(item => ({
      id: item.id,
      timestamp: item.timestamp,
      source: item.source,
      type: item.type,
      data: item.data,
      metadata: item.metadata,
    })) as Event[];
  }

  const scanParams: any = {
    TableName: EVENTS_TABLE,
    Limit: limit,
    FilterExpression: '#userId = :userId',
    ExpressionAttributeNames: {
      '#userId': 'userId',
    },
    ExpressionAttributeValues: {
      ':userId': userId,
    },
  };

  if (startTime || endTime) {
    const timeFilters: string[] = ['#userId = :userId'];
    scanParams.ExpressionAttributeNames = {
      '#userId': 'userId',
    };
    scanParams.ExpressionAttributeValues = {
      ':userId': userId,
    };

    if (startTime) {
      timeFilters.push('#timestamp >= :startTime');
      scanParams.ExpressionAttributeNames['#timestamp'] = 'timestamp';
      scanParams.ExpressionAttributeValues[':startTime'] = startTime;
    }

    if (endTime) {
      timeFilters.push('#timestamp <= :endTime');
      scanParams.ExpressionAttributeNames['#timestamp'] = 'timestamp';
      scanParams.ExpressionAttributeValues[':endTime'] = endTime;
    }

    scanParams.FilterExpression = timeFilters.join(' AND ');
  }

  const response = await docClient.send(new ScanCommand(scanParams));
  
  return (response.Items || []).map(item => ({
    id: item.id,
    timestamp: item.timestamp,
    source: item.source,
    type: item.type,
    data: item.data,
    metadata: item.metadata,
  })) as Event[];
}

async function startReplay(connectionId: string, config: ReplayConfig): Promise<void> {
  const { startTime, endTime, speed, filters } = config;
  
  const events = await queryEventsFromDynamoDB({
    ...filters,
    startTime,
    endTime,
    limit: 1000,
  });

  events.sort((a, b) => a.timestamp - b.timestamp);

  const delayBetweenEvents = 1000 / speed;

  for (const event of events) {
    const connection = connections.get(connectionId);
    if (!connection || !connection.replayConfig) {
      break;
    }

    const endpoint = `https://${process.env.API_GATEWAY_DOMAIN}/${process.env.STAGE}`;
    const apiGateway = new ApiGatewayManagementApiClient({ endpoint });

    const replayMessage: WebSocketResponse = {
      action: 'replay_event',
      data: event,
      timestamp: Date.now(),
    };

    await sendToConnection(apiGateway, connectionId, replayMessage);
    
    await new Promise(resolve => setTimeout(resolve, delayBetweenEvents));
  }
}

async function sendToConnection(
  apiGateway: ApiGatewayManagementApiClient,
  connectionId: string,
  message: WebSocketResponse
): Promise<void> {
  try {
    const command = new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify(message),
    });

    await apiGateway.send(command);
  } catch (error) {
    console.error(`Failed to send message to ${connectionId}:`, error);
    connections.delete(connectionId);
  }
}

async function emitConnectionEvent(connectionId: string, status: 'connected' | 'disconnected'): Promise<void> {
  const event = {
    Source: 'websocket-handler',
    DetailType: `connection.${status}`,
    Detail: JSON.stringify({
      connectionId,
      timestamp: Date.now(),
      environment: ENVIRONMENT,
    }),
    EventBusName: EVENT_BUS_NAME,
  };

  const command = new PutEventsCommand({
    Entries: [event],
  });

  await eventBridgeClient.send(command);
}

export async function broadcastEvent(event: Event): Promise<void> {
  const endpoint = `https://${process.env.API_GATEWAY_DOMAIN}/${process.env.STAGE}`;
  const apiGateway = new ApiGatewayManagementApiClient({ endpoint });

  const message: WebSocketResponse = {
    action: 'event',
    data: event,
    timestamp: Date.now(),
  };

  const broadcastPromises = Array.from(connections.keys()).map(connectionId =>
    sendToConnection(apiGateway, connectionId, message)
  );

  await Promise.allSettled(broadcastPromises);
}
