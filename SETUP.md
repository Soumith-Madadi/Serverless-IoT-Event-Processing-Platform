# Setup Guide - Serverless Event Platform

## ✅ Prerequisites Checklist

- [x] Node.js 18+ (you have v24.11.1)
- [x] npm 9+ (you have v11.6.2)
- [x] AWS CLI configured (you have it configured)
- [x] AWS CDK installed (you have v2.1100.1)
- [x] Dependencies installed (already done)

## Quick Start Options

### Option 1: Frontend Only (UI Development)

The frontend is already starting! You can view it at `http://localhost:3000`

To run it again manually:
```bash
npm run start:frontend
```

**Note:** The frontend will run but won't have backend connectivity without the AWS infrastructure deployed.

---

### Option 2: Full Stack Setup (Recommended)

This requires deploying AWS infrastructure. **Note:** This will create AWS resources and may incur costs.

#### Step 1: Bootstrap CDK (First Time Only)

CDK needs to be bootstrapped in your AWS account/region before first deployment:

```bash
cd backend
npx cdk bootstrap aws://ACCOUNT-ID/REGION
```

Replace:
- `ACCOUNT-ID` with your AWS account ID (you have: `118903272814`)
- `REGION` with your region (default: `us-east-1`)

Or bootstrap in your current region:
```bash
npx cdk bootstrap
```

#### Step 2: Build Backend

```bash
cd backend
npm run build
```

#### Step 3: Deploy Infrastructure

Deploy the AWS infrastructure (DynamoDB, Lambda, API Gateway, Cognito, etc.):

```bash
# From backend directory
npm run deploy

# Or from root directory
npm run deploy:infrastructure
```

This will:
- Create DynamoDB tables
- Create Lambda functions
- Create API Gateway (REST + WebSocket)
- Create Cognito User Pool for authentication
- Create EventBridge event bus
- Create S3 buckets
- Set up IAM roles and policies

**Expected Time:** 5-15 minutes depending on AWS service creation time.

#### Step 4: Note Environment Variables

After deployment, CDK will output the API Gateway URLs. You'll need to set these as environment variables for the frontend:

Create a `.env` file in the `frontend` directory:
```env
REACT_APP_API_URL=https://your-api-gateway-url
REACT_APP_WEBSOCKET_URL=wss://your-websocket-url
REACT_APP_COGNITO_USER_POOL_ID=your-user-pool-id
REACT_APP_COGNITO_USER_POOL_CLIENT_ID=your-client-id
REACT_APP_REGION=us-east-1
```

#### Step 5: Start Data Ingestion

In a new terminal, start the event ingestion script:

```bash
npm run start:ingestion
```

This will start sending simulated events (stock market, IoT sensors) to EventBridge.

#### Step 6: Start Frontend (if not already running)

```bash
npm run start:frontend
```

The frontend will be available at `http://localhost:3000`

---

## Development Workflow

### Run Everything Together

```bash
# Start both frontend and ingestion together
npm run dev
```

### Individual Commands

```bash
# Build backend
npm run build:backend

# Build frontend
npm run build:frontend

# Start frontend only
npm run start:frontend

# Start ingestion only
npm run start:ingestion

# Deploy infrastructure
npm run deploy:infrastructure
```

---

## Environment Variables

### Backend (Optional)

The backend scripts can use these environment variables:

```bash
export EVENT_BUS_NAME=dev-event-platform-bus
export AWS_REGION=us-east-1
```

### Frontend (Required for Full Functionality)

Create `frontend/.env`:

```env
REACT_APP_API_URL=https://your-api-gateway-url
REACT_APP_WEBSOCKET_URL=wss://your-websocket-url
REACT_APP_COGNITO_USER_POOL_ID=your-user-pool-id
REACT_APP_COGNITO_USER_POOL_CLIENT_ID=your-client-id
REACT_APP_REGION=us-east-1
```

**Note:** These values will be output after deploying the CDK stack.

---

## Troubleshooting

### CDK Bootstrap Issues

If you get errors about CDK not being bootstrapped:
```bash
cd backend
npx cdk bootstrap
```

### Build Errors

If TypeScript compilation fails:
```bash
cd backend
npm run build
```

Check for TypeScript errors and fix them.

### AWS Credentials

If you get AWS credential errors:
```bash
aws configure
```

Verify your credentials:
```bash
aws sts get-caller-identity
```

### Frontend Won't Connect to Backend

1. Make sure the backend is deployed
2. Check that environment variables are set correctly
3. Verify the API Gateway URLs are correct
4. Check browser console for connection errors

### Port Already in Use

If port 3000 is already in use, React will automatically try the next available port (3001, 3002, etc.)

---

## First-Time User Experience

After deploying and starting the application:

1. Navigate to `http://localhost:3000`
2. Go to the `/auth` page
3. Register a new account
4. Confirm your email (if email verification is enabled)
5. Login with your credentials
6. Access the dashboard to see real-time events

---

## Cost Considerations

This project uses AWS free tier compatible services:
- Lambda: 1M free requests/month
- DynamoDB: 25GB free storage
- API Gateway: 1M free requests/month
- S3: 5GB free storage
- Cognito: 50K MAU free

**Important:** Always monitor your AWS usage to avoid unexpected charges. Use `cdk destroy` to remove all resources when not needed.

---

## Clean Up

To remove all AWS resources:

```bash
cd backend
npm run destroy
```

This will delete all created resources.

---

## Next Steps

1. ✅ Dependencies installed
2. ⏭️ Bootstrap CDK (if deploying to AWS)
3. ⏭️ Deploy infrastructure
4. ⏭️ Set environment variables
5. ⏭️ Start ingestion
6. ⏭️ Start frontend
7. ⏭️ Register and test authentication
8. ⏭️ View real-time events on dashboard

---

## Need Help?

- Check the README.md for more details
- Review AWS CloudWatch logs for Lambda function errors
- Check browser console for frontend errors
- Verify environment variables are correctly set
