import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

export const AlertConditionSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(['gt', 'gte', 'lt', 'lte', 'eq', 'neq', 'contains', 'not_contains']),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

export const AlertRuleSchema = z.object({
  alertId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  deviceId: z.string().optional(),
  conditions: z.array(AlertConditionSchema).min(1),
  severity: z.enum(['info', 'warning', 'critical']).default('info'),
  enabled: z.boolean().default(true),
  notificationChannels: z.array(z.enum(['ui', 'email', 'webhook'])).min(1),
  emailRecipients: z.array(z.string().email()).optional(),
  webhookUrl: z.string().url().optional(),
  cooldownPeriod: z.number().min(0).optional(), // seconds
  createdAt: z.number().positive(),
  updatedAt: z.number().positive(),
  userId: z.string().optional(),
});

export const AlertInstanceSchema = z.object({
  alertInstanceId: z.string().uuid(),
  alertId: z.string().uuid(),
  alertName: z.string().min(1),
  deviceId: z.string().optional(),
  severity: z.enum(['info', 'warning', 'critical']),
  message: z.string().min(1),
  triggeredAt: z.number().positive(),
  acknowledgedAt: z.number().positive().optional(),
  acknowledgedBy: z.string().optional(),
  resolvedAt: z.number().positive().optional(),
  resolvedBy: z.string().optional(),
  status: z.enum(['active', 'acknowledged', 'resolved']).default('active'),
  eventId: z.string().uuid().optional(),
  metadata: z.record(z.any()).optional(),
});

export type AlertCondition = z.infer<typeof AlertConditionSchema>;
export type AlertRule = z.infer<typeof AlertRuleSchema>;
export type AlertInstance = z.infer<typeof AlertInstanceSchema>;

export const validateAlertRule = (rule: unknown): AlertRule => {
  return AlertRuleSchema.parse(rule);
};

export const validateAlertInstance = (instance: unknown): AlertInstance => {
  return AlertInstanceSchema.parse(instance);
};

export const createAlertRule = (
  name: string,
  conditions: AlertCondition[],
  options?: {
    description?: string;
    deviceId?: string;
    severity?: 'info' | 'warning' | 'critical';
    notificationChannels?: ('ui' | 'email' | 'webhook')[];
    emailRecipients?: string[];
    webhookUrl?: string;
    cooldownPeriod?: number;
    userId?: string;
  }
): AlertRule => {
  return {
    alertId: uuidv4(),
    name,
    description: options?.description,
    deviceId: options?.deviceId,
    conditions,
    severity: options?.severity || 'info',
    enabled: true,
    notificationChannels: options?.notificationChannels || ['ui'],
    emailRecipients: options?.emailRecipients,
    webhookUrl: options?.webhookUrl,
    cooldownPeriod: options?.cooldownPeriod,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    userId: options?.userId,
  };
};

export const createAlertInstance = (
  alertId: string,
  alertName: string,
  message: string,
  severity: 'info' | 'warning' | 'critical',
  options?: {
    deviceId?: string;
    eventId?: string;
    metadata?: Record<string, any>;
  }
): AlertInstance => {
  return {
    alertInstanceId: uuidv4(),
    alertId,
    alertName,
    deviceId: options?.deviceId,
    severity,
    message,
    triggeredAt: Date.now(),
    status: 'active',
    eventId: options?.eventId,
    metadata: options?.metadata,
  };
};

export const evaluateAlertConditions = (
  conditions: AlertCondition[],
  data: Record<string, any>
): boolean => {
  return conditions.every(condition => {
    const fieldValue = data[condition.field];
    
    if (fieldValue === undefined || fieldValue === null) {
      return false;
    }
    
    switch (condition.operator) {
      case 'gt':
        return Number(fieldValue) > Number(condition.value);
      case 'gte':
        return Number(fieldValue) >= Number(condition.value);
      case 'lt':
        return Number(fieldValue) < Number(condition.value);
      case 'lte':
        return Number(fieldValue) <= Number(condition.value);
      case 'eq':
        return fieldValue === condition.value;
      case 'neq':
        return fieldValue !== condition.value;
      case 'contains':
        return String(fieldValue).includes(String(condition.value));
      case 'not_contains':
        return !String(fieldValue).includes(String(condition.value));
      default:
        return false;
    }
  });
};
