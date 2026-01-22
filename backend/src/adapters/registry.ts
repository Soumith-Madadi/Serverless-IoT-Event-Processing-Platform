import { EventAdapter, AdapterRegistry, AdapterStatusInfo, AdapterStatus } from './interfaces';
import { IoTSensorAdapter, IoTSensorAdapterFactory, IoTSensorConfig } from './iot-sensor-adapter';

export class AdapterRegistryImpl implements AdapterRegistry {
  private adapters: Map<string, EventAdapter> = new Map();
  private factories: Map<string, any> = new Map();

  constructor() {
    this.registerFactory('iot_sensor', IoTSensorAdapterFactory);
  }

  registerFactory(type: string, factory: any): void {
    this.factories.set(type, factory);
  }

  getFactory(type: string): any {
    return this.factories.get(type);
  }

  getSupportedTypes(): string[] {
    return Array.from(this.factories.keys());
  }

  registerAdapter(adapter: EventAdapter): void {
    if (this.adapters.has(adapter.name)) {
      throw new Error(`Adapter with name '${adapter.name}' is already registered`);
    }
    
    this.adapters.set(adapter.name, adapter);
    console.log(`Registered adapter: ${adapter.name} (${adapter.description})`);
  }

  unregisterAdapter(name: string): void {
    const adapter = this.adapters.get(name);
    if (adapter) {
      if (adapter.isRunning()) {
        adapter.stop().catch(error => {
          console.error(`Error stopping adapter ${name}:`, error);
        });
      }
      this.adapters.delete(name);
      console.log(`Unregistered adapter: ${name}`);
    }
  }

  getAdapter(name: string): EventAdapter | undefined {
    return this.adapters.get(name);
  }

  getAllAdapters(): EventAdapter[] {
    return Array.from(this.adapters.values());
  }

  getRunningAdapters(): EventAdapter[] {
    return Array.from(this.adapters.values()).filter(adapter => adapter.isRunning());
  }

  async startAllAdapters(): Promise<void> {
    const adapters = this.getAllAdapters();
    const results = await Promise.allSettled(
      adapters.map(adapter => adapter.start())
    );

    const failed = results.filter(result => result.status === 'rejected');
    if (failed.length > 0) {
      console.error(`${failed.length} adapters failed to start:`, failed);
    }

    const successful = results.filter(result => result.status === 'fulfilled');
    console.log(`Started ${successful.length} adapters successfully`);
  }

  async stopAllAdapters(): Promise<void> {
    const adapters = this.getAllAdapters();
    const results = await Promise.allSettled(
      adapters.map(adapter => adapter.stop())
    );

    const failed = results.filter(result => result.status === 'rejected');
    if (failed.length > 0) {
      console.error(`${failed.length} adapters failed to stop:`, failed);
    }

    const successful = results.filter(result => result.status === 'fulfilled');
    console.log(`Stopped ${successful.length} adapters successfully`);
  }

  getRegistryStatus(): Record<string, AdapterStatusInfo> {
    const status: Record<string, AdapterStatusInfo> = {};
    
    this.adapters.forEach((adapter, name) => {
      status[name] = adapter.getStatus();
    });
    
    return status;
  }

  async createAndRegisterIoTSensorAdapter(config: IoTSensorConfig): Promise<IoTSensorAdapter> {
    const adapter = IoTSensorAdapterFactory.createAdapter(config);
    await adapter.initialize();
    this.registerAdapter(adapter);
    return adapter;
  }

  async getHealthStatus(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {};
    
    for (const [name, adapter] of this.adapters) {
      try {
        health[name] = await adapter.healthCheck();
      } catch (error) {
        health[name] = false;
        console.error(`Health check failed for adapter ${name}:`, error);
      }
    }
    
    return health;
  }

  getRegistryMetrics(): {
    totalAdapters: number;
    runningAdapters: number;
    stoppedAdapters: number;
    errorAdapters: number;
    totalEventsProcessed: number;
    totalEventsFailed: number;
  } {
    const adapters = this.getAllAdapters();
    const statuses = this.getRegistryStatus();
    
    let runningCount = 0;
    let stoppedCount = 0;
    let errorCount = 0;
    let totalProcessed = 0;
    let totalFailed = 0;
    
    adapters.forEach(adapter => {
      const status = statuses[adapter.name];
      
      switch (status.status) {
        case AdapterStatus.RUNNING:
          runningCount++;
          break;
        case AdapterStatus.STOPPED:
          stoppedCount++;
          break;
        case AdapterStatus.ERROR:
          errorCount++;
          break;
      }
      
      totalProcessed += status.eventsProcessed;
      totalFailed += status.eventsFailed;
    });
    
    return {
      totalAdapters: adapters.length,
      runningAdapters: runningCount,
      stoppedAdapters: stoppedCount,
      errorAdapters: errorCount,
      totalEventsProcessed: totalProcessed,
      totalEventsFailed: totalFailed,
    };
  }

  async updateAdapterConfig(name: string, config: any): Promise<void> {
    const adapter = this.getAdapter(name);
    if (!adapter) {
      throw new Error(`Adapter '${name}' not found`);
    }
    
    await adapter.updateConfig(config);
  }

  setupEventHandlers(eventHandler: (event: any) => Promise<void>): void {
    this.adapters.forEach(adapter => {
      adapter.onEvent(eventHandler);
    });
  }

  async cleanup(): Promise<void> {
    await this.stopAllAdapters();
    this.adapters.clear();
    console.log('Adapter registry cleaned up');
  }
}

let registryInstance: AdapterRegistryImpl | null = null;

export function getAdapterRegistry(): AdapterRegistryImpl {
  if (!registryInstance) {
    registryInstance = new AdapterRegistryImpl();
  }
  return registryInstance;
}

export function resetAdapterRegistry(): void {
  if (registryInstance) {
    registryInstance.cleanup().catch(console.error);
    registryInstance = null;
  }
}


export function getDefaultIoTSensorConfig(): IoTSensorConfig {
  return IoTSensorAdapterFactory.getDefaultConfig();
}

export async function initializeDefaultAdapters(
  eventHandler: (event: any) => Promise<void>
): Promise<AdapterRegistryImpl> {
  const registry = getAdapterRegistry();
  
  const iotConfig = getDefaultIoTSensorConfig();
  
  await registry.createAndRegisterIoTSensorAdapter(iotConfig);
  
  registry.setupEventHandlers(eventHandler);
  
  return registry;
}

export async function startDefaultAdapters(): Promise<void> {
  const registry = getAdapterRegistry();
  await registry.startAllAdapters();
}

export async function stopDefaultAdapters(): Promise<void> {
  const registry = getAdapterRegistry();
  await registry.stopAllAdapters();
}
