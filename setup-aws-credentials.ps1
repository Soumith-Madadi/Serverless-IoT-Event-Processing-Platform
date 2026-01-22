# AWS Credentials Setup Script for CDK
# This script helps set up AWS credentials for CDK deployment

Write-Host "🔧 Setting up AWS credentials for CDK..." -ForegroundColor Cyan

# Check if AWS CLI is configured
Write-Host "`n📋 Checking AWS CLI configuration..." -ForegroundColor Yellow
$awsIdentity = aws sts get-caller-identity 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ AWS CLI is not configured. Please run 'aws configure' first." -ForegroundColor Red
    exit 1
}

Write-Host "✅ AWS CLI is configured" -ForegroundColor Green
Write-Host $awsIdentity

# Check if credentials file exists
$credentialsPath = "$env:USERPROFILE\.aws\credentials"
$configPath = "$env:USERPROFILE\.aws\config"

Write-Host "`n📁 Checking credentials file..." -ForegroundColor Yellow
if (Test-Path $credentialsPath) {
    Write-Host "✅ Credentials file exists at: $credentialsPath" -ForegroundColor Green
} else {
    Write-Host "⚠️  Credentials file not found. Creating directory..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.aws" | Out-Null
    
    Write-Host "`n📝 You need to create a credentials file." -ForegroundColor Yellow
    Write-Host "Please run one of the following:" -ForegroundColor Yellow
    Write-Host "  1. aws configure (if you have access key and secret)" -ForegroundColor Cyan
    Write-Host "  2. aws configure sso (if using AWS SSO)" -ForegroundColor Cyan
    Write-Host "`nOr manually create: $credentialsPath" -ForegroundColor Yellow
    Write-Host "With this format:" -ForegroundColor Yellow
    Write-Host "  [default]" -ForegroundColor Gray
    Write-Host "  aws_access_key_id = YOUR_ACCESS_KEY" -ForegroundColor Gray
    Write-Host "  aws_secret_access_key = YOUR_SECRET_KEY" -ForegroundColor Gray
    Write-Host "  region = us-east-1" -ForegroundColor Gray
}

# Set environment variables for CDK
Write-Host "`n🔐 Setting CDK environment variables..." -ForegroundColor Yellow
$accountId = (aws sts get-caller-identity --query Account --output text)
$region = (aws configure get region)

if ($accountId) {
    $env:CDK_DEFAULT_ACCOUNT = $accountId
    $env:CDK_DEFAULT_REGION = if ($region) { $region } else { "us-east-1" }
    Write-Host "✅ Set CDK_DEFAULT_ACCOUNT=$accountId" -ForegroundColor Green
    Write-Host "✅ Set CDK_DEFAULT_REGION=$($env:CDK_DEFAULT_REGION)" -ForegroundColor Green
} else {
    Write-Host "⚠️  Could not determine AWS account ID" -ForegroundColor Yellow
}

Write-Host "`n✅ Setup complete!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "  1. Ensure credentials file exists (see above)" -ForegroundColor White
Write-Host "  2. Run: cd backend" -ForegroundColor White
Write-Host "  3. Run: npm run deploy" -ForegroundColor White
