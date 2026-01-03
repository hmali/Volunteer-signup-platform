#!/bin/bash
# EC2 Setup Script for Volunteer Signup Platform
# Run this on your EC2 instance after SSH connection

set -e  # Exit on error

echo "🚀 Starting Volunteer Signup Platform Setup..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if running on Ubuntu
if [ -f /etc/os-release ]; then
    . /etc/os-release
    if [ "$ID" != "ubuntu" ]; then
        print_error "This script is designed for Ubuntu. Detected: $ID"
        exit 1
    fi
else
    print_error "Cannot detect OS"
    exit 1
fi

print_status "Detected Ubuntu $VERSION_ID"

# Update system
print_status "Updating system packages..."
sudo apt update -qq
sudo apt upgrade -y -qq

# Install Node.js 20.x
print_status "Installing Node.js 20.x..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
    print_status "Node.js $(node --version) installed"
else
    print_status "Node.js $(node --version) already installed"
fi

# Install Docker
print_status "Installing Docker..."
if ! command -v docker &> /dev/null; then
    sudo apt install -y docker.io docker-compose
    sudo systemctl start docker
    sudo systemctl enable docker
    sudo usermod -aG docker $USER
    print_status "Docker installed"
    print_warning "You need to log out and back in for Docker permissions to take effect"
else
    print_status "Docker already installed"
fi

# Install Git
print_status "Installing Git..."
sudo apt install -y git

# Install AWS CLI
print_status "Installing AWS CLI..."
if ! command -v aws &> /dev/null; then
    sudo apt install -y awscli
    print_status "AWS CLI installed"
else
    print_status "AWS CLI already installed"
fi

# Install PM2 globally
print_status "Installing PM2..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
    print_status "PM2 installed"
else
    print_status "PM2 already installed"
fi

# Install Nginx
print_status "Installing Nginx..."
if ! command -v nginx &> /dev/null; then
    sudo apt install -y nginx
    print_status "Nginx installed"
else
    print_status "Nginx already installed"
fi

# Create application directory
APP_DIR="$HOME/volunteer-signup-platform"
print_status "Setting up application directory..."

# Prompt for repository URL
echo ""
echo "📦 Repository Setup"
read -p "Enter your Git repository URL (or press Enter to skip): " REPO_URL

if [ -n "$REPO_URL" ]; then
    if [ -d "$APP_DIR" ]; then
        print_warning "Directory $APP_DIR already exists"
        read -p "Remove and re-clone? (y/N): " CONFIRM
        if [ "$CONFIRM" = "y" ] || [ "$CONFIRM" = "Y" ]; then
            rm -rf "$APP_DIR"
            git clone "$REPO_URL" "$APP_DIR"
            print_status "Repository cloned"
        fi
    else
        git clone "$REPO_URL" "$APP_DIR"
        print_status "Repository cloned"
    fi
    
    cd "$APP_DIR"
    print_status "Installing npm dependencies..."
    npm install --legacy-peer-deps
else
    print_warning "Skipping repository clone. Make sure to clone manually!"
fi

# Create .env template
print_status "Creating .env template..."
cat > "$APP_DIR/.env.template" << 'EOF'
# Database
DATABASE_URL="postgresql://volunteer_user:volunteer_pass_123@localhost:5432/volunteer_db?schema=public"

# AWS Configuration
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="YOUR_ACCESS_KEY"
AWS_SECRET_ACCESS_KEY="YOUR_SECRET_KEY"

# S3
S3_BUCKET_NAME="your-bucket-name"

# SQS
SQS_QUEUE_URL="https://sqs.us-east-1.amazonaws.com/YOUR_ACCOUNT/your-queue"
SQS_DLQ_URL="https://sqs.us-east-1.amazonaws.com/YOUR_ACCOUNT/your-dlq"

# SES
SES_FROM_EMAIL="noreply@yourdomain.com"
SES_REPLY_TO_EMAIL="admin@yourdomain.com"

# Google Sheets (Optional)
GOOGLE_SERVICE_ACCOUNT_EMAIL=""
GOOGLE_PRIVATE_KEY=""
GOOGLE_SHEET_ID=""

# Application
NEXT_PUBLIC_BASE_URL="http://YOUR_EC2_IP"
NODE_ENV="production"
PORT=3000

# Cognito (Optional)
COGNITO_USER_POOL_ID=""
COGNITO_CLIENT_ID=""
COGNITO_REGION="us-east-1"
EOF

echo ""
echo "📝 Configuration Setup"
echo "A template .env file has been created at: $APP_DIR/.env.template"
echo "Please copy it to .env and fill in your AWS credentials:"
echo ""
echo "  cd $APP_DIR"
echo "  cp .env.template .env"
echo "  nano .env"
echo ""

# Get EC2 public IP
EC2_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
if [ -n "$EC2_IP" ]; then
    print_status "Your EC2 Public IP: $EC2_IP"
    echo "Use this for NEXT_PUBLIC_BASE_URL: http://$EC2_IP"
fi

echo ""
print_status "Setup Complete! 🎉"
echo ""
echo "Next Steps:"
echo "1. Configure .env file with your AWS credentials"
echo "2. Start PostgreSQL: docker-compose up -d db"
echo "3. Run migrations: npx prisma migrate deploy"
echo "4. Seed database: npx prisma db seed"
echo "5. Build app: npm run build"
echo "6. Start with PM2: pm2 start npm --name web -- run start"
echo "7. Start worker: pm2 start npm --name worker -- run worker"
echo "8. Test: curl http://localhost:3000/api/health"
echo ""
print_warning "If you installed Docker for the first time, log out and back in!"
