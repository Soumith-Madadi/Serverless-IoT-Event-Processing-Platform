import { EventBridgeEvent } from 'aws-lambda';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import axios from 'axios';

const sesClient = new SESClient({});

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@iot-platform.com';
const API_GATEWAY_ENDPOINT = process.env.API_GATEWAY_ENDPOINT;
const WEBSOCKET_API_ID = process.env.WEBSOCKET_API_ID;

interface NotificationEvent {
  alertInstance: {
    alertInstanceId: string;
    alertId: string;
    alertName: string;
    deviceId?: string;
    severity: 'info' | 'warning' | 'critical';
    message: string;
    triggeredAt: number;
  };
  rule: {
    notificationChannels: ('ui' | 'email' | 'webhook')[];
    emailRecipients?: string[];
    webhookUrl?: string;
  };
}

export const handler = async (
  event: EventBridgeEvent<string, NotificationEvent>
): Promise<void> => {
  console.log('Notification handler received event:', JSON.stringify(event, null, 2));

  const { alertInstance, rule } = event.detail;

  const promises: Promise<void>[] = [];

  // Send UI notification via WebSocket
  if (rule.notificationChannels.includes('ui')) {
    promises.push(sendUINotification(alertInstance));
  }

  // Send email notification
  if (rule.notificationChannels.includes('email') && rule.emailRecipients) {
    promises.push(sendEmailNotification(alertInstance, rule.emailRecipients));
  }

  // Send webhook notification
  if (rule.notificationChannels.includes('webhook') && rule.webhookUrl) {
    promises.push(sendWebhookNotification(alertInstance, rule.webhookUrl));
  }

  // Execute all notifications in parallel
  await Promise.allSettled(promises);
};

async function sendUINotification(alertInstance: any): Promise<void> {
  if (!API_GATEWAY_ENDPOINT || !WEBSOCKET_API_ID) {
    console.warn('WebSocket API not configured, skipping UI notification');
    return;
  }

  try {
    // In a production system, you'd maintain a connection registry
    // For now, we'll publish to EventBridge and let WebSocket handler distribute
    // This is a simplified version - you'd need to track active connections
    
    console.log('UI notification would be sent via WebSocket:', alertInstance);
    // TODO: Implement connection tracking and broadcasting
  } catch (error) {
    console.error('Error sending UI notification:', error);
    throw error;
  }
}

async function sendEmailNotification(alertInstance: any, recipients: string[]): Promise<void> {
  const severityEmoji: Record<string, string> = {
    info: 'ℹ️',
    warning: '⚠️',
    critical: '🚨',
  };

  const subject = `${severityEmoji[alertInstance.severity] || 'ℹ️'} IoT Alert: ${alertInstance.alertName}`;
  const body = `
    <html>
      <body>
        <h2>IoT Device Alert</h2>
        <p><strong>Alert:</strong> ${alertInstance.alertName}</p>
        <p><strong>Severity:</strong> ${alertInstance.severity.toUpperCase()}</p>
        <p><strong>Device ID:</strong> ${alertInstance.deviceId || 'N/A'}</p>
        <p><strong>Message:</strong> ${alertInstance.message}</p>
        <p><strong>Triggered At:</strong> ${new Date(alertInstance.triggeredAt).toISOString()}</p>
      </body>
    </html>
  `;

  try {
    const command = new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: {
        ToAddresses: recipients,
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: body,
            Charset: 'UTF-8',
          },
        },
      },
    });

    await sesClient.send(command);
    console.log(`Email notification sent to ${recipients.join(', ')}`);
  } catch (error) {
    console.error('Error sending email notification:', error);
    throw error;
  }
}

async function sendWebhookNotification(alertInstance: any, webhookUrl: string): Promise<void> {
  try {
    const payload = {
      alertInstanceId: alertInstance.alertInstanceId,
      alertId: alertInstance.alertId,
      alertName: alertInstance.alertName,
      deviceId: alertInstance.deviceId,
      severity: alertInstance.severity,
      message: alertInstance.message,
      triggeredAt: alertInstance.triggeredAt,
      timestamp: Date.now(),
    };

    const response = await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 5000,
    });

    console.log(`Webhook notification sent to ${webhookUrl}, status: ${response.status}`);
  } catch (error) {
    console.error('Error sending webhook notification:', error);
    // Don't throw - webhook failures shouldn't fail the entire notification process
    if (axios.isAxiosError(error)) {
      console.error('Webhook error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
    }
  }
}
