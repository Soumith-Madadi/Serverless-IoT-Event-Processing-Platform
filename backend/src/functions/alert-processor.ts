import { EventBridgeEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { Event, IoTSensorEvent } from '../schemas/event';
import { AlertRule, AlertInstance, createAlertInstance, evaluateAlertConditions } from '../schemas/alert';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const eventBridgeClient = new EventBridgeClient({});

const ALERTS_TABLE = process.env.ALERTS_TABLE!;
const ALERT_RULES_TABLE = process.env.ALERT_RULES_TABLE || ALERTS_TABLE; // Can use same table with different partition
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME!;
const NOTIFICATION_HANDLER_ARN = process.env.NOTIFICATION_HANDLER_ARN;

interface AlertProcessorEvent {
  event: Event;
}

export const handler = async (
  event: EventBridgeEvent<string, AlertProcessorEvent>
): Promise<void> => {
  console.log('Alert processor received event:', JSON.stringify(event, null, 2));

  const telemetryEvent = event.detail.event;

  // Only process sensor reading events
  if (telemetryEvent.type !== 'sensor_reading' || telemetryEvent.source !== 'iot_sensors') {
    console.log('Skipping non-telemetry event');
    return;
  }

  const sensorEvent = telemetryEvent as IoTSensorEvent;
  const deviceId = sensorEvent.data.deviceId;

  try {
    // Get all alert rules for this device (or all rules if deviceId not specified)
    const alertRules = await getAlertRules(deviceId);

    // Evaluate each rule
    for (const rule of alertRules) {
      if (!rule.enabled) continue;

      // Check if rule applies to this device
      if (rule.deviceId && rule.deviceId !== deviceId) {
        continue;
      }

      // Evaluate conditions
      const shouldTrigger = evaluateAlertConditions(rule.conditions, sensorEvent.data);

      if (shouldTrigger) {
        // Check cooldown period
        const lastAlert = await getLastAlertForRule(rule.alertId, deviceId);
        if (lastAlert && rule.cooldownPeriod) {
          const timeSinceLastAlert = Date.now() - lastAlert.triggeredAt;
          if (timeSinceLastAlert < rule.cooldownPeriod * 1000) {
            console.log(`Alert ${rule.alertId} in cooldown period, skipping`);
            continue;
          }
        }

        // Create alert instance
        const alertInstance = createAlertInstance(
          rule.alertId,
          rule.name,
          `Alert triggered: ${rule.name} - Device: ${deviceId}`,
          rule.severity,
          {
            deviceId,
            eventId: sensorEvent.id,
            metadata: {
              conditions: rule.conditions,
              eventData: sensorEvent.data,
            },
          }
        );

        // Store alert instance
        await storeAlertInstance(alertInstance);

        // Trigger notification
        await triggerNotification(alertInstance, rule);
      }
    }
  } catch (error) {
    console.error('Error processing alerts:', error);
    throw error;
  }
};

async function getAlertRules(deviceId?: string): Promise<AlertRule[]> {
  // In a production system, you'd have a separate AlertRules table
  // For now, we'll scan the alerts table for rules (stored with alertId starting with 'rule_')
  const command = new ScanCommand({
    TableName: ALERT_RULES_TABLE,
    FilterExpression: 'begins_with(alertId, :rulePrefix)',
    ExpressionAttributeValues: {
      ':rulePrefix': 'rule_',
    },
  });

  const result = await docClient.send(command);
  const rules = (result.Items || []) as AlertRule[];

  // Filter by deviceId if provided
  if (deviceId) {
    return rules.filter(rule => !rule.deviceId || rule.deviceId === deviceId);
  }

  return rules;
}

async function getLastAlertForRule(alertId: string, deviceId?: string): Promise<AlertInstance | null> {
  if (!deviceId) return null;

  const command = new QueryCommand({
    TableName: ALERTS_TABLE,
    IndexName: 'DeviceIndex',
    KeyConditionExpression: 'deviceId = :deviceId',
    FilterExpression: 'alertId = :alertId',
    ExpressionAttributeValues: {
      ':deviceId': deviceId,
      ':alertId': alertId,
    },
    ScanIndexForward: false,
    Limit: 1,
  });

  const result = await docClient.send(command);
  return (result.Items?.[0] as AlertInstance) || null;
}

async function storeAlertInstance(alertInstance: AlertInstance): Promise<void> {
  const command = new PutCommand({
    TableName: ALERTS_TABLE,
    Item: {
      ...alertInstance,
      // Store with alertInstanceId as partition key for easy lookup
      // Also store with alertId for rule-based queries
      pk: alertInstance.alertInstanceId,
      sk: `ALERT#${alertInstance.alertId}`,
    },
  });

  await docClient.send(command);
}

async function triggerNotification(alertInstance: AlertInstance, rule: AlertRule): Promise<void> {
  // Publish notification event to EventBridge
  const notificationEvent = {
    Source: 'iot_sensors',
    DetailType: 'alert.notification',
    Detail: JSON.stringify({
      alertInstance,
      rule,
      notificationChannels: rule.notificationChannels,
      emailRecipients: rule.emailRecipients,
      webhookUrl: rule.webhookUrl,
    }),
    EventBusName: EVENT_BUS_NAME,
  };

  const command = new PutEventsCommand({
    Entries: [notificationEvent],
  });

  await eventBridgeClient.send(command);
}
