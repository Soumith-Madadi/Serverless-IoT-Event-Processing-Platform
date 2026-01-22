import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { validateAlertRule, createAlertRule, AlertRule, AlertInstance } from '../schemas/alert';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const ALERTS_TABLE = process.env.ALERTS_TABLE!;
const ALERT_RULES_TABLE = process.env.ALERT_RULES_TABLE || ALERTS_TABLE;

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('Alert handler received event:', JSON.stringify(event, null, 2));

  const { httpMethod, path, pathParameters, body, requestContext } = event;
  const alertId = pathParameters?.alertId;
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
    // Handle /alerts/active endpoint
    if (path?.endsWith('/active') && httpMethod === 'GET') {
      return await getActiveAlerts(userId);
    }

    switch (httpMethod) {
      case 'GET':
        if (alertId) {
          return await getAlertRule(alertId);
        } else {
          return await listAlertRules(userId);
        }
      
      case 'POST':
        return await createAlertRuleHandler(body, userId);
      
      case 'PUT':
        if (!alertId) {
          return { 
            statusCode: 400, 
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: 'Alert ID is required' }) 
          };
        }
        return await updateAlertRule(alertId, body, userId);
      
      case 'DELETE':
        if (!alertId) {
          return { 
            statusCode: 400, 
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: 'Alert ID is required' }) 
          };
        }
        return await deleteAlertRule(alertId, userId);
      
      default:
        return { 
          statusCode: 405, 
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: 'Method not allowed' }) 
        };
    }
  } catch (error) {
    console.error('Error in alert handler:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Internal server error', message: errorMessage }),
    };
  }
};

async function getAlertRule(alertId: string): Promise<APIGatewayProxyResult> {
  const command = new GetCommand({
    TableName: ALERT_RULES_TABLE,
    Key: { alertId },
  });

  const result = await docClient.send(command);

  if (!result.Item) {
    return { 
      statusCode: 404, 
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Alert rule not found' }) 
    };
  }

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(result.Item),
  };
}

async function listAlertRules(userId?: string): Promise<APIGatewayProxyResult> {
  // Scan for alert rules (stored with alertId starting with 'rule_' or just all items)
  const command = new ScanCommand({
    TableName: ALERT_RULES_TABLE,
    FilterExpression: 'begins_with(alertId, :rulePrefix) OR attribute_not_exists(alertInstanceId)',
    ExpressionAttributeValues: {
      ':rulePrefix': 'rule_',
    },
  });

  const result = await docClient.send(command);
  let rules = (result.Items || []) as AlertRule[];

  // Filter by userId if provided
  if (userId) {
    rules = rules.filter(rule => !rule.userId || rule.userId === userId);
  }

  // Filter out alert instances (only return rules)
  rules = rules.filter(item => {
    // Alert rules have alertId but not alertInstanceId
    return !('alertInstanceId' in item);
  });

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({ rules }),
  };
}

async function createAlertRuleHandler(body: string | null, userId?: string): Promise<APIGatewayProxyResult> {
  if (!body) {
    return { 
      statusCode: 400, 
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Request body is required' }) 
    };
  }

  const ruleData = JSON.parse(body);
  
  // Create alert rule using schema helper
  const alertRule = createAlertRule(
    ruleData.name,
    ruleData.conditions,
    {
      description: ruleData.description,
      deviceId: ruleData.deviceId,
      severity: ruleData.severity,
      notificationChannels: ruleData.notificationChannels,
      emailRecipients: ruleData.emailRecipients,
      webhookUrl: ruleData.webhookUrl,
      cooldownPeriod: ruleData.cooldownPeriod,
      userId: userId || ruleData.userId,
    }
  );

  // Validate the rule
  const validatedRule = validateAlertRule(alertRule);

  const command = new PutCommand({
    TableName: ALERT_RULES_TABLE,
    Item: {
      ...validatedRule,
      // Store with alertId as partition key
      pk: validatedRule.alertId,
      sk: 'RULE',
    },
    ConditionExpression: 'attribute_not_exists(alertId)',
  });

  try {
    await docClient.send(command);
    return {
      statusCode: 201,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Alert rule created successfully', rule: validatedRule }),
    };
  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') {
      return { 
        statusCode: 409, 
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Alert rule already exists' }) 
      };
    }
    throw error;
  }
}

async function updateAlertRule(alertId: string, body: string | null, userId?: string): Promise<APIGatewayProxyResult> {
  if (!body) {
    return { 
      statusCode: 400, 
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Request body is required' }) 
    };
  }

  const updateData = JSON.parse(body);
  
  // Remove fields that shouldn't be updated
  delete updateData.alertId;
  delete updateData.createdAt;

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
    TableName: ALERT_RULES_TABLE,
    Key: { alertId },
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
      body: JSON.stringify({ message: 'Alert rule updated successfully', rule: result.Attributes }),
    };
  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') {
      return { 
        statusCode: 403, 
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Alert rule not found or access denied' }) 
      };
    }
    throw error;
  }
}

async function deleteAlertRule(alertId: string, userId?: string): Promise<APIGatewayProxyResult> {
  const command = new DeleteCommand({
    TableName: ALERT_RULES_TABLE,
    Key: { alertId },
    ConditionExpression: userId ? 'userId = :userId' : undefined,
    ReturnValues: 'ALL_OLD',
  });

  if (userId) {
    command.input.ExpressionAttributeValues = {
      ':userId': userId,
    };
  }

  try {
    const result = await docClient.send(command);
    if (!result.Attributes) {
      return { 
        statusCode: 404, 
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Alert rule not found' }) 
      };
    }
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Alert rule deleted successfully' }),
    };
  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') {
      return { 
        statusCode: 403, 
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Alert rule not found or access denied' }) 
      };
    }
    throw error;
  }
}

async function getActiveAlerts(userId?: string): Promise<APIGatewayProxyResult> {
  // Query for active alert instances (status = 'active')
  const command = new ScanCommand({
    TableName: ALERTS_TABLE,
    FilterExpression: '#status = :status AND attribute_exists(alertInstanceId)',
    ExpressionAttributeNames: {
      '#status': 'status',
    },
    ExpressionAttributeValues: {
      ':status': 'active',
    },
  });

  const result = await docClient.send(command);
  let alerts = (result.Items || []) as AlertInstance[];

  // Filter by userId if provided (through device ownership)
  // Note: This is a simplified version - in production you'd want to join with devices table
  if (userId) {
    // For now, return all active alerts
    // In production, you'd filter by device ownership
  }

  // Sort by triggeredAt descending (most recent first)
  alerts.sort((a, b) => b.triggeredAt - a.triggeredAt);

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({ alerts }),
  };
}
