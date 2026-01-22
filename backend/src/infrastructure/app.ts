import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { EventPlatformStack } from './event-platform-stack';

const app = new cdk.App();

const environment = app.node.tryGetContext('environment') || 'dev';
const domainName = app.node.tryGetContext('domainName');

app.node.setContext('environment', environment);
app.node.setContext('stackName', `EventPlatformStack-${environment}`);

new EventPlatformStack(app, `EventPlatformStack-${environment}`, {
  environment,
  domainName,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID || undefined,
    region: process.env.CDK_DEFAULT_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1',
  },
  description: `Serverless Event Platform - ${environment} environment`,
  tags: {
    Environment: environment,
    Project: 'serverless-event-platform',
    ManagedBy: 'cdk',
  },
});

console.log(`Deploying Event Platform Stack for environment: ${environment}`);
console.log(`Account: ${process.env.CDK_DEFAULT_ACCOUNT}`);
console.log(`Region: ${process.env.CDK_DEFAULT_REGION || 'us-east-1'}`);
