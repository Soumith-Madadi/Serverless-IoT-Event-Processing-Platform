# Deployment Information

## ✅ Backend Successfully Deployed!

Your AWS infrastructure has been deployed successfully. Here are the important details:

### API Endpoints

- **REST API Gateway**: `https://3a1se6dgh6.execute-api.us-east-1.amazonaws.com/dev/`
- **WebSocket API**: `wss://eanj0oiqt2.execute-api.us-east-1.amazonaws.com/dev`

### Authentication (Cognito)

- **User Pool ID**: `us-east-1_pbqKh3sBt`
- **User Pool Client ID**: `6ftj0avc1o8kd22c20cn07ukrh`
- **Identity Pool ID**: `us-east-1:0b6ac8c2-1683-4455-ba2c-77babf8f50fa`
- **Cognito Domain**: `dev-event-platform-users.auth.us-east-1.amazoncognito.com`

### AWS Resources Created

- ✅ **DynamoDB Table**: `dev-events` (Event storage)
- ✅ **S3 Bucket**: `dev-event-platform-118903272814` (Cold storage)
- ✅ **EventBridge Bus**: `dev-event-platform-bus` (Event routing)
- ✅ **Lambda Functions**:
  - `dev-event-processor` (Processes events from EventBridge)
  - `dev-websocket-handler` (Handles WebSocket connections)
  - `dev-metrics-function` (Provides metrics API)
  - Auth function (Handles authentication)
- ✅ **API Gateway**: REST API for HTTP endpoints
- ✅ **API Gateway V2**: WebSocket API for real-time connections
- ✅ **Cognito User Pool**: User authentication and management
- ✅ **CloudWatch Dashboard**: Monitoring and metrics

### Environment Variables

The frontend `.env` file has been created with all necessary configuration.

## Next Steps

1. **Start the frontend**:
   ```bash
   npm run start:frontend
   ```

2. **Start data ingestion** (in a separate terminal):
   ```bash
   npm run start:ingestion
   ```

3. **Test the application**:
   - Open `http://localhost:3000`
   - Navigate to `/auth` to register/login
   - Access the dashboard to see real-time events

## API Endpoints

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/confirm` - Account confirmation

### Metrics
- `GET /metrics` - Platform metrics

### WebSocket
- Connect to: `wss://eanj0oiqt2.execute-api.us-east-1.amazonaws.com/dev`
- Routes: `$connect`, `$disconnect`, `$default`

## Important Notes

⚠️ **Security**: Your AWS credentials are stored in:
- `~/.aws/credentials` (credentials file)
- Environment variables (for this session)

🔒 **Best Practice**: Consider rotating your access keys regularly and never commit credentials to version control.

💰 **Cost Monitoring**: Monitor your AWS usage in the AWS Console. This setup uses:
- Lambda (free tier: 1M requests/month)
- DynamoDB (free tier: 25GB storage)
- API Gateway (free tier: 1M requests/month)
- S3 (free tier: 5GB storage)
- Cognito (free tier: 50K MAU)

## Cleanup

To remove all AWS resources:
```bash
cd backend
npx cdk destroy
```

This will delete all created resources and stop any charges.
