# Backend Setup - Troubleshooting CDK Credentials

## Current Issue

CDK is not detecting your AWS credentials even though AWS CLI works. This is a common issue on Windows with CDK v2.

## Solution Options

### Option 1: Create AWS Credentials File (Recommended)

CDK v2 requires credentials in the standard AWS credentials file. Even though AWS CLI works, CDK needs explicit credentials.

1. **Create the credentials file:**
   ```powershell
   # Create .aws directory if it doesn't exist
   New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.aws"
   
   # Create credentials file
   notepad "$env:USERPROFILE\.aws\credentials"
   ```

2. **Add your credentials in this format:**
   ```ini
   [default]
   aws_access_key_id = YOUR_ACCESS_KEY_ID
   aws_secret_access_key = YOUR_SECRET_ACCESS_KEY
   region = us-east-1
   ```

3. **Get your credentials:**
   - If you don't have them saved, you can get them from AWS Console:
     - Go to IAM → Users → Your User → Security Credentials
     - Create new access key if needed
   - Or if using SSO, you may need to configure SSO credentials differently

### Option 2: Use Environment Variables

Set credentials as environment variables before running CDK:

```powershell
$env:AWS_ACCESS_KEY_ID = "YOUR_ACCESS_KEY_ID"
$env:AWS_SECRET_ACCESS_KEY = "YOUR_SECRET_ACCESS_KEY"
$env:AWS_DEFAULT_REGION = "us-east-1"
$env:CDK_DEFAULT_ACCOUNT = "118903272814"
$env:CDK_DEFAULT_REGION = "us-east-1"

cd backend
npm run deploy
```

### Option 3: Use AWS SSO (If Applicable)

If you're using AWS SSO, you need to configure it for CDK:

```powershell
aws configure sso
```

Then use the profile:
```powershell
$env:AWS_PROFILE = "your-sso-profile-name"
cd backend
npm run deploy
```

## After Setting Up Credentials

Once credentials are configured:

1. **Bootstrap CDK (first time only):**
   ```powershell
   cd backend
   npx cdk bootstrap
   ```

2. **Deploy the infrastructure:**
   ```powershell
   npm run deploy
   ```

3. **Note the outputs** - CDK will output API Gateway URLs and Cognito details that you'll need for the frontend `.env` file.

## Quick Test

Test if CDK can see your credentials:
```powershell
cd backend
npx cdk list
```

If this works without errors, credentials are configured correctly.

## Need Help?

If you're still having issues:
1. Check AWS CLI works: `aws sts get-caller-identity`
2. Verify credentials file exists: `Test-Path $env:USERPROFILE\.aws\credentials`
3. Check environment variables: `$env:AWS_ACCESS_KEY_ID`
