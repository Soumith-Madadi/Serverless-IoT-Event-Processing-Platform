# IoT Platform Testing Checklist

Use this checklist to systematically verify all components.

## Pre-Deployment Checks

- [ ] Backend TypeScript compiles (`cd backend && npm run build`)
- [ ] Frontend TypeScript compiles (`cd frontend && npm run build`)
- [ ] No linter errors (`npm run lint`)
- [ ] CDK synthesizes successfully (`cd backend && npx cdk synth`)

## Infrastructure Deployment

- [ ] CDK bootstrapped (`npx cdk bootstrap`)
- [ ] Infrastructure deployed (`npm run deploy:infrastructure`)
- [ ] All stacks created successfully
- [ ] API Gateway URLs noted

## DynamoDB Tables

- [ ] `{env}-events` table exists
- [ ] `{env}-devices` table exists
- [ ] `{env}-alerts` table exists
- [ ] `{env}-commands` table exists
- [ ] All GSIs created correctly

## Lambda Functions

- [ ] `{env}-event-processor` deployed
- [ ] `{env}-websocket-handler` deployed
- [ ] `{env}-device-registry` deployed
- [ ] `{env}-command-handler` deployed
- [ ] `{env}-alert-processor` deployed
- [ ] `{env}-notification-handler` deployed
- [ ] `{env}-metrics-function` deployed
- [ ] `{env}-auth-function` deployed

## API Endpoints

### Device Management
- [ ] `GET /devices` - List devices
- [ ] `GET /devices/{id}` - Get device
- [ ] `POST /devices` - Register device
- [ ] `PUT /devices/{id}` - Update device
- [ ] `DELETE /devices/{id}` - Deactivate device

### Commands
- [ ] `POST /devices/{id}/commands` - Send command
- [ ] `GET /devices/{id}/commands` - Command history

### Alerts
- [ ] `GET /alerts` - List alert rules
- [ ] `POST /alerts` - Create alert rule

## WebSocket

- [ ] WebSocket API created
- [ ] Connection endpoint works
- [ ] Subscribe to devices works
- [ ] Subscribe to alerts works
- [ ] Real-time events stream

## Frontend

- [ ] Frontend builds successfully
- [ ] Environment variables configured
- [ ] Frontend starts without errors
- [ ] All routes accessible
- [ ] Navigation works

## Authentication

- [ ] User registration works
- [ ] User login works
- [ ] JWT tokens issued
- [ ] Protected routes enforce auth
- [ ] Token refresh works

## Device Management (UI)

- [ ] Devices page loads
- [ ] Device list displays
- [ ] Device registration form works
- [ ] Device details view works
- [ ] Device status updates

## Commands (UI)

- [ ] Commands page loads
- [ ] Device selection works
- [ ] Command sending works
- [ ] Command history displays
- [ ] Command status updates

## Alerts (UI)

- [ ] Alerts page loads
- [ ] Active alerts display
- [ ] Alert rules list shows
- [ ] Alert acknowledgment works
- [ ] Alert resolution works

## Dashboard

- [ ] Dashboard loads
- [ ] Metrics display correctly
- [ ] Charts render
- [ ] Real-time updates work
- [ ] Event timeline shows data

## Data Flow

- [ ] IoT adapter generates events
- [ ] Events reach EventBridge
- [ ] Events processed by Lambda
- [ ] Events stored in DynamoDB
- [ ] Events stream to frontend
- [ ] Device status updates

## Alert Processing

- [ ] Alert rules evaluated
- [ ] Alerts created when conditions met
- [ ] UI notifications sent
- [ ] Email notifications sent (if configured)
- [ ] Webhook notifications sent (if configured)

## Command Processing

- [ ] Commands validated
- [ ] Commands stored
- [ ] Commands published to EventBridge
- [ ] Command status tracked
- [ ] Command history queryable

## Performance

- [ ] API response time < 500ms
- [ ] WebSocket latency < 100ms
- [ ] No Lambda timeouts
- [ ] No DynamoDB throttling
- [ ] Functions scale automatically

## Security

- [ ] Unauthenticated requests blocked
- [ ] JWT validation works
- [ ] IAM roles least privilege
- [ ] DynamoDB encryption enabled
- [ ] S3 bucket policies correct

## Monitoring

- [ ] CloudWatch Logs accessible
- [ ] No error logs in Lambda functions
- [ ] Metrics available in CloudWatch
- [ ] API Gateway logs enabled

## Cleanup (Optional)

- [ ] Test data cleaned up
- [ ] Unused resources removed
- [ ] Cost monitoring set up

---

**Status Legend:**
- ✅ Working
- ⚠️  Needs attention
- ❌ Not working
- ⏸️  Not tested

**Notes Section:**
_Add any issues or observations here_
