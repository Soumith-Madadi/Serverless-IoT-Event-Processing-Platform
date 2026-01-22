import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

export const EventSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.number().positive(),
  source: z.string().min(1),
  type: z.string().min(1),
  data: z.record(z.any()),
  metadata: z.object({
    version: z.string().default('1.0.0'),
    tags: z.array(z.string()).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    correlationId: z.string().optional(),
    userId: z.string().optional(),
  }).optional(),
});

export const IoTSensorEventSchema = EventSchema.extend({
  type: z.literal('sensor_reading'),
  source: z.literal('iot_sensors'),
  data: z.object({
    deviceId: z.string().min(1),
    sensorId: z.string().min(1),
    sensorType: z.enum(['temperature', 'humidity', 'pressure', 'motion', 'light', 'accelerometer', 'gyroscope', 'magnetometer']),
    value: z.number(),
    unit: z.string(),
    location: z.object({
      latitude: z.number(),
      longitude: z.number(),
      altitude: z.number().optional(),
    }).optional(),
    batteryLevel: z.number().min(0).max(100).optional(),
    signalStrength: z.number().min(0).max(100).optional(),
    firmwareVersion: z.string().optional(),
    deviceModel: z.string().optional(),
    manufacturer: z.string().optional(),
    connectionStatus: z.enum(['online', 'offline']).optional(),
    lastHeartbeat: z.number().positive().optional(),
    capabilities: z.array(z.string()).optional(),
  }),
});

export const DeviceCommandEventSchema = EventSchema.extend({
  type: z.literal('device_command'),
  source: z.literal('iot_sensors'),
  data: z.object({
    commandId: z.string().uuid(),
    deviceId: z.string().min(1),
    commandType: z.string().min(1),
    commandName: z.string().min(1),
    parameters: z.record(z.any()).optional(),
    status: z.enum(['pending', 'sent', 'acknowledged', 'completed', 'failed']),
  }),
});

export const DeviceAlertEventSchema = EventSchema.extend({
  type: z.literal('device_alert'),
  source: z.literal('iot_sensors'),
  data: z.object({
    alertInstanceId: z.string().uuid(),
    alertId: z.string().uuid(),
    deviceId: z.string().min(1),
    severity: z.enum(['info', 'warning', 'critical']),
    message: z.string().min(1),
    triggeredAt: z.number().positive(),
  }),
});

export const DeviceStatusEventSchema = EventSchema.extend({
  type: z.literal('device_status'),
  source: z.literal('iot_sensors'),
  data: z.object({
    deviceId: z.string().min(1),
    status: z.enum(['online', 'offline', 'maintenance', 'error']),
    lastHeartbeat: z.number().positive().optional(),
    batteryLevel: z.number().min(0).max(100).optional(),
    signalStrength: z.number().min(0).max(100).optional(),
  }),
});

export const SupportedEventSchema = z.union([
  IoTSensorEventSchema,
  DeviceCommandEventSchema,
  DeviceAlertEventSchema,
  DeviceStatusEventSchema,
]);

export type Event = z.infer<typeof EventSchema>;
export type IoTSensorEvent = z.infer<typeof IoTSensorEventSchema>;
export type DeviceCommandEvent = z.infer<typeof DeviceCommandEventSchema>;
export type DeviceAlertEvent = z.infer<typeof DeviceAlertEventSchema>;
export type DeviceStatusEvent = z.infer<typeof DeviceStatusEventSchema>;
export type SupportedEvent = z.infer<typeof SupportedEventSchema>;

export interface EventMetadata {
  version: string;
  tags?: string[];
  priority?: 'low' | 'medium' | 'high';
  correlationId?: string;
  userId?: string;
}

export type EventSource = 'iot_sensors' | 'iot_devices' | 'manual';

export enum EventStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRY = 'retry',
}

export interface ReplayConfig {
  startTime: number;
  endTime: number;
  speed: number;
  filters?: {
    sources?: string[];
    types?: string[];
    tags?: string[];
  };
}

export interface EventFilters {
  sources?: string[];
  types?: string[];
  startTime?: number;
  endTime?: number;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export interface EventAggregation {
  count: number;
  sources: Record<string, number>;
  types: Record<string, number>;
  timeRange: {
    start: number;
    end: number;
  };
}

export const validateEvent = (event: unknown): Event => {
  return EventSchema.parse(event);
};

export const validateIoTSensorEvent = (event: unknown): IoTSensorEvent => {
  return IoTSensorEventSchema.parse(event);
};

export const validateDeviceCommandEvent = (event: unknown): DeviceCommandEvent => {
  return DeviceCommandEventSchema.parse(event);
};

export const validateDeviceAlertEvent = (event: unknown): DeviceAlertEvent => {
  return DeviceAlertEventSchema.parse(event);
};

export const validateDeviceStatusEvent = (event: unknown): DeviceStatusEvent => {
  return DeviceStatusEventSchema.parse(event);
};

export const validateSupportedEvent = (event: unknown): SupportedEvent => {
  return SupportedEventSchema.parse(event);
};

export const createEvent = (
  source: string,
  type: string,
  data: Record<string, any>,
  metadata?: Partial<EventMetadata>
): Event => {
  return {
    id: uuidv4(),
    timestamp: Date.now(),
    source,
    type,
    data,
    metadata: {
      version: '1.0.0',
      ...metadata,
    },
  };
};

export const createIoTSensorEvent = (
  deviceId: string,
  sensorId: string,
  sensorType: 'temperature' | 'humidity' | 'pressure' | 'motion' | 'light' | 'accelerometer' | 'gyroscope' | 'magnetometer',
  value: number,
  unit: string,
  metadata?: Partial<EventMetadata> & {
    location?: { latitude: number; longitude: number; altitude?: number };
    batteryLevel?: number;
    signalStrength?: number;
    firmwareVersion?: string;
    deviceModel?: string;
    manufacturer?: string;
    connectionStatus?: 'online' | 'offline';
    lastHeartbeat?: number;
    capabilities?: string[];
  }
): IoTSensorEvent => {
  return {
    id: uuidv4(),
    timestamp: Date.now(),
    source: 'iot_sensors',
    type: 'sensor_reading',
    data: {
      deviceId,
      sensorId,
      sensorType,
      value,
      unit,
      location: metadata?.location,
      batteryLevel: metadata?.batteryLevel,
      signalStrength: metadata?.signalStrength,
      firmwareVersion: metadata?.firmwareVersion,
      deviceModel: metadata?.deviceModel,
      manufacturer: metadata?.manufacturer,
      connectionStatus: metadata?.connectionStatus,
      lastHeartbeat: metadata?.lastHeartbeat,
      capabilities: metadata?.capabilities,
    },
    metadata: {
      version: '1.0.0',
      tags: metadata?.tags,
      priority: metadata?.priority,
      correlationId: metadata?.correlationId,
      userId: metadata?.userId,
    },
  };
};
