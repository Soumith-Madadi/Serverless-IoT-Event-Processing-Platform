import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

export const DeviceCapabilitiesSchema = z.object({
  sensors: z.array(z.string()).optional(),
  actuators: z.array(z.string()).optional(),
  commands: z.array(z.string()).optional(),
  firmwareVersion: z.string().optional(),
  maxUpdateRate: z.number().optional(),
});

export const DeviceLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  altitude: z.number().optional(),
  address: z.string().optional(),
});

export const DeviceConfigurationSchema = z.record(z.any());

export const DeviceSchema = z.object({
  deviceId: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
  model: z.string().optional(),
  manufacturer: z.string().optional(),
  location: DeviceLocationSchema.optional(),
  capabilities: DeviceCapabilitiesSchema.optional(),
  configuration: DeviceConfigurationSchema.optional(),
  status: z.enum(['active', 'inactive', 'maintenance', 'offline']).default('active'),
  ownerId: z.string().optional(),
  userId: z.string().optional(),
  registrationDate: z.number().positive(),
  lastSeen: z.number().positive().optional(),
  firmwareVersion: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export const DeviceCommandSchema = z.object({
  commandId: z.string().uuid(),
  deviceId: z.string().min(1),
  commandType: z.string().min(1),
  commandName: z.string().min(1),
  parameters: z.record(z.any()).optional(),
  status: z.enum(['pending', 'sent', 'acknowledged', 'completed', 'failed']).default('pending'),
  timestamp: z.number().positive(),
  sentAt: z.number().positive().optional(),
  acknowledgedAt: z.number().positive().optional(),
  completedAt: z.number().positive().optional(),
  failedAt: z.number().positive().optional(),
  errorMessage: z.string().optional(),
  userId: z.string().optional(),
  correlationId: z.string().optional(),
});

export const DeviceStatusSchema = z.object({
  deviceId: z.string().min(1),
  status: z.enum(['online', 'offline', 'maintenance', 'error']),
  timestamp: z.number().positive(),
  lastHeartbeat: z.number().positive().optional(),
  batteryLevel: z.number().min(0).max(100).optional(),
  signalStrength: z.number().min(0).max(100).optional(),
  firmwareVersion: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export type Device = z.infer<typeof DeviceSchema>;
export type DeviceCapabilities = z.infer<typeof DeviceCapabilitiesSchema>;
export type DeviceLocation = z.infer<typeof DeviceLocationSchema>;
export type DeviceCommand = z.infer<typeof DeviceCommandSchema>;
export type DeviceStatus = z.infer<typeof DeviceStatusSchema>;

export const validateDevice = (device: unknown): Device => {
  return DeviceSchema.parse(device);
};

export const validateDeviceCommand = (command: unknown): DeviceCommand => {
  return DeviceCommandSchema.parse(command);
};

export const validateDeviceStatus = (status: unknown): DeviceStatus => {
  return DeviceStatusSchema.parse(status);
};

export const createDevice = (
  deviceId: string,
  name: string,
  type: string,
  options?: {
    model?: string;
    manufacturer?: string;
    location?: DeviceLocation;
    capabilities?: DeviceCapabilities;
    configuration?: Record<string, any>;
    ownerId?: string;
    userId?: string;
    firmwareVersion?: string;
    metadata?: Record<string, any>;
  }
): Device => {
  return {
    deviceId,
    name,
    type,
    model: options?.model,
    manufacturer: options?.manufacturer,
    location: options?.location,
    capabilities: options?.capabilities,
    configuration: options?.configuration,
    status: 'active',
    ownerId: options?.ownerId,
    userId: options?.userId,
    registrationDate: Date.now(),
    firmwareVersion: options?.firmwareVersion,
    metadata: options?.metadata,
  };
};

export const createDeviceCommand = (
  deviceId: string,
  commandType: string,
  commandName: string,
  options?: {
    parameters?: Record<string, any>;
    userId?: string;
    correlationId?: string;
  }
): DeviceCommand => {
  return {
    commandId: uuidv4(),
    deviceId,
    commandType,
    commandName,
    parameters: options?.parameters,
    status: 'pending',
    timestamp: Date.now(),
    userId: options?.userId,
    correlationId: options?.correlationId,
  };
};

export const createDeviceStatus = (
  deviceId: string,
  status: 'online' | 'offline' | 'maintenance' | 'error',
  options?: {
    lastHeartbeat?: number;
    batteryLevel?: number;
    signalStrength?: number;
    firmwareVersion?: string;
    metadata?: Record<string, any>;
  }
): DeviceStatus => {
  return {
    deviceId,
    status,
    timestamp: Date.now(),
    lastHeartbeat: options?.lastHeartbeat || Date.now(),
    batteryLevel: options?.batteryLevel,
    signalStrength: options?.signalStrength,
    firmwareVersion: options?.firmwareVersion,
    metadata: options?.metadata,
  };
};
