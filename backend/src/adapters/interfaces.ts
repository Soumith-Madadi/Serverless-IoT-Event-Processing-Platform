import { Event } from '../schemas/event';

export enum AdapterStatus {
  STOPPED = 'stopped',
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  ERROR = 'error',
}

export interface AdapterConfig {
  name: string;
  enabled: boolean;
  interval?: number;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  [key: string]: any;
}

export interface AdapterStatusInfo {
  status: AdapterStatus;
  lastRun?: Date;
  lastError?: string;
  eventsProcessed: number;
  eventsFailed: number;
  uptime: number;
  config: AdapterConfig;
}

export type EventEmissionCallback = (event: Event) => Promise<void>;

export interface EventAdapter {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  
  config: AdapterConfig;
  
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
  
  getStatus(): AdapterStatusInfo;
  isRunning(): boolean;
  
  onEvent(callback: EventEmissionCallback): void;
  emitEvent(event: Event): Promise<void>;
  
  updateConfig(config: Partial<AdapterConfig>): Promise<void>;
  validateConfig(config: AdapterConfig): boolean;
  
  healthCheck(): Promise<boolean>;
}


export interface AdapterFactory {
  createAdapter(config: AdapterConfig): Promise<EventAdapter>;
  getSupportedTypes(): string[];
  validateConfig(config: AdapterConfig): boolean;
}


export interface AdapterRegistry {
  registerAdapter(adapter: EventAdapter): void;
  unregisterAdapter(name: string): void;
  getAdapter(name: string): EventAdapter | undefined;
  getAllAdapters(): EventAdapter[];
  getRunningAdapters(): EventAdapter[];
  startAllAdapters(): Promise<void>;
  stopAllAdapters(): Promise<void>;
  getRegistryStatus(): Record<string, AdapterStatusInfo>;
}


export class AdapterError extends Error {
  constructor(
    message: string,
    public readonly adapterName: string,
    public readonly code: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'AdapterError';
  }
}

export class AdapterConfigError extends AdapterError {
  constructor(message: string, adapterName: string) {
    super(message, adapterName, 'CONFIG_ERROR', false);
    this.name = 'AdapterConfigError';
  }
}

export class AdapterConnectionError extends AdapterError {
  constructor(message: string, adapterName: string) {
    super(message, adapterName, 'CONNECTION_ERROR', true);
    this.name = 'AdapterConnectionError';
  }
}


export abstract class BaseAdapter implements EventAdapter {
  public readonly name: string;
  public readonly version: string;
  public readonly description: string;
  public config: AdapterConfig;
  
  private status: AdapterStatus = AdapterStatus.STOPPED;
  private startTime?: Date;
  private lastRun?: Date;
  private lastError?: string;
  private eventsProcessed = 0;
  private eventsFailed = 0;
  private eventCallback?: EventEmissionCallback;
  private intervalId?: ReturnType<typeof setInterval>;

  constructor(name: string, version: string, description: string, config: AdapterConfig) {
    this.name = name;
    this.version = version;
    this.description = description;
    this.config = config;
  }


  protected abstract performWork(): Promise<void>;
  protected abstract validateAdapterConfig(config: AdapterConfig): boolean;


  async initialize(): Promise<void> {
    if (!this.validateAdapterConfig(this.config)) {
      throw new AdapterConfigError(`Invalid configuration for adapter ${this.name}`, this.name);
    }
    
    this.status = AdapterStatus.STOPPED;
    this.eventsProcessed = 0;
    this.eventsFailed = 0;
  }

  async start(): Promise<void> {
    if (this.status === AdapterStatus.RUNNING) {
      return;
    }

    this.status = AdapterStatus.STARTING;
    
    try {
      await this.onStart();
      
      if (this.config.interval && this.config.interval > 0) {
        this.intervalId = setInterval(async () => {
          await this.runWork();
        }, this.config.interval);
      }
      
      this.status = AdapterStatus.RUNNING;
      this.startTime = new Date();
    } catch (error) {
      this.status = AdapterStatus.ERROR;
      this.lastError = error instanceof Error ? error.message : String(error);
      throw new AdapterError(
        `Failed to start adapter ${this.name}: ${this.lastError}`,
        this.name,
        'START_ERROR'
      );
    }
  }

  async stop(): Promise<void> {
    if (this.status === AdapterStatus.STOPPED) {
      return;
    }

    this.status = AdapterStatus.STOPPING;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    
    try {
      await this.onStop();
      this.status = AdapterStatus.STOPPED;
    } catch (error) {
      this.status = AdapterStatus.ERROR;
      this.lastError = error instanceof Error ? error.message : String(error);
      throw new AdapterError(
        `Failed to stop adapter ${this.name}: ${this.lastError}`,
        this.name,
        'STOP_ERROR'
      );
    }
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  getStatus(): AdapterStatusInfo {
    const uptime = this.startTime ? Date.now() - this.startTime.getTime() : 0;
    
    return {
      status: this.status,
      lastRun: this.lastRun,
      lastError: this.lastError,
      eventsProcessed: this.eventsProcessed,
      eventsFailed: this.eventsFailed,
      uptime,
      config: this.config,
    };
  }

  isRunning(): boolean {
    return this.status === AdapterStatus.RUNNING;
  }

  onEvent(callback: EventEmissionCallback): void {
    this.eventCallback = callback;
  }

  async emitEvent(event: Event): Promise<void> {
    if (this.eventCallback) {
      try {
        await this.eventCallback(event);
        this.eventsProcessed++;
      } catch (error) {
        this.eventsFailed++;
        throw error;
      }
    }
  }

  async updateConfig(config: Partial<AdapterConfig>): Promise<void> {
    const newConfig = { ...this.config, ...config };
    
    if (!this.validateAdapterConfig(newConfig)) {
      throw new AdapterConfigError(`Invalid configuration for adapter ${this.name}`, this.name);
    }
    
    this.config = newConfig;
  }

  validateConfig(config: AdapterConfig): boolean {
    return this.validateAdapterConfig(config);
  }

  async healthCheck(): Promise<boolean> {
    try {
      return this.status === AdapterStatus.RUNNING && !this.lastError;
    } catch (error) {
      return false;
    }
  }


  protected async onStart(): Promise<void> {

  }

  protected async onStop(): Promise<void> {

  }


  private async runWork(): Promise<void> {
    if (this.status !== AdapterStatus.RUNNING) {
      return;
    }

    try {
      this.lastRun = new Date();
      await this.performWork();
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      this.eventsFailed++;
      
      if (this.config.maxRetries && this.config.maxRetries > 0) {

      }
    }
  }
}
