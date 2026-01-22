import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { validateDeviceCommand, createDeviceCommand, DeviceCommand } from '../schemas/device';
import { createEvent, DeviceCommandEvent } from '../schemas/event';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const eventBridgeClient = new EventBridgeClient({});

const DEVICES_TABLE = process.env.DEVICES_TABLE!;
const COMMANDS_TABLE = process.env.COMMANDS_TABLE!;
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME!;

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('Command handler received event:', JSON.stringify(event, null, 2));

  const { httpMethod, pathParameters, body, requestContext } = event;
  const deviceId = pathParameters?.deviceId;
  const userId = requestContext.authorizer?.userId || requestContext.identity?.userArn;

  // Handle OPTIONS request for CORS preflight
  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: '',
    };
  }

  try {
    switch (httpMethod) {
      case 'POST':
        if (!deviceId) {
          return { 
            statusCode: 400, 
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: 'Device ID is required' }) 
          };
        }
        return await sendCommand(deviceId, body, userId);
      
      case 'GET':
        if (!deviceId) {
          return { 
            statusCode: 400, 
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: 'Device ID is required' }) 
          };
        }
        return await getCommandHistory(deviceId, userId);
      
      default:
        return { 
          statusCode: 405, 
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: 'Method not allowed' }) 
        };
    }
  } catch (error) {
    console.error('Error in command handler:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Internal server error', message: errorMessage }),
    };
  }
};

async function sendCommand(deviceId: string, body: string | null, userId?: string): Promise<APIGatewayProxyResult> {
  if (!body) {
    return { 
      statusCode: 400, 
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Request body is required' }) 
    };
  }

  const commandData = JSON.parse(body);
  const { commandType, commandName, parameters } = commandData;

  if (!commandType || !commandName) {
    return { 
      statusCode: 400, 
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'commandType and commandName are required' }) 
    };
  }

  // Verify device exists and get capabilities
  const getDeviceCommand = new GetCommand({
    TableName: DEVICES_TABLE,
    Key: { deviceId },
  });

  const deviceResult = await docClient.send(getDeviceCommand);
  if (!deviceResult.Item) {
    return { 
      statusCode: 404, 
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Device not found' }) 
    };
  }

  const device = deviceResult.Item as any;
  
  // Validate command against device capabilities
  if (device.capabilities?.commands && !device.capabilities.commands.includes(commandName)) {
    return { 
      statusCode: 400, 
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: `Device does not support command: ${commandName}` }) 
    };
  }

  // Create command record
  const command = createDeviceCommand(deviceId, commandType, commandName, {
    parameters,
    userId,
  });

  // Store command in DynamoDB
  const putCommand = new PutCommand({
    TableName: COMMANDS_TABLE,
    Item: command,
  });

  await docClient.send(putCommand);

  // Publish command event to EventBridge
  const commandEvent = createEvent(
    'iot_sensors',
    'device_command',
    {
      commandId: command.commandId,
      deviceId: command.deviceId,
      commandType: command.commandType,
      commandName: command.commandName,
      parameters: command.parameters,
      status: command.status,
    },
    {
      correlationId: command.correlationId,
      userId: command.userId,
    }
  );

  const eventBridgeCommand = new PutEventsCommand({
    Entries: [{
      Source: 'iot_sensors',
      DetailType: 'device.command',
      Detail: JSON.stringify(commandEvent),
      EventBusName: EVENT_BUS_NAME,
    }],
  });

  await eventBridgeClient.send(eventBridgeCommand);

  // Update command status to 'sent'
  const updateCommand = new UpdateCommand({
    TableName: COMMANDS_TABLE,
    Key: { commandId: command.commandId },
    UpdateExpression: 'SET #status = :status, #sentAt = :sentAt',
    ExpressionAttributeNames: {
      '#status': 'status',
      '#sentAt': 'sentAt',
    },
    ExpressionAttributeValues: {
      ':status': 'sent',
      ':sentAt': Date.now(),
    },
  });

  await docClient.send(updateCommand);

  return {
    statusCode: 201,
    headers: CORS_HEADERS,
    body: JSON.stringify({ message: 'Command sent successfully', command }),
  };
}

async function getCommandHistory(deviceId: string, userId?: string): Promise<APIGatewayProxyResult> {
  const command = new QueryCommand({
    TableName: COMMANDS_TABLE,
    IndexName: 'DeviceIndex',
    KeyConditionExpression: 'deviceId = :deviceId',
    ExpressionAttributeValues: {
      ':deviceId': deviceId,
    },
    ScanIndexForward: false, // Most recent first
    Limit: 100,
  });

  const result = await docClient.send(command);
  const commands = (result.Items || []) as DeviceCommand[];

  // Filter by userId if provided
  const filteredCommands = userId 
    ? commands.filter(cmd => cmd.userId === userId)
    : commands;

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({ commands: filteredCommands }),
  };
}
