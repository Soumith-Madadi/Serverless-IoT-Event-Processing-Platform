# IoT Platform Verification Guide

This guide will help you verify that all components of the IoT platform are working correctly.

## Prerequisites Checklist

- [ ] Node.js 18+ installed
- [ ] AWS CLI configured with credentials
- [ ] AWS CDK installed (`npm install -g aws-cdk`)
- [ ] Dependencies installed (`npm run install:all`)

## Step 1: Build the Backend

First, ensure the TypeScript code compiles without errors:

```bash
cd backend
npm run build
```

**Expected Output:**
- No TypeScript compilation errors
- `dist/` directory created with compiled JavaScript files
- All Lambda functions compiled successfully

**Common Issues:**
- Missing dependencies: Run `npm install` in backend directory
- Type errors: Check that all imports are correct

## Step 2: Verify Infrastructure Code

Check for CDK syntax errors:

```bash
cd backend
npx cdk synth
```

**Expected Output:**
- CloudFormation template generated successfully
- No CDK construct errors

## Step 3: Deploy Infrastructure

Deploy the AWS infrastructure (this creates resources and may incur costs):

```bash
cd backend

# First time only: Bootstrap CDK
npx cdk bootstrap

# Deploy all infrastructure
npm run deploy
# OR
npx cdk deploy --all
```

**Expected Output:**
- All stacks deployed successfully
- Outputs showing:
  - API Gateway URL
  - WebSocket API URL
  - Cognito User Pool ID
  - Table names

**Verify in AWS Console:**
1. **DynamoDB Tables:**
   - `{env}-events` ✓
   - `{env}-devices` ✓
   - `{env}-alerts` ✓
   - `{env}-commands` ✓

2. **Lambda Functions:**
   - `{env}-event-processor` ✓
   - `{env}-websocket-handler` ✓
   - `{env}-device-registry` ✓
   - `{env}-command-handler` ✓
   - `{env}-alert-processor` ✓
   - `{env}-notification-handler` ✓
   - `{env}-metrics-function` ✓
   - `{env}-auth-function` ✓

3. **API Gateway:**
   - REST API with `/devices`, `/alerts`, `/commands` endpoints ✓
   - WebSocket API ✓

4. **EventBridge:**
   - Custom event bus created ✓
   - Rules for event processing, alerts, notifications ✓

## Step 4: Test Backend Functions

### 4.1 Test Device Registry

```bash
# Get API Gateway URL from CDK outputs
API_URL="https://your-api-id.execute-api.us-east-1.amazonaws.com/dev"

# Register a test device
curl -X POST "$API_URL/devices" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "test-device-001",
    "name": "Test Temperature Sensor",
    "type": "temperature",
    "status": "active",
    "registrationDate": '$(date +%s000)'
  }'

# List devices
curl "$API_URL/devices"

# Get specific device
curl "$API_URL/devices/test-device-001"
```

**Expected:**
- Device registered successfully (201 status)
- Device appears in list
- Device details returned correctly

### 4.2 Test Command Handler

```bash
# Send a command to device
curl -X POST "$API_URL/devices/test-device-001/commands" \
  -H "Content-Type: application/json" \
  -d '{
    "commandType": "control",
    "commandName": "status",
    "parameters": {}
  }'

# Get command history
curl "$API_URL/devices/test-device-001/commands"
```

**Expected:**
- Command created (201 status)
- Command appears in history
- Command status tracked

### 4.3 Test Event Processing

Start the data ingestion to generate IoT events:

```bash
cd backend

# Set environment variables
export EVENT_BUS_NAME="dev-event-platform-bus"
export AWS_REGION="us-east-1"

# Start ingestion
npm run start:ingestion
```

**Expected:**
- Adapter starts successfully
- Events being sent to EventBridge
- Events processed and stored in DynamoDB

**Verify in AWS Console:**
- CloudWatch Logs show events being processed
- DynamoDB Events table has new entries
- Device status updated in Devices table

## Step 5: Test Frontend

### 5.1 Build Frontend

```bash
cd frontend
npm run build
```

**Expected:**
- Build completes without errors
- `build/` directory created

### 5.2 Configure Environment Variables

Create `.env` file in `frontend/` directory:

```env
REACT_APP_API_URL=https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/dev
REACT_APP_WEBSOCKET_URL=wss://your-websocket-api-id.execute-api.us-east-1.amazonaws.com/dev
```

### 5.3 Start Frontend

```bash
cd frontend
npm start
```

**Expected:**
- Frontend starts on `http://localhost:3000`
- No console errors
- Login/Register page accessible

## Step 6: End-to-End Testing

### 6.1 Authentication Flow

1. Navigate to `http://localhost:3000/auth`
2. Register a new user
3. Login with credentials
4. Verify redirect to dashboard

**Expected:**
- User registration successful
- Login successful
- JWT token stored
- Protected routes accessible

### 6.2 Device Management

1. Navigate to `/devices`
2. Register a new device (if UI available)
3. View device list
4. View device details

**Expected:**
- Devices page loads
- Device list displays
- Device details show correctly

### 6.3 Command & Control

1. Navigate to `/commands`
2. Select a device
3. Send a command
4. View command history

**Expected:**
- Command sent successfully
- Command appears in history
- Status updates correctly

### 6.4 Alerts

1. Navigate to `/alerts`
2. View active alerts
3. Create alert rule (if UI available)
4. Acknowledge/resolve alerts

**Expected:**
- Alerts page loads
- Active alerts display
- Alert rules list shows

### 6.5 Real-Time Updates

1. Start data ingestion (`npm run start:ingestion` in backend)
2. Open dashboard
3. Verify WebSocket connection (green indicator)
4. Watch for real-time event updates

**Expected:**
- WebSocket connects (green "Connected" indicator)
- Events appear in real-time
- Dashboard metrics update
- Device status updates

### 6.6 Dashboard Metrics

1. Navigate to `/` (Dashboard)
2. Verify metrics display:
   - Total Events
   - Active Devices
   - Recent Events
   - Charts update

**Expected:**
- Metrics display correctly
- Charts render
- Real-time updates work

## Step 7: Verify Data Flow

### 7.1 Telemetry Flow

```
IoT Adapter → EventBridge → Event Processor → DynamoDB → WebSocket → Dashboard
```

**Verify:**
1. Events appear in DynamoDB Events table
2. Device status updated in Devices table
3. Events stream to dashboard via WebSocket

### 7.2 Command Flow

```
Dashboard → API Gateway → Command Handler → EventBridge → Device Adapter
```

**Verify:**
1. Command stored in Commands table
2. Command event published to EventBridge
3. Command status updates

### 7.3 Alert Flow

```
Event Processor → Alert Processor → Notification Handler → (UI/Email/Webhook)
```

**Verify:**
1. Alert rules evaluated
2. Alerts created in Alerts table
3. Notifications triggered (check CloudWatch Logs)

## Step 8: Check CloudWatch Logs

Verify Lambda functions are executing correctly:

```bash
# Check event processor logs
aws logs tail /aws/lambda/dev-event-processor --follow

# Check device registry logs
aws logs tail /aws/lambda/dev-device-registry --follow

# Check command handler logs
aws logs tail /aws/lambda/dev-command-handler --follow

# Check alert processor logs
aws logs tail /aws/lambda/dev-alert-processor --follow
```

**Expected:**
- No error messages
- Events being processed
- Functions executing successfully

## Step 9: Verify Database Tables

### 9.1 Check Events Table

```bash
aws dynamodb scan --table-name dev-events --limit 5
```

**Expected:**
- Events stored with deviceId
- Proper schema structure
- TTL set correctly

### 9.2 Check Devices Table

```bash
aws dynamodb scan --table-name dev-devices --limit 5
```

**Expected:**
- Devices registered
- Status fields populated
- Last seen timestamps updating

### 9.3 Check Commands Table

```bash
aws dynamodb scan --table-name dev-commands --limit 5
```

**Expected:**
- Commands stored
- Status tracking working
- Timestamps correct

### 9.4 Check Alerts Table

```bash
aws dynamodb scan --table-name dev-alerts --limit 5
```

**Expected:**
- Alert instances created
- Alert rules stored
- Status tracking working

## Step 10: Common Issues & Troubleshooting

### Issue: TypeScript Compilation Errors

**Solution:**
```bash
cd backend
rm -rf dist node_modules
npm install
npm run build
```

### Issue: CDK Deployment Fails

**Check:**
- AWS credentials configured (`aws sts get-caller-identity`)
- CDK bootstrapped (`npx cdk bootstrap`)
- IAM permissions sufficient

### Issue: Lambda Functions Not Found

**Solution:**
- Ensure `npm run build` completed successfully
- Check `dist/` directory has compiled files
- Verify handler paths in CDK stack

### Issue: API Gateway Returns 500

**Check:**
- CloudWatch Logs for Lambda errors
- IAM permissions for Lambda functions
- Environment variables set correctly

### Issue: WebSocket Not Connecting

**Check:**
- WebSocket API URL correct
- CORS configured
- WebSocket handler Lambda has proper permissions
- Connection stored in DynamoDB (if using connection table)

### Issue: No Events Appearing

**Check:**
- Data ingestion script running
- EventBridge event bus name correct
- EventBridge rules configured
- Lambda function permissions

### Issue: Frontend API Calls Failing

**Check:**
- `.env` file configured correctly
- API Gateway URL correct
- CORS enabled on API Gateway
- Authentication token valid

## Step 11: Performance Verification

### 11.1 Latency Test

```bash
# Test API response time
time curl "$API_URL/devices"
```

**Expected:** < 500ms response time

### 11.2 Throughput Test

Monitor CloudWatch metrics:
- Lambda invocations
- DynamoDB read/write capacity
- API Gateway request count

**Expected:**
- Functions scaling automatically
- No throttling errors

## Step 12: Security Verification

### 12.1 Authentication

- [ ] Unauthenticated requests to protected endpoints fail
- [ ] JWT tokens validated correctly
- [ ] Token expiration handled

### 12.2 IAM Permissions

- [ ] Lambda functions have least privilege
- [ ] DynamoDB access restricted
- [ ] S3 bucket policies correct

## Success Criteria

✅ All backend code compiles without errors  
✅ Infrastructure deploys successfully  
✅ All DynamoDB tables created  
✅ All Lambda functions deployed  
✅ API Gateway endpoints accessible  
✅ WebSocket connection works  
✅ Frontend builds and runs  
✅ Authentication flow works  
✅ Device management functional  
✅ Commands send and track correctly  
✅ Alerts process and notify  
✅ Real-time updates working  
✅ No errors in CloudWatch Logs  

## Next Steps

Once verification is complete:

1. **Production Deployment:**
   - Update environment to `prod`
   - Configure custom domain
   - Set up monitoring and alerts
   - Enable CloudWatch alarms

2. **Optimization:**
   - Review Lambda cold starts
   - Optimize DynamoDB queries
   - Configure auto-scaling
   - Set up cost monitoring

3. **Documentation:**
   - Update API documentation
   - Create user guides
   - Document deployment process

## Quick Test Script

Save this as `test-platform.sh`:

```bash
#!/bin/bash

echo "🔍 Testing IoT Platform..."

# Build backend
echo "📦 Building backend..."
cd backend && npm run build && cd ..

# Check CDK
echo "☁️  Checking CDK..."
cd backend && npx cdk synth > /dev/null && echo "✅ CDK valid" || echo "❌ CDK errors"

# Build frontend
echo "📦 Building frontend..."
cd frontend && npm run build > /dev/null && echo "✅ Frontend builds" || echo "❌ Frontend errors"

echo "✅ Basic checks complete!"
```

Run with: `chmod +x test-platform.sh && ./test-platform.sh`
