# Quick Fix: CDK Credentials Issue

## The Problem
CDK v2 isn't detecting your AWS credentials even though AWS CLI works. This is because:
- AWS CLI can use SSO sessions or environment variables
- CDK v2 requires explicit credentials in a file or environment variables

## Quick Solution

### Step 1: Set Environment Variables (Easiest)

Run these commands in PowerShell **before** deploying:

```powershell
# Get your account ID
$accountId = (aws sts get-caller-identity --query Account --output text)

# Set environment variables
$env:CDK_DEFAULT_ACCOUNT = $accountId
$env:CDK_DEFAULT_REGION = "us-east-1"

# If you have access key and secret, set these too:
# $env:AWS_ACCESS_KEY_ID = "YOUR_ACCESS_KEY"
# $env:AWS_SECRET_ACCESS_KEY = "YOUR_SECRET_KEY"
```

### Step 2: If Using AWS SSO

If you're using AWS SSO, you need to login first:

```powershell
aws sso login --profile default
```

Then set the profile:
```powershell
$env:AWS_PROFILE = "default"
```

### Step 3: Create Credentials File (Alternative)

If environment variables don't work, create a credentials file:

```powershell
# Create directory
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.aws"

# Open notepad to edit
notepad "$env:USERPROFILE\.aws\credentials"
```

Add this content (replace with your actual credentials):
```ini
[default]
aws_access_key_id = YOUR_ACCESS_KEY_HERE
aws_secret_access_key = YOUR_SECRET_KEY_HERE
region = us-east-1
```

**To get your credentials:**
- Go to AWS Console → IAM → Users → Your User → Security Credentials
- Create access key if you don't have one

### Step 4: Deploy

Once credentials are set up:

```powershell
cd backend
npm run deploy
```

## Test First

Test if CDK can see credentials:
```powershell
cd backend
npx cdk list
```

If this works, you're ready to deploy!
