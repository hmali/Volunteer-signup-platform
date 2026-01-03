#!/bin/bash
# Quick AWS Setup Script - Creates minimal infrastructure
# Run this from your LOCAL machine (requires AWS CLI configured)

set -e

echo "🚀 AWS Infrastructure Setup for Volunteer Signup Platform"
echo "=========================================================="
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first:"
    echo "   brew install awscli  # macOS"
    echo "   Then run: aws configure"
    exit 1
fi

# Check if AWS is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS CLI is not configured. Please run: aws configure"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "✓ AWS Account: $ACCOUNT_ID"
echo ""

# Prompt for configuration
read -p "Enter AWS Region (default: us-east-1): " AWS_REGION
AWS_REGION=${AWS_REGION:-us-east-1}

read -p "Enter S3 bucket name (must be globally unique): " BUCKET_NAME
if [ -z "$BUCKET_NAME" ]; then
    echo "❌ Bucket name is required"
    exit 1
fi

read -p "Enter sender email for SES: " SES_EMAIL
if [ -z "$SES_EMAIL" ]; then
    echo "❌ Email is required"
    exit 1
fi

echo ""
echo "📝 Configuration:"
echo "   Region: $AWS_REGION"
echo "   S3 Bucket: $BUCKET_NAME"
echo "   SES Email: $SES_EMAIL"
echo ""
read -p "Proceed with setup? (y/N): " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "Setup cancelled"
    exit 0
fi

echo ""
echo "🔨 Creating AWS Resources..."

# 1. Create S3 Bucket
echo "1️⃣  Creating S3 bucket: $BUCKET_NAME"
if aws s3 ls "s3://$BUCKET_NAME" 2>&1 | grep -q 'NoSuchBucket'; then
    aws s3api create-bucket \
        --bucket "$BUCKET_NAME" \
        --region "$AWS_REGION" \
        $([ "$AWS_REGION" != "us-east-1" ] && echo "--create-bucket-configuration LocationConstraint=$AWS_REGION") \
        2>/dev/null || echo "Bucket may already exist"
    
    # Enable versioning
    aws s3api put-bucket-versioning \
        --bucket "$BUCKET_NAME" \
        --versioning-configuration Status=Enabled
    
    # Enable encryption
    aws s3api put-bucket-encryption \
        --bucket "$BUCKET_NAME" \
        --server-side-encryption-configuration '{
            "Rules": [{
                "ApplyServerSideEncryptionByDefault": {
                    "SSEAlgorithm": "AES256"
                }
            }]
        }'
    
    echo "   ✓ S3 bucket created and configured"
else
    echo "   ⚠ Bucket already exists, skipping"
fi

# 2. Create SQS Queues
echo "2️⃣  Creating SQS queues"

# Main queue
QUEUE_NAME="volunteer-jobs-dev"
QUEUE_URL=$(aws sqs create-queue \
    --queue-name "$QUEUE_NAME" \
    --region "$AWS_REGION" \
    --attributes '{
        "VisibilityTimeout": "300",
        "MessageRetentionPeriod": "345600",
        "ReceiveMessageWaitTimeSeconds": "20"
    }' \
    --query 'QueueUrl' \
    --output text 2>/dev/null || aws sqs get-queue-url --queue-name "$QUEUE_NAME" --query 'QueueUrl' --output text)

echo "   ✓ Main queue: $QUEUE_URL"

# DLQ
DLQ_NAME="volunteer-jobs-dev-dlq"
DLQ_URL=$(aws sqs create-queue \
    --queue-name "$DLQ_NAME" \
    --region "$AWS_REGION" \
    --query 'QueueUrl' \
    --output text 2>/dev/null || aws sqs get-queue-url --queue-name "$DLQ_NAME" --query 'QueueUrl' --output text)

echo "   ✓ Dead letter queue: $DLQ_URL"

# Get DLQ ARN
DLQ_ARN=$(aws sqs get-queue-attributes \
    --queue-url "$DLQ_URL" \
    --attribute-names QueueArn \
    --query 'Attributes.QueueArn' \
    --output text)

# Configure DLQ on main queue
aws sqs set-queue-attributes \
    --queue-url "$QUEUE_URL" \
    --attributes "{
        \"RedrivePolicy\": \"{\\\"deadLetterTargetArn\\\":\\\"$DLQ_ARN\\\",\\\"maxReceiveCount\\\":\\\"3\\\"}\"
    }"

echo "   ✓ DLQ configured on main queue"

# 3. Verify SES Email
echo "3️⃣  Verifying SES email: $SES_EMAIL"
aws ses verify-email-identity --email-address "$SES_EMAIL" --region "$AWS_REGION" 2>/dev/null || echo "   ⚠ Already verified or verification sent"
echo "   ⚠ Check $SES_EMAIL inbox and click verification link!"

# 4. Create IAM User
echo "4️⃣  Creating IAM user"
IAM_USER="volunteer-app-user"

# Create user (ignore error if exists)
aws iam create-user --user-name "$IAM_USER" 2>/dev/null || echo "   ⚠ User already exists"

# Attach policies
aws iam attach-user-policy \
    --user-name "$IAM_USER" \
    --policy-arn "arn:aws:iam::aws:policy/AmazonS3FullAccess" 2>/dev/null

aws iam attach-user-policy \
    --user-name "$IAM_USER" \
    --policy-arn "arn:aws:iam::aws:policy/AmazonSQSFullAccess" 2>/dev/null

aws iam attach-user-policy \
    --user-name "$IAM_USER" \
    --policy-arn "arn:aws:iam::aws:policy/AmazonSESFullAccess" 2>/dev/null

echo "   ✓ IAM user created with policies attached"

# Create access keys
echo "   Creating access keys..."
KEYS=$(aws iam create-access-key --user-name "$IAM_USER" --output json 2>/dev/null || echo "{}")
ACCESS_KEY=$(echo "$KEYS" | grep -o '"AccessKeyId": "[^"]*' | cut -d'"' -f4)
SECRET_KEY=$(echo "$KEYS" | grep -o '"SecretAccessKey": "[^"]*' | cut -d'"' -f4)

if [ -n "$ACCESS_KEY" ]; then
    echo "   ✓ Access keys created"
else
    echo "   ⚠ Could not create new keys (user may already have 2 keys)"
    echo "   Please create keys manually in IAM console"
fi

echo ""
echo "✅ AWS Setup Complete!"
echo ""
echo "================================================"
echo "📋 SAVE THESE CREDENTIALS (won't be shown again)"
echo "================================================"
echo ""
echo "AWS_REGION=$AWS_REGION"
echo "AWS_ACCESS_KEY_ID=$ACCESS_KEY"
echo "AWS_SECRET_ACCESS_KEY=$SECRET_KEY"
echo "S3_BUCKET_NAME=$BUCKET_NAME"
echo "SQS_QUEUE_URL=$QUEUE_URL"
echo "SQS_DLQ_URL=$DLQ_URL"
echo "SES_FROM_EMAIL=$SES_EMAIL"
echo ""
echo "================================================"
echo ""
echo "Next Steps:"
echo "1. ✅ Verify $SES_EMAIL (check inbox)"
echo "2. 🖥️  Launch EC2 instance (see AWS_TESTING_GUIDE.md)"
echo "3. 📝 Create .env file with above credentials"
echo "4. 🚀 Deploy application"
echo ""
echo "Full guide: AWS_TESTING_GUIDE.md"
