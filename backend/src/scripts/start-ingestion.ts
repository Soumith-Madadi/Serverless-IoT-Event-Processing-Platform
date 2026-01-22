import { initializeDefaultAdapters, startDefaultAdapters, getAdapterRegistry } from '../adapters/registry';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { Event } from '../schemas/event';

const eventBridgeClient = new EventBridgeClient({});

const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME || 'dev-event-platform-bus';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const USER_ID = process.env.USER_ID || 'soumithmadadi';

async function handleEvent(event: Event): Promise<void> {
  try {
    console.log(`Processing event: ${event.id} from ${event.source}`);
    
    // Ensure userId is set in event metadata before sending to EventBridge
    const eventWithUserId: Event = {
      ...event,
      metadata: {
        ...event.metadata,
        version: event.metadata?.version || '1.0.0',
        userId: event.metadata?.userId || USER_ID,
      },
    };
    
    const eventBridgeEvent = {
      Source: event.source,
      DetailType: 'event',
      Detail: JSON.stringify(eventWithUserId),
      EventBusName: EVENT_BUS_NAME,
    };

    const command = new PutEventsCommand({
      Entries: [eventBridgeEvent],
    });

    await eventBridgeClient.send(command);
    console.log(`✅ Event ${event.id} sent to EventBridge`);
    
  } catch (error) {
    console.error(`❌ Failed to send event ${event.id} to EventBridge:`, error);
  }
}

async function healthCheck(): Promise<void> {
  const registry = getAdapterRegistry();
  const health = await registry.getHealthStatus();
  const metrics = registry.getRegistryMetrics();
  
  console.log('\n📊 Adapter Health Status:');
  Object.entries(health).forEach(([name, isHealthy]) => {
    console.log(`  ${name}: ${isHealthy ? '✅ Healthy' : '❌ Unhealthy'}`);
  });
  
  console.log('\n📈 Registry Metrics:');
  console.log(`  Total Adapters: ${metrics.totalAdapters}`);
  console.log(`  Running: ${metrics.runningAdapters}`);
  console.log(`  Stopped: ${metrics.stoppedAdapters}`);
  console.log(`  Errors: ${metrics.errorAdapters}`);
  console.log(`  Events Processed: ${metrics.totalEventsProcessed}`);
  console.log(`  Events Failed: ${metrics.totalEventsFailed}`);
}

function setupGracefulShutdown(): void {
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
    
    const registry = getAdapterRegistry();
    await registry.stopAllAdapters();
    
    console.log('✅ All adapters stopped. Exiting...');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGQUIT', () => shutdown('SIGQUIT'));
}

async function main(): Promise<void> {
  console.log('🚀 Starting Event Platform Data Ingestion...');
  console.log(`📍 Region: ${AWS_REGION}`);
  console.log(`📡 Event Bus: ${EVENT_BUS_NAME}`);
  
  try {
    console.log('\n🔧 Initializing adapters...');
    const registry = await initializeDefaultAdapters(handleEvent);
    
    console.log('\n▶️  Starting adapters...');
    await startDefaultAdapters();
    
    setupGracefulShutdown();
    
    console.log('\n✅ Data ingestion started successfully!');
    console.log('📋 Available adapters:');
    registry.getAllAdapters().forEach(adapter => {
      const status = adapter.getStatus();
      console.log(`  - ${adapter.name}: ${status.status}`);
    });
    
    setInterval(healthCheck, 30000);
    
    console.log('\n⏳ Data ingestion is running. Press Ctrl+C to stop.');
    
  } catch (error) {
    console.error('❌ Failed to start data ingestion:', error);
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});


if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
