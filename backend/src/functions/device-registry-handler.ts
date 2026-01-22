import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { validateDevice, Device } from '../schemas/device';

const ALERTS_TABLE = process.env.ALERTS_TABLE || process.env.DEVICES_TABLE!;

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const DEVICES_TABLE = process.env.DEVICES_TABLE!;

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('Device registry handler received event:', JSON.stringify(event, null, 2));

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
      case 'GET':
        if (deviceId) {
          return await getDevice(deviceId);
        } else {
          return await listDevices(userId);
        }
      
      case 'POST':
        return await registerDevice(body, userId);
      
      case 'PUT':
        if (!deviceId) {
          return { 
            statusCode: 400, 
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: 'Device ID is required' }) 
          };
        }
        return await updateDevice(deviceId, body, userId);
      
      case 'DELETE':
        if (!deviceId) {
          return { 
            statusCode: 400, 
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: 'Device ID is required' }) 
          };
        }
        return await deactivateDevice(deviceId, userId);
      
      default:
        return { 
          statusCode: 405, 
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: 'Method not allowed' }) 
        };
    }
  } catch (error) {
    console.error('Error in device registry handler:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Internal server error', message: errorMessage }),
    };
  }
};

async function getDevice(deviceId: string): Promise<APIGatewayProxyResult> {
  const command = new GetCommand({
    TableName: DEVICES_TABLE,
    Key: { deviceId },
  });

  const result = await docClient.send(command);

  if (!result.Item) {
    return { 
      statusCode: 404, 
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Device not found' }) 
    };
  }

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(result.Item),
  };
}

async function listDevices(userId?: string): Promise<APIGatewayProxyResult> {
  let devices: Device[] = [];

  if (userId) {
    // Query by userId using GSI
    const command = new QueryCommand({
      TableName: DEVICES_TABLE,
      IndexName: 'OwnerIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
    });

    const result = await docClient.send(command);
    devices = (result.Items || []) as Device[];
  } else {
    // Scan all devices (admin only in production)
    const command = new ScanCommand({
      TableName: DEVICES_TABLE,
    });

    const result = await docClient.send(command);
    devices = (result.Items || []) as Device[];
  }

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({ devices }),
  };
}

async function registerDevice(body: string | null, userId?: string): Promise<APIGatewayProxyResult> {
  if (!body) {
    return { 
      statusCode: 400, 
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Request body is required' }) 
    };
  }

  const deviceData = JSON.parse(body);
  
  // Validate device data
  const device = validateDevice({
    ...deviceData,
    userId: userId || deviceData.userId,
    registrationDate: Date.now(),
  });

  const command = new PutCommand({
    TableName: DEVICES_TABLE,
    Item: device,
    ConditionExpression: 'attribute_not_exists(deviceId)',
  });

  try {
    await docClient.send(command);
    return {
      statusCode: 201,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Device registered successfully', device }),
    };
  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') {
      return { 
        statusCode: 409, 
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Device already exists' }) 
      };
    }
    throw error;
  }
}

async function updateDevice(deviceId: string, body: string | null, userId?: string): Promise<APIGatewayProxyResult> {
  if (!body) {
    return { 
      statusCode: 400, 
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Request body is required' }) 
    };
  }

  const updateData = JSON.parse(body);
  
  // Remove fields that shouldn't be updated
  delete updateData.deviceId;
  delete updateData.registrationDate;

  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};

  Object.keys(updateData).forEach((key, index) => {
    const attrName = `#attr${index}`;
    const attrValue = `:val${index}`;
    updateExpressions.push(`${attrName} = ${attrValue}`);
    expressionAttributeNames[attrName] = key;
    expressionAttributeValues[attrValue] = updateData[key];
  });

  // Add updatedAt timestamp
  updateExpressions.push('#updatedAt = :updatedAt');
  expressionAttributeNames['#updatedAt'] = 'updatedAt';
  expressionAttributeValues[':updatedAt'] = Date.now();

  const command = new UpdateCommand({
    TableName: DEVICES_TABLE,
    Key: { deviceId },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ConditionExpression: userId ? 'userId = :userId' : undefined,
    ReturnValues: 'ALL_NEW',
  });

  if (userId) {
    command.input.ExpressionAttributeValues![':userId'] = userId;
  }

  try {
    const result = await docClient.send(command);
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Device updated successfully', device: result.Attributes }),
    };
  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') {
      return { 
        statusCode: 403, 
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Device not found or access denied' }) 
      };
    }
    throw error;
  }
}

async function deactivateDevice(deviceId: string, userId?: string): Promise<APIGatewayProxyResult> {
  const command = new UpdateCommand({
    TableName: DEVICES_TABLE,
    Key: { deviceId },
    UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#status': 'status',
      '#updatedAt': 'updatedAt',
    },
    ExpressionAttributeValues: {
      ':status': 'inactive',
      ':updatedAt': Date.now(),
    },
    ConditionExpression: userId ? 'userId = :userId' : undefined,
    ReturnValues: 'ALL_NEW',
  });

  if (userId) {
    command.input.ExpressionAttributeValues![':userId'] = userId;
  }

  try {
    const result = await docClient.send(command);
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Device deactivated successfully', device: result.Attributes }),
    };
  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') {
      return { 
        statusCode: 403, 
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Device not found or access denied' }) 
      };
    }
    throw error;
  }
}
