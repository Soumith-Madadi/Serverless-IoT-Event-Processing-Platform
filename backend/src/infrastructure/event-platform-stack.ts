import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2_integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';

export interface EventPlatformStackProps extends cdk.StackProps {
  environment: string;
  domainName?: string;
}

export class EventPlatformStack extends cdk.Stack {
  public readonly eventsTable: dynamodb.Table;
  public readonly devicesTable: dynamodb.Table;
  public readonly alertsTable: dynamodb.Table;
  public readonly commandsTable: dynamodb.Table;
  public readonly eventBucket: s3.Bucket;
  public readonly eventBus: events.EventBus;
  public readonly eventProcessorFunction: lambda.Function;
  public readonly websocketHandlerFunction: lambda.Function;
  public readonly metricsFunction: lambda.Function;
  public readonly eventsQueryFunction: lambda.Function;
  public readonly authFunction: lambda.Function;
  public readonly deviceRegistryFunction: lambda.Function;
  public readonly commandHandlerFunction: lambda.Function;
  public readonly alertProcessorFunction: lambda.Function;
  public readonly alertHandlerFunction: lambda.Function;
  public readonly notificationHandlerFunction: lambda.Function;
  public readonly apiGateway: apigateway.RestApi;
  public readonly websocketApi: apigatewayv2.WebSocketApi;
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly identityPool: cognito.CfnIdentityPool;

  constructor(scope: Construct, id: string, props: EventPlatformStackProps) {
    super(scope, id, props);

    const { environment, domainName } = props;

    this.eventsTable = new dynamodb.Table(this, 'EventsTable', {
      tableName: `${environment}-events`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: environment === 'prod',
    });

    this.eventsTable.addGlobalSecondaryIndex({
      indexName: 'SourceTimestampIndex',
      partitionKey: { name: 'source', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.eventsTable.addGlobalSecondaryIndex({
      indexName: 'TypeTimestampIndex',
      partitionKey: { name: 'type', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.eventsTable.addGlobalSecondaryIndex({
      indexName: 'DeviceTimestampIndex',
      partitionKey: { name: 'deviceId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.devicesTable = new dynamodb.Table(this, 'DevicesTable', {
      tableName: `${environment}-devices`,
      partitionKey: { name: 'deviceId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: environment === 'prod',
    });

    this.devicesTable.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'registrationDate', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.devicesTable.addGlobalSecondaryIndex({
      indexName: 'OwnerIndex',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'deviceId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.alertsTable = new dynamodb.Table(this, 'AlertsTable', {
      tableName: `${environment}-alerts`,
      partitionKey: { name: 'alertId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: environment === 'prod',
    });

    this.alertsTable.addGlobalSecondaryIndex({
      indexName: 'DeviceIndex',
      partitionKey: { name: 'deviceId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'triggeredAt', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.alertsTable.addGlobalSecondaryIndex({
      indexName: 'SeverityIndex',
      partitionKey: { name: 'severity', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'triggeredAt', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.commandsTable = new dynamodb.Table(this, 'CommandsTable', {
      tableName: `${environment}-commands`,
      partitionKey: { name: 'commandId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: environment === 'prod',
    });

    this.commandsTable.addGlobalSecondaryIndex({
      indexName: 'DeviceIndex',
      partitionKey: { name: 'deviceId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.commandsTable.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.eventBucket = new s3.Bucket(this, 'EventBucket', {
      bucketName: `${environment}-event-platform-${this.account}`,
      versioned: environment === 'prod',
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: environment !== 'prod',
      lifecycleRules: [
        {
          id: 'EventLifecycle',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
            {
              storageClass: s3.StorageClass.DEEP_ARCHIVE,
              transitionAfter: cdk.Duration.days(365),
            },
          ],
          expiration: cdk.Duration.days(2555), // 7 years
        },
      ],
    });

    this.eventBus = new events.EventBus(this, 'EventBus', {
      eventBusName: `${environment}-event-platform-bus`,
    });

    const deadLetterQueue = new sqs.Queue(this, 'EventDeadLetterQueue', {
      queueName: `${environment}-event-dlq`,
      retentionPeriod: cdk.Duration.days(14),
      visibilityTimeout: cdk.Duration.minutes(5),
    });

    this.eventProcessorFunction = new lambdaNodejs.NodejsFunction(this, 'EventProcessor', {
      functionName: `${environment}-event-processor`,
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: 'src/functions/event-processor-simple.ts',
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        EVENTS_TABLE: this.eventsTable.tableName,
        DEVICES_TABLE: this.devicesTable.tableName,
        EVENT_BUCKET: this.eventBucket.bucketName,
        EVENT_BUS_NAME: this.eventBus.eventBusName,
        ENVIRONMENT: environment,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
      deadLetterQueue,
      deadLetterQueueEnabled: true,
      bundling: {
        externalModules: ['@aws-sdk/*'],
      },
    });

    this.eventsTable.grantWriteData(this.eventProcessorFunction);
    this.devicesTable.grantWriteData(this.eventProcessorFunction);
    this.eventBucket.grantWrite(this.eventProcessorFunction);
    this.eventBus.grantPutEventsTo(this.eventProcessorFunction);

    this.websocketHandlerFunction = new lambdaNodejs.NodejsFunction(this, 'WebSocketHandler', {
      functionName: `${environment}-websocket-handler`,
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: 'src/functions/websocket-handler.ts',
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        EVENTS_TABLE: this.eventsTable.tableName,
        DEVICES_TABLE: this.devicesTable.tableName,
        COMMANDS_TABLE: this.commandsTable.tableName,
        ALERTS_TABLE: this.alertsTable.tableName,
        EVENT_BUS_NAME: this.eventBus.eventBusName,
        ENVIRONMENT: environment,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
      bundling: {
        externalModules: ['@aws-sdk/*'],
      },
    });

    this.eventsTable.grantReadData(this.websocketHandlerFunction);
    this.eventBus.grantPutEventsTo(this.websocketHandlerFunction);

    this.metricsFunction = new lambdaNodejs.NodejsFunction(this, 'MetricsFunction', {
      functionName: `${environment}-metrics-function`,
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: 'src/functions/metrics.ts',
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        EVENTS_TABLE: this.eventsTable.tableName,
        ENVIRONMENT: environment,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
      bundling: {
        externalModules: ['@aws-sdk/*'],
      },
    });

    this.eventsTable.grantReadData(this.metricsFunction);

    this.eventsQueryFunction = new lambdaNodejs.NodejsFunction(this, 'EventsQueryFunction', {
      functionName: `${environment}-events-query-function`,
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: 'src/functions/events-query.ts',
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        EVENTS_TABLE: this.eventsTable.tableName,
        ENVIRONMENT: environment,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
      bundling: {
        externalModules: ['@aws-sdk/*'],
      },
    });

    this.eventsTable.grantReadData(this.eventsQueryFunction);

    this.authFunction = new lambdaNodejs.NodejsFunction(this, 'AuthFunction', {
      functionName: `${environment}-auth-function`,
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: 'src/functions/auth.ts',
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        USER_POOL_ID: 'PLACEHOLDER',
        CLIENT_ID: 'PLACEHOLDER',
        ENVIRONMENT: environment,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
      bundling: {
        externalModules: ['@aws-sdk/*'],
      },
    });

    this.deviceRegistryFunction = new lambdaNodejs.NodejsFunction(this, 'DeviceRegistryFunction', {
      functionName: `${environment}-device-registry`,
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: 'src/functions/device-registry-handler.ts',
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        DEVICES_TABLE: this.devicesTable.tableName,
        ENVIRONMENT: environment,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
      bundling: {
        externalModules: ['@aws-sdk/*'],
      },
    });

    this.devicesTable.grantReadWriteData(this.deviceRegistryFunction);

    this.commandHandlerFunction = new lambdaNodejs.NodejsFunction(this, 'CommandHandlerFunction', {
      functionName: `${environment}-command-handler`,
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: 'src/functions/command-handler.ts',
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        DEVICES_TABLE: this.devicesTable.tableName,
        COMMANDS_TABLE: this.commandsTable.tableName,
        EVENT_BUS_NAME: this.eventBus.eventBusName,
        ENVIRONMENT: environment,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
      bundling: {
        externalModules: ['@aws-sdk/*'],
      },
    });

    this.devicesTable.grantReadData(this.commandHandlerFunction);
    this.commandsTable.grantReadWriteData(this.commandHandlerFunction);
    this.eventBus.grantPutEventsTo(this.commandHandlerFunction);

    this.alertProcessorFunction = new lambdaNodejs.NodejsFunction(this, 'AlertProcessorFunction', {
      functionName: `${environment}-alert-processor`,
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: 'src/functions/alert-processor.ts',
      handler: 'handler',
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      environment: {
        ALERTS_TABLE: this.alertsTable.tableName,
        ALERT_RULES_TABLE: this.alertsTable.tableName,
        EVENT_BUS_NAME: this.eventBus.eventBusName,
        NOTIFICATION_HANDLER_ARN: '', // Will be set after notification handler is created
        ENVIRONMENT: environment,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
      bundling: {
        externalModules: ['@aws-sdk/*'],
      },
    });

    this.alertsTable.grantReadWriteData(this.alertProcessorFunction);
    this.eventBus.grantPutEventsTo(this.alertProcessorFunction);

    this.alertHandlerFunction = new lambdaNodejs.NodejsFunction(this, 'AlertHandlerFunction', {
      functionName: `${environment}-alert-handler`,
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: 'src/functions/alert-handler.ts',
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        ALERTS_TABLE: this.alertsTable.tableName,
        ALERT_RULES_TABLE: this.alertsTable.tableName,
        ENVIRONMENT: environment,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
      bundling: {
        externalModules: ['@aws-sdk/*'],
      },
    });

    this.alertsTable.grantReadWriteData(this.alertHandlerFunction);

    this.notificationHandlerFunction = new lambdaNodejs.NodejsFunction(this, 'NotificationHandlerFunction', {
      functionName: `${environment}-notification-handler`,
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: 'src/functions/notification-handler.ts',
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        FROM_EMAIL: `noreply@${domainName || 'iot-platform.com'}`,
        API_GATEWAY_ENDPOINT: '', // Will be set after WebSocket API is created
        WEBSOCKET_API_ID: '', // Will be set after WebSocket API is created
        ENVIRONMENT: environment,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
      bundling: {
        externalModules: ['@aws-sdk/*'],
      },
    });

    // Grant SES permissions for email sending
    this.notificationHandlerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: ['*'],
      })
    );

    // Update alert processor with notification handler ARN
    this.alertProcessorFunction.addEnvironment(
      'NOTIFICATION_HANDLER_ARN',
      this.notificationHandlerFunction.functionArn
    );

    // Update WebSocket handler with new table names
    this.websocketHandlerFunction.addEnvironment('DEVICES_TABLE', this.devicesTable.tableName);
    this.websocketHandlerFunction.addEnvironment('COMMANDS_TABLE', this.commandsTable.tableName);
    this.websocketHandlerFunction.addEnvironment('ALERTS_TABLE', this.alertsTable.tableName);

    this.apiGateway = new apigateway.RestApi(this, 'EventApi', {
      restApiName: `${environment}-event-api`,
      description: 'Event Platform REST API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
      deployOptions: {
        stageName: environment,
        loggingLevel: apigateway.MethodLoggingLevel.OFF,
        dataTraceEnabled: false,
      },
    });

    const metricsIntegration = new apigateway.LambdaIntegration(this.metricsFunction);
    const metricsResource = this.apiGateway.root.addResource('metrics');
    metricsResource.addMethod('GET', metricsIntegration);

    const eventsIntegration = new apigateway.LambdaIntegration(this.eventsQueryFunction);
    const eventsResource = this.apiGateway.root.addResource('events');
    eventsResource.addMethod('GET', eventsIntegration);

    const authIntegration = new apigateway.LambdaIntegration(this.authFunction);
    const authResource = this.apiGateway.root.addResource('auth');
    
    const registerResource = authResource.addResource('register');
    registerResource.addMethod('POST', authIntegration);
    
    const loginResource = authResource.addResource('login');
    loginResource.addMethod('POST', authIntegration);
    
    const confirmResource = authResource.addResource('confirm');
    confirmResource.addMethod('POST', authIntegration);

    // Device endpoints
    const deviceIntegration = new apigateway.LambdaIntegration(this.deviceRegistryFunction);
    const devicesResource = this.apiGateway.root.addResource('devices');
    devicesResource.addMethod('GET', deviceIntegration);
    devicesResource.addMethod('POST', deviceIntegration);
    
    const deviceResource = devicesResource.addResource('{deviceId}');
    deviceResource.addMethod('GET', deviceIntegration);
    deviceResource.addMethod('PUT', deviceIntegration);
    deviceResource.addMethod('DELETE', deviceIntegration);

    // Command endpoints
    const commandIntegration = new apigateway.LambdaIntegration(this.commandHandlerFunction);
    const deviceCommandsResource = deviceResource.addResource('commands');
    deviceCommandsResource.addMethod('POST', commandIntegration);
    deviceCommandsResource.addMethod('GET', commandIntegration);

    // Alert endpoints
    const alertIntegration = new apigateway.LambdaIntegration(this.alertHandlerFunction);
    const alertsResource = this.apiGateway.root.addResource('alerts');
    alertsResource.addMethod('GET', alertIntegration);
    alertsResource.addMethod('POST', alertIntegration);
    
    const alertResource = alertsResource.addResource('{alertId}');
    alertResource.addMethod('GET', alertIntegration);
    alertResource.addMethod('PUT', alertIntegration);
    alertResource.addMethod('DELETE', alertIntegration);
    
    const activeAlertsResource = alertsResource.addResource('active');
    activeAlertsResource.addMethod('GET', alertIntegration);

    this.websocketApi = new apigatewayv2.WebSocketApi(this, 'EventWebSocketApi', {
      apiName: `${environment}-event-websocket-api`,
      connectRouteOptions: { integration: new apigatewayv2_integrations.WebSocketLambdaIntegration('ConnectHandler', this.websocketHandlerFunction) },
      disconnectRouteOptions: { integration: new apigatewayv2_integrations.WebSocketLambdaIntegration('DisconnectHandler', this.websocketHandlerFunction) },
      defaultRouteOptions: { integration: new apigatewayv2_integrations.WebSocketLambdaIntegration('DefaultHandler', this.websocketHandlerFunction) },
    });

    const websocketStage = new apigatewayv2.WebSocketStage(this, 'WebSocketStage', {
      webSocketApi: this.websocketApi,
      stageName: environment,
      autoDeploy: true,
    });

    const eventRule = new events.Rule(this, 'EventProcessingRule', {
      eventBus: this.eventBus,
      eventPattern: {
        source: ['iot_sensors', 'iot_devices', 'manual'],
        detailType: ['event'],
      },
      targets: [
        new targets.LambdaFunction(this.eventProcessorFunction, {
          deadLetterQueue,
          maxEventAge: cdk.Duration.hours(1),
          retryAttempts: 3,
        }),
      ],
    });

    // Rule for alert processing - triggered after events are processed
    const alertProcessingRule = new events.Rule(this, 'AlertProcessingRule', {
      eventBus: this.eventBus,
      eventPattern: {
        source: ['iot_sensors', 'iot_devices'],
        detailType: ['event.processed'],
      },
      targets: [
        new targets.LambdaFunction(this.alertProcessorFunction, {
          maxEventAge: cdk.Duration.hours(1),
          retryAttempts: 2,
        }),
      ],
    });

    // Rule for notification handling
    const notificationRule = new events.Rule(this, 'NotificationRule', {
      eventBus: this.eventBus,
      eventPattern: {
        source: ['iot_sensors', 'iot_devices'],
        detailType: ['alert.notification'],
      },
      targets: [
        new targets.LambdaFunction(this.notificationHandlerFunction, {
          maxEventAge: cdk.Duration.hours(1),
          retryAttempts: 2,
        }),
      ],
    });

    const dashboard = new cdk.aws_cloudwatch.Dashboard(this, 'EventPlatformDashboard', {
      dashboardName: `${environment}-event-platform-dashboard`,
    });

    dashboard.addWidgets(
      new cdk.aws_cloudwatch.GraphWidget({
        title: 'Event Processing Metrics',
        left: [
          this.eventProcessorFunction.metricInvocations(),
          this.eventProcessorFunction.metricErrors(),
        ],
        right: [
          this.eventProcessorFunction.metricDuration(),
        ],
      }),
      new cdk.aws_cloudwatch.GraphWidget({
        title: 'DynamoDB Metrics',
        left: [
          this.eventsTable.metricConsumedReadCapacityUnits(),
          this.eventsTable.metricConsumedWriteCapacityUnits(),
        ],
        right: [
          this.eventsTable.metricThrottledRequests(),
        ],
      }),
      new cdk.aws_cloudwatch.GraphWidget({
        title: 'WebSocket Connections',
        left: [
          this.websocketHandlerFunction.metricInvocations(),
        ],
      })
    );


    this.userPool = new cognito.UserPool(this, 'EventPlatformUserPool', {
      userPoolName: `${environment}-event-platform-users`,
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
        username: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        givenName: {
          required: false,
          mutable: true,
        },
        familyName: {
          required: false,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    this.userPoolClient = new cognito.UserPoolClient(this, 'EventPlatformUserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: `${environment}-event-platform-web-client`,
      generateSecret: false,
      authFlows: {
        adminUserPassword: true,
        userPassword: true,
        userSrp: true,
        custom: true,
      },
      oAuth: {
        flows: {
          implicitCodeGrant: true,
          authorizationCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: [
          'http://localhost:3000',
          'https://localhost:3000',
        ],
        logoutUrls: [
          'http://localhost:3000',
          'https://localhost:3000',
        ],
      },
      preventUserExistenceErrors: true,
    });

    this.identityPool = new cognito.CfnIdentityPool(this, 'EventPlatformIdentityPool', {
      identityPoolName: `${environment}-event-platform-identity-pool`,
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [
        {
          clientId: this.userPoolClient.userPoolClientId,
          providerName: this.userPool.userPoolProviderName,
        },
      ],
    });

    const authenticatedRole = new iam.Role(this, 'CognitoAuthenticatedRole', {
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': this.identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'authenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
    });

    this.eventsTable.grantReadData(authenticatedRole);
    this.eventBucket.grantRead(authenticatedRole);

    new cognito.CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoleAttachment', {
      identityPoolId: this.identityPool.ref,
      roles: {
        authenticated: authenticatedRole.roleArn,
      },
    });

    this.authFunction.addEnvironment('USER_POOL_ID', this.userPool.userPoolId);
    this.authFunction.addEnvironment('CLIENT_ID', this.userPoolClient.userPoolClientId);
    this.userPool.grant(this.authFunction, 'cognito-idp:AdminCreateUser', 'cognito-idp:AdminSetUserPassword', 'cognito-idp:AdminInitiateAuth', 'cognito-idp:AdminRespondToAuthChallenge');

    new cdk.CfnOutput(this, 'EventsTableName', {
      value: this.eventsTable.tableName,
      description: 'DynamoDB Events Table Name',
    });

    new cdk.CfnOutput(this, 'EventBucketName', {
      value: this.eventBucket.bucketName,
      description: 'S3 Event Bucket Name',
    });

    new cdk.CfnOutput(this, 'EventBusName', {
      value: this.eventBus.eventBusName,
      description: 'EventBridge Event Bus Name',
    });

    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: this.apiGateway.url,
      description: 'REST API Gateway URL',
    });

    new cdk.CfnOutput(this, 'WebSocketApiUrl', {
      value: websocketStage.url,
      description: 'WebSocket API Gateway URL',
    });

    new cdk.CfnOutput(this, 'EventProcessorFunctionName', {
      value: this.eventProcessorFunction.functionName,
      description: 'Event Processor Lambda Function Name',
    });

    new cdk.CfnOutput(this, 'WebSocketHandlerFunctionName', {
      value: this.websocketHandlerFunction.functionName,
      description: 'WebSocket Handler Lambda Function Name',
    });

    new cdk.CfnOutput(this, 'MetricsFunctionName', {
      value: this.metricsFunction.functionName,
      description: 'Metrics Lambda Function Name',
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
    });

    new cdk.CfnOutput(this, 'IdentityPoolId', {
      value: this.identityPool.ref,
      description: 'Cognito Identity Pool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolDomain', {
      value: `${environment}-event-platform-users.auth.${this.region}.amazoncognito.com`,
      description: 'Cognito User Pool Domain',
    });
  }
}
