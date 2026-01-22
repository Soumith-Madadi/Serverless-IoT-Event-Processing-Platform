import { BaseAdapter, AdapterConfig } from './interfaces';
import { createIoTSensorEvent, IoTSensorEvent } from '../schemas/event';
import { createDevice, Device } from '../schemas/device';

export interface IoTSensorConfig extends AdapterConfig {
  sensors: IoTSensor[];
  updateInterval: number;
  enableDrift: boolean;
  enableNoise: boolean;
  driftRate: number;
  noiseLevel: number;
}

export interface IoTSensor {
  id: string;
  deviceId: string;
  deviceName?: string;
  deviceModel?: string;
  manufacturer?: string;
  firmwareVersion?: string;
  type: 'temperature' | 'humidity' | 'pressure' | 'motion' | 'light';
  location: {
    latitude: number;
    longitude: number;
    altitude?: number;
  };
  baseValue: number;
  unit: string;
  range: {
    min: number;
    max: number;
  };
  batteryLevel: number;
  signalStrength: number;
  driftEnabled: boolean;
  noiseEnabled: boolean;
  capabilities?: string[];
  lastHeartbeat?: number;
}

interface SensorReading {
  sensorId: string;
  type: string;
  value: number;
  unit: string;
  timestamp: number;
  batteryLevel: number;
  signalStrength: number;
  location: {
    latitude: number;
    longitude: number;
    altitude?: number;
  };
}

class IoTSensorSimulator {
  private sensors: Map<string, IoTSensor> = new Map();
  private readings: Map<string, SensorReading> = new Map();
  private driftValues: Map<string, number> = new Map();
  private enableDrift: boolean;
  private enableNoise: boolean;
  private driftRate: number;
  private noiseLevel: number;

  constructor(config: IoTSensorConfig) {
    this.enableDrift = config.enableDrift;
    this.enableNoise = config.enableNoise;
    this.driftRate = config.driftRate;
    this.noiseLevel = config.noiseLevel;

    config.sensors.forEach(sensor => {
      this.sensors.set(sensor.id, sensor);
      this.driftValues.set(sensor.id, 0);
      
      this.readings.set(sensor.id, {
        sensorId: sensor.id,
        type: sensor.type,
        value: sensor.baseValue,
        unit: sensor.unit,
        timestamp: Date.now(),
        batteryLevel: sensor.batteryLevel,
        signalStrength: sensor.signalStrength,
        location: sensor.location,
      });
    });
  }

  updateReadings(): SensorReading[] {
    const updatedReadings: SensorReading[] = [];
    
    this.sensors.forEach((sensor, sensorId) => {
      const currentReading = this.readings.get(sensorId)!;
      const updatedReading = this.simulateSensorReading(sensor, currentReading);
      
      this.readings.set(sensorId, updatedReading);
      updatedReadings.push(updatedReading);
    });
    
    return updatedReadings;
  }

  private simulateSensorReading(sensor: IoTSensor, currentReading: SensorReading): SensorReading {
    let newValue = currentReading.value;
    
    if (this.enableDrift && sensor.driftEnabled) {
      const drift = this.driftValues.get(sensor.id) || 0;
      const driftIncrement = (this.driftRate / 3600) * (this.getUpdateInterval() / 1000); // Convert to per-second
      const newDrift = drift + (Math.random() - 0.5) * driftIncrement;
      this.driftValues.set(sensor.id, newDrift);
      newValue += newDrift;
    }
    
    if (this.enableNoise && sensor.noiseEnabled) {
      const noise = (Math.random() - 0.5) * 2 * (this.noiseLevel / 100) * sensor.baseValue;
      newValue += noise;
    }
    
    newValue += this.getNaturalVariation(sensor.type);
    
    newValue = Math.max(sensor.range.min, Math.min(sensor.range.max, newValue));
    
    const batteryLevel = Math.max(0, currentReading.batteryLevel - Math.random() * 0.1);
    const signalStrength = Math.max(0, Math.min(100, currentReading.signalStrength + (Math.random() - 0.5) * 5));

    
    return {
      ...currentReading,
      value: newValue,
      timestamp: Date.now(),
      batteryLevel,
      signalStrength,
    };
  }

  private getNaturalVariation(sensorType: string): number {
    switch (sensorType) {
      case 'temperature':
        return (Math.random() - 0.5) * 2; // ±1°C variation
      case 'humidity':
        return (Math.random() - 0.5) * 5; // ±2.5% variation
      case 'pressure':
        return (Math.random() - 0.5) * 10; // ±5 hPa variation
      case 'motion':
        return Math.random() > 0.95 ? 1 : 0; // Occasional motion detection
      case 'light':
        return (Math.random() - 0.5) * 50; // ±25 lux variation
      default:
        return 0;
    }
  }

  private getUpdateInterval(): number {
    return 5000;
  }

  getReading(sensorId: string): SensorReading | undefined {
    return this.readings.get(sensorId);
  }

  getAllReadings(): SensorReading[] {
    return Array.from(this.readings.values());
  }

  addSensor(sensor: IoTSensor): void {
    this.sensors.set(sensor.id, sensor);
    this.driftValues.set(sensor.id, 0);
    
    this.readings.set(sensor.id, {
      sensorId: sensor.id,
      type: sensor.type,
      value: sensor.baseValue,
      unit: sensor.unit,
      timestamp: Date.now(),
      batteryLevel: sensor.batteryLevel,
      signalStrength: sensor.signalStrength,
      location: sensor.location,
    });
  }

  removeSensor(sensorId: string): void {
    this.sensors.delete(sensorId);
    this.readings.delete(sensorId);
    this.driftValues.delete(sensorId);
  }
}

export class IoTSensorAdapter extends BaseAdapter {
  private simulator: IoTSensorSimulator;
  private iotConfig: IoTSensorConfig;
  private registeredDevices: Map<string, Device> = new Map();

  constructor(config: IoTSensorConfig) {
    super(
      config.name,
      '1.0.0',
      'Simulates IoT sensor data with realistic drift, noise, and battery drain',
      config
    );
    
    this.iotConfig = config;
    this.simulator = new IoTSensorSimulator(config);
  }

  protected async performWork(): Promise<void> {
    const updatedReadings = this.simulator.updateReadings();
    
    for (const reading of updatedReadings) {
      const sensor = this.iotConfig.sensors.find(s => s.id === reading.sensorId);
      if (!sensor) continue;

      const deviceId = sensor.deviceId || `device_${sensor.id}`;
      const now = Date.now();

      // Update device heartbeat
      if (sensor.lastHeartbeat === undefined) {
        sensor.lastHeartbeat = now;
      } else {
        sensor.lastHeartbeat = now;
      }

      const event = createIoTSensorEvent(
        deviceId,
        reading.sensorId,
        reading.type as 'temperature' | 'humidity' | 'pressure' | 'motion' | 'light',
        reading.value,
        reading.unit,
        {
          tags: ['iot_sensor', 'real_time'],
          priority: this.getPriorityForReading(reading),
          location: reading.location,
          batteryLevel: reading.batteryLevel,
          signalStrength: reading.signalStrength,
          firmwareVersion: sensor.firmwareVersion,
          deviceModel: sensor.deviceModel,
          manufacturer: sensor.manufacturer,
          connectionStatus: 'online',
          lastHeartbeat: sensor.lastHeartbeat,
          capabilities: sensor.capabilities,
        }
      );
      
      await this.emitEvent(event);
    }
  }

  protected validateAdapterConfig(config: AdapterConfig): boolean {
    const iotConfig = config as IoTSensorConfig;
    
    if (!iotConfig.sensors || iotConfig.sensors.length === 0) {
      return false;
    }
    
    for (const sensor of iotConfig.sensors) {
      if (!sensor.id || !sensor.type || !sensor.unit) {
        return false;
      }
      
      if (sensor.range && sensor.range.min >= sensor.range.max) {
        return false;
      }
      
      if (sensor.batteryLevel < 0 || sensor.batteryLevel > 100) {
        return false;
      }
      
      if (sensor.signalStrength < 0 || sensor.signalStrength > 100) {
        return false;
      }
      
      if (sensor.location.latitude < -90 || sensor.location.latitude > 90) {
        return false;
      }
      
      if (sensor.location.longitude < -180 || sensor.location.longitude > 180) {
        return false;
      }
    }
    
    if (iotConfig.driftRate && iotConfig.driftRate < 0) {
      return false;
    }
    
    if (iotConfig.noiseLevel && (iotConfig.noiseLevel < 0 || iotConfig.noiseLevel > 100)) {
      return false;
    }
    
    return true;
  }

  private getPriorityForReading(reading: SensorReading): 'low' | 'medium' | 'high' {
    switch (reading.type) {
      case 'temperature':
        return reading.value > 40 || reading.value < -10 ? 'high' : 'medium';
      case 'humidity':
        return reading.value > 90 || reading.value < 10 ? 'high' : 'medium';
      case 'pressure':
        return reading.value < 900 || reading.value > 1100 ? 'high' : 'medium';
      case 'motion':
        return reading.value > 0 ? 'high' : 'low';
      case 'light':
        return reading.value > 1000 ? 'high' : 'medium';
      default:
        return 'medium';
    }
  }

  getCurrentReadings(): SensorReading[] {
    return this.simulator.getAllReadings();
  }

  getReading(sensorId: string): SensorReading | undefined {
    return this.simulator.getReading(sensorId);
  }

  addSensor(sensor: IoTSensor): void {
    this.iotConfig.sensors.push(sensor);
    this.simulator.addSensor(sensor);
  }

  removeSensor(sensorId: string): void {
    const index = this.iotConfig.sensors.findIndex(s => s.id === sensorId);
    if (index > -1) {
      this.iotConfig.sensors.splice(index, 1);
      this.simulator.removeSensor(sensorId);
    }
  }

  getLowBatterySensors(): SensorReading[] {
    return this.simulator.getAllReadings().filter(reading => reading.batteryLevel < 20);
  }

  getWeakSignalSensors(): SensorReading[] {
    return this.simulator.getAllReadings().filter(reading => reading.signalStrength < 30);
  }

  protected async onStart(): Promise<void> {
    // Register devices on adapter start
    for (const sensor of this.iotConfig.sensors) {
      const deviceId = sensor.deviceId || `device_${sensor.id}`;
      if (!this.registeredDevices.has(deviceId)) {
        const device = createDevice(
          deviceId,
          sensor.deviceName || `Device ${sensor.id}`,
          sensor.type,
          {
            model: sensor.deviceModel,
            manufacturer: sensor.manufacturer,
            location: sensor.location,
            capabilities: {
              sensors: [sensor.type],
              commands: sensor.capabilities || [],
            },
            firmwareVersion: sensor.firmwareVersion,
          }
        );
        this.registeredDevices.set(deviceId, device);
      }
    }
  }

  getRegisteredDevices(): Device[] {
    return Array.from(this.registeredDevices.values());
  }

  getDevice(deviceId: string): Device | undefined {
    return this.registeredDevices.get(deviceId);
  }
}

export class IoTSensorAdapterFactory {
  static createAdapter(config: IoTSensorConfig): IoTSensorAdapter {
    return new IoTSensorAdapter(config);
  }

  static getDefaultConfig(): IoTSensorConfig {
    return {
      name: 'iot_sensor_adapter',
      enabled: true,
      interval: 5000,
      sensors: [
        {
          id: 'temp_sensor_001',
          deviceId: 'device_temp_001',
          deviceName: 'Temperature Sensor 001',
          deviceModel: 'TS-100',
          manufacturer: 'IoT Corp',
          firmwareVersion: '1.2.3',
          type: 'temperature',
          location: { latitude: 40.7128, longitude: -74.0060 },
          baseValue: 22,
          unit: '°C',
          range: { min: -40, max: 60 },
          batteryLevel: 85,
          signalStrength: 95,
          driftEnabled: true,
          noiseEnabled: true,
          capabilities: ['read', 'configure'],
        },
        {
          id: 'humidity_sensor_001',
          deviceId: 'device_humidity_001',
          deviceName: 'Humidity Sensor 001',
          deviceModel: 'HS-200',
          manufacturer: 'IoT Corp',
          firmwareVersion: '1.1.0',
          type: 'humidity',
          location: { latitude: 40.7128, longitude: -74.0060 },
          baseValue: 45,
          unit: '%',
          range: { min: 0, max: 100 },
          batteryLevel: 78,
          signalStrength: 88,
          driftEnabled: true,
          noiseEnabled: true,
          capabilities: ['read', 'configure'],
        },
        {
          id: 'pressure_sensor_001',
          deviceId: 'device_pressure_001',
          deviceName: 'Pressure Sensor 001',
          deviceModel: 'PS-300',
          manufacturer: 'IoT Corp',
          firmwareVersion: '1.0.5',
          type: 'pressure',
          location: { latitude: 40.7128, longitude: -74.0060, altitude: 10 },
          baseValue: 1013,
          unit: 'hPa',
          range: { min: 800, max: 1200 },
          batteryLevel: 92,
          signalStrength: 97,
          driftEnabled: true,
          noiseEnabled: true,
          capabilities: ['read', 'configure'],
        },
        {
          id: 'motion_sensor_001',
          deviceId: 'device_motion_001',
          deviceName: 'Motion Sensor 001',
          deviceModel: 'MS-150',
          manufacturer: 'IoT Corp',
          firmwareVersion: '2.0.0',
          type: 'motion',
          location: { latitude: 40.7128, longitude: -74.0060 },
          baseValue: 0,
          unit: 'detection',
          range: { min: 0, max: 1 },
          batteryLevel: 65,
          signalStrength: 75,
          driftEnabled: false,
          noiseEnabled: false,
          capabilities: ['read', 'reset'],
        },
        {
          id: 'light_sensor_001',
          deviceId: 'device_light_001',
          deviceName: 'Light Sensor 001',
          deviceModel: 'LS-250',
          manufacturer: 'IoT Corp',
          firmwareVersion: '1.3.1',
          type: 'light',
          location: { latitude: 40.7128, longitude: -74.0060 },
          baseValue: 500,
          unit: 'lux',
          range: { min: 0, max: 10000 },
          batteryLevel: 88,
          signalStrength: 92,
          driftEnabled: true,
          noiseEnabled: true,
          capabilities: ['read', 'configure'],
        },
      ],
      updateInterval: 5000,
      enableDrift: true,
      enableNoise: true,
      driftRate: 0.1,
      noiseLevel: 2,
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 5000,
    };
  }

  static validateConfig(config: IoTSensorConfig): boolean {
    const adapter = new IoTSensorAdapter(config);
    return adapter.validateConfig(config);
  }
}
