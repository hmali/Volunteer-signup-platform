# AWS Infrastructure Setup for Testing

This guide provides step-by-step instructions to set up the minimal AWS infrastructure needed to test the volunteer signup platform.

## Overview

For testing, you'll need:
1. **EC2 Instance** (t3.small or t3.medium) - To host the application
2. **RDS PostgreSQL** (db.t3.micro) - Database (or use Docker on EC2)
3. **S3 Bucket** - For JSON backups
4. **SQS Queue** - For background jobs
5. **SES** - For sending emails
6. **IAM User** - With programmatic access
7. **(Optional) Cognito** - For admin authentication
8. **Route 53** - Domain/subdomain for HTTPS (optional for testing)

**Estimated Monthly Cost for Testing**: ~$15-25 USD

---

## Prerequisites

- AWS Account with billing enabled
- AWS CLI installed (`aws --version`)
- SSH key pair for EC2 access
- Domain name (optional, can use EC2 public IP for testing)

---

## Part 1: AWS Setup (Web Console)

### Step 1: Create IAM User for Application

1. **Go to IAM Console** → Users → Create User
   - Username: `volunteer-app-user`
   - Access type: ✅ Programmatic access
   
2. **Attach Policies**:
   ```
   AmazonS3FullAccess
   AmazonSQSFullAccess
   AmazonSESFullAccess
   ```

3. **Download Credentials**:
   - Save `Access Key ID` and `Secret Access Key`
   - **IMPORTANT**: Save these securely, you'll need them for `.env`

---

### Step 2: Create S3 Bucket

1. **Go to S3 Console** → Create Bucket
   - Bucket name: `volunteer-signups-dev-[your-initials]` (must be globally unique)
   - Region: `us-east-1` (or your preferred region)
   - Block Public Access: ✅ **Enable** (keep private)
   - Versioning: ✅ **Enable** (for backup safety)
   - Encryption: ✅ **Enable** (SSE-S3)
   - Click **Create bucket**

2. **Note the bucket name** for `.env` file

---

### Step 3: Create SQS Queue

1. **Go to SQS Console** → Create Queue
   - Type: **Standard Queue**
   - Name: `volunteer-jobs-dev`
   - Configuration:
     - Visibility timeout: `300` seconds (5 min)
     - Message retention: `4` days
     - Delivery delay: `0` seconds
     - Maximum message size: `256 KB`
     - Receive message wait time: `20` seconds (enable long polling)
   
2. **Create Dead Letter Queue** (for failed jobs):
   - Name: `volunteer-jobs-dev-dlq`
   - Same settings as above
   
3. **Configure DLQ on Main Queue**:
   - Edit main queue → Dead-letter queue
   - Set DLQ: `volunteer-jobs-dev-dlq`
   - Maximum receives: `3`
   - Save

4. **Copy Queue URL** from queue details (e.g., `https://sqs.us-east-1.amazonaws.com/123456789/volunteer-jobs-dev`)

---

### Step 4: Set Up SES (Email Service)

#### Option A: Sandbox Mode (Testing)
1. **Go to SES Console** → Verified Identities
2. **Verify Email Address**:
   - Click **Create Identity**
   - Identity type: **Email address**
   - Email: `your-email@example.com`
   - Click **Create**
   - Check your inbox and click verification link

3. **Verify Test Recipient Emails**:
   - In sandbox, you can only send to verified emails
   - Verify emails you'll use for testing (your test Gmail, etc.)

#### Option B: Production Mode (Recommended for real testing)
1. **Request Production Access**:
   - SES Console → Account Dashboard
   - Click **Request production access**
   - Fill out form:
     - Use case: Non-profit/temple volunteer coordination
     - Website URL: Your EC2 IP or domain
     - Use case description: "Sending volunteer confirmation emails for temple seva scheduling"
   - Submit (usually approved in 24 hours)

2. **Verify Domain** (recommended):
   - SES Console → Verified Identities → Create Identity
   - Identity type: **Domain**
   - Domain: `yourdomain.com`
   - Follow DNS verification steps

**Note**: Copy the verified sender email for `.env` file

---

### Step 5: Launch EC2 Instance

1. **Go to EC2 Console** → Launch Instance
   
2. **Name**: `volunteer-app-test`

3. **AMI**: Ubuntu Server 22.04 LTS

4. **Instance Type**: 
   - Testing: `t3.small` (2 vCPU, 2 GB RAM) - $0.0208/hr
   - Production: `t3.medium` (2 vCPU, 4 GB RAM) - $0.0416/hr

5. **Key Pair**:
   - Create new key pair: `volunteer-app-key`
   - Type: RSA
   - Format: `.pem` (for macOS/Linux)
   - **Download and save** to `~/.ssh/volunteer-app-key.pem`
   - Set permissions: `chmod 400 ~/.ssh/volunteer-app-key.pem`

6. **Network Settings**:
   - VPC: Default VPC
   - Auto-assign public IP: **Enable**
   - Firewall (Security Group): Create new
     - Name: `volunteer-app-sg`
     - Rules:
       ```
       Type            Port    Source          Description
       SSH             22      My IP           SSH access
       HTTP            80      0.0.0.0/0       Web traffic
       HTTPS           443     0.0.0.0/0       Secure web traffic
       Custom TCP      3000    My IP           Next.js dev (temp)
       PostgreSQL      5432    Self            DB (if using RDS)
       ```

7. **Storage**: 20 GB gp3 SSD

8. **Advanced Details** (optional):
   - User data: (leave empty, we'll configure manually)

9. **Launch Instance**

10. **Copy Public IP Address** (e.g., `54.123.45.67`)

---

### Step 6: Database Setup

#### Option A: PostgreSQL on EC2 (Simpler for Testing)
We'll use Docker Compose to run PostgreSQL on the same EC2 instance.

**Pros**: Free, simple, all-in-one
**Cons**: Not production-grade, no automatic backups

#### Option B: RDS PostgreSQL (Production-like)
1. **Go to RDS Console** → Create Database
2. **Configuration**:
   - Engine: PostgreSQL 15
   - Templates: **Free tier** (if eligible) or **Dev/Test**
   - DB instance identifier: `volunteer-db-dev`
   - Master username: `volunteer_admin`
   - Master password: (generate strong password, save it!)
   - Instance: `db.t3.micro` ($0.017/hr)
   - Storage: 20 GB gp3
   - VPC: Same as EC2
   - Public access: **No** (only EC2 should access)
   - VPC Security Group: Create new `volunteer-db-sg`
     - Allow PostgreSQL (5432) from EC2 security group
   - Database name: `volunteer_db`
   
3. **Copy Endpoint** (e.g., `volunteer-db-dev.abc123.us-east-1.rds.amazonaws.com`)

**For this guide, we'll use Option A (Docker on EC2) for simplicity.**

---

### Step 7: (Optional) Set Up Cognito for Admin Auth

1. **Go to Cognito Console** → Create User Pool
   
2. **Configure Sign-in**:
   - Provider types: **Email**
   - Cognito user pool sign-in options: ✅ Email
   
3. **Security Requirements**:
   - Password policy: Default
   - MFA: Optional (for testing)
   
4. **Sign-up Experience**:
   - Self-registration: **Disabled** (admin-created only)
   - Required attributes: Email, Name
   
5. **Message Delivery**:
   - Email provider: **Send email with Cognito**
   
6. **App Integration**:
   - User pool name: `volunteer-admins-dev`
   - App client name: `volunteer-web-app`
   - Don't generate secret
   
7. **Copy User Pool ID** and **App Client ID**

8. **Create Admin User**:
   - Users → Create user
   - Email: `admin@yourdomain.com`
   - Temporary password: (generate)
   - Send invitation: Yes

---

## Part 2: EC2 Server Setup

### Step 1: Connect to EC2

```bash
# Set key permissions
chmod 400 ~/.ssh/volunteer-app-key.pem

# Connect
ssh -i ~/.ssh/volunteer-app-key.pem ubuntu@54.123.45.67
# (Replace with your EC2 public IP)
```

### Step 2: Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version  # Should be v20.x
npm --version   # Should be v10.x

# Install Docker
sudo apt install -y docker.io docker-compose
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ubuntu

# Install Git
sudo apt install -y git

# Log out and back in for Docker permissions
exit
# SSH back in
ssh -i ~/.ssh/volunteer-app-key.pem ubuntu@54.123.45.67
```

### Step 3: Clone and Configure Application

```bash
# Clone repository
cd ~
git clone https://github.com/YOUR_USERNAME/volunteer-signup-platform.git
cd volunteer-signup-platform

# Install dependencies
npm install --legacy-peer-deps

# Create .env file
nano .env
```

**Paste this configuration** (replace with your actual values):

```bash
# Database (Using Docker on same EC2)
DATABASE_URL="postgresql://volunteer_user:volunteer_pass_123@localhost:5432/volunteer_db?schema=public"

# AWS Credentials
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="AKIA..."  # From IAM user
AWS_SECRET_ACCESS_KEY="..."   # From IAM user

# S3
S3_BUCKET_NAME="volunteer-signups-dev-yourname"

# SQS
SQS_QUEUE_URL="https://sqs.us-east-1.amazonaws.com/123456789/volunteer-jobs-dev"
SQS_DLQ_URL="https://sqs.us-east-1.amazonaws.com/123456789/volunteer-jobs-dev-dlq"

# SES
SES_FROM_EMAIL="noreply@yourdomain.com"  # Must be verified
SES_REPLY_TO_EMAIL="admin@yourdomain.com"

# Google Sheets (Optional - skip for now)
GOOGLE_SERVICE_ACCOUNT_EMAIL=""
GOOGLE_PRIVATE_KEY=""
GOOGLE_SHEET_ID=""

# App Config
NEXT_PUBLIC_BASE_URL="http://54.123.45.67"  # Your EC2 public IP
NODE_ENV="production"
PORT=3000

# Cognito (Optional - skip if not using)
COGNITO_USER_POOL_ID=""
COGNITO_CLIENT_ID=""
COGNITO_REGION="us-east-1"
```

**Save** (Ctrl+X, Y, Enter)

### Step 4: Start Database with Docker

```bash
# Start PostgreSQL container
docker-compose up -d db

# Wait 10 seconds for PostgreSQL to start
sleep 10

# Run migrations
npx prisma migrate deploy

# Seed database with sample data
npx prisma db seed
```

### Step 5: Build and Start Application

```bash
# Build Next.js app
npm run build

# Start web server (in background)
npm run start &

# Start worker (in background)
npm run worker &

# Check if running
curl http://localhost:3000/api/health
# Should return: {"status":"ok","database":"connected"}
```

### Step 6: Test from Your Browser

Open browser and visit:
```
http://54.123.45.67:3000
```

You should see the volunteer signup homepage!

---

## Part 3: Google Sheets Setup (Optional)

### Step 1: Create Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project: `volunteer-signup-dev`
3. Enable Google Sheets API:
   - APIs & Services → Library
   - Search "Google Sheets API"
   - Click Enable
4. Create Service Account:
   - IAM & Admin → Service Accounts
   - Create Service Account
   - Name: `volunteer-sheets-sync`
   - Role: None (sheets will be shared explicitly)
   - Click Done
5. Create Key:
   - Click on service account
   - Keys → Add Key → Create New Key
   - Type: JSON
   - Download JSON file

### Step 2: Configure Sheets

1. **Create Google Sheet**:
   - Go to [Google Sheets](https://sheets.google.com)
   - Create new spreadsheet
   - Name: "Volunteer Roster - Dev"
   - Copy Sheet ID from URL:
     ```
     https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit
     ```

2. **Share with Service Account**:
   - Click Share
   - Add service account email (from JSON: `client_email`)
   - Permission: **Editor**
   - Uncheck "Notify people"
   - Share

3. **Add to .env**:
   ```bash
   nano .env
   ```
   Add:
   ```bash
   GOOGLE_SERVICE_ACCOUNT_EMAIL="volunteer-sheets-sync@project-id.iam.gserviceaccount.com"
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...key from JSON...\n-----END PRIVATE KEY-----\n"
   GOOGLE_SHEET_ID="SHEET_ID_HERE"
   ```

4. **Restart worker**:
   ```bash
   pkill -f "npm run worker"
   npm run worker &
   ```

---

## Part 4: Testing Checklist

### ✅ Test 1: Homepage
```bash
curl http://54.123.45.67:3000
# Should return HTML
```

### ✅ Test 2: Health Check
```bash
curl http://54.123.45.67:3000/api/health
# Should return: {"status":"ok","database":"connected"}
```

### ✅ Test 3: Calendar API
```bash
# Get seeded event (check seed.ts for publicId)
curl http://54.123.45.67:3000/api/public/events/EVT001/calendar?month=2026-01
# Should return JSON with days/slots
```

### ✅ Test 4: Create Signup (Manual Test)
1. Visit: `http://54.123.45.67:3000/signup/EVT001`
2. Click on an available day
3. Click "Sign Up" on a slot
4. Fill form and submit
5. Check confirmation screen

### ✅ Test 5: Verify S3 Upload
```bash
# Install AWS CLI on EC2
sudo apt install -y awscli

# Configure AWS CLI
aws configure
# Enter your IAM user credentials

# List S3 bucket
aws s3 ls s3://volunteer-signups-dev-yourname/signups/
# Should see JSON files
```

### ✅ Test 6: Check SQS Queue
```bash
# Get queue attributes
aws sqs get-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/123456789/volunteer-jobs-dev \
  --attribute-names All
# Check MessagesVisible count
```

### ✅ Test 7: Email Delivery
- Check your verified email inbox
- Should receive confirmation email
- Click "Add to Calendar" link

### ✅ Test 8: Worker Logs
```bash
# View worker logs
pm2 logs worker
# OR if not using pm2:
ps aux | grep worker
```

---

## Part 5: Production Setup (HTTPS)

### Option A: Using Let's Encrypt (Free SSL)

1. **Get Domain/Subdomain**:
   - Use Route 53 or your domain registrar
   - Point A record to EC2 public IP
   - Example: `volunteer.yourdomain.com → 54.123.45.67`

2. **Install Certbot**:
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   ```

3. **Install Nginx**:
   ```bash
   sudo apt install -y nginx
   
   # Copy nginx config
   sudo cp docker/nginx.conf /etc/nginx/sites-available/volunteer-app
   
   # Edit config
   sudo nano /etc/nginx/sites-available/volunteer-app
   ```

   Update:
   ```nginx
   server {
       listen 80;
       server_name volunteer.yourdomain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

4. **Enable site**:
   ```bash
   sudo ln -s /etc/nginx/sites-available/volunteer-app /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

5. **Get SSL Certificate**:
   ```bash
   sudo certbot --nginx -d volunteer.yourdomain.com
   # Follow prompts
   ```

6. **Update .env**:
   ```bash
   NEXT_PUBLIC_BASE_URL="https://volunteer.yourdomain.com"
   ```

7. **Restart app**:
   ```bash
   pkill -f "npm run start"
   npm run start &
   ```

---

## Part 6: Process Management (Production)

Use PM2 to keep processes running:

```bash
# Install PM2
sudo npm install -g pm2

# Start web app
pm2 start npm --name "web" -- run start

# Start worker
pm2 start npm --name "worker" -- run worker

# Save PM2 config
pm2 save

# Auto-start on reboot
pm2 startup
# Follow the command it outputs

# View logs
pm2 logs

# Monitor
pm2 monit
```

---

## Cost Breakdown (Monthly)

| Service | Configuration | Estimated Cost |
|---------|--------------|----------------|
| EC2 t3.small | 730 hrs/month | ~$15 |
| RDS db.t3.micro | 730 hrs/month (if used) | ~$12 |
| S3 | 1 GB storage, 1000 requests | <$1 |
| SQS | 1M requests | <$1 |
| SES | 1000 emails | $0.10 |
| Data Transfer | 10 GB/month | ~$1 |
| **Total (Docker DB)** | | **~$17/month** |
| **Total (RDS DB)** | | **~$29/month** |

---

## Troubleshooting

### Issue: Can't connect to EC2
```bash
# Check security group allows SSH from your IP
# Check key file permissions
chmod 400 ~/.ssh/volunteer-app-key.pem
```

### Issue: Database connection failed
```bash
# Check Docker is running
docker ps

# Check PostgreSQL logs
docker logs volunteer-signup-platform-db-1

# Test connection
docker exec -it volunteer-signup-platform-db-1 psql -U volunteer_user -d volunteer_db
```

### Issue: SQS not receiving messages
```bash
# Check IAM permissions
aws sqs get-queue-attributes --queue-url YOUR_QUEUE_URL

# Check worker logs
pm2 logs worker
```

### Issue: Emails not sending
```bash
# Verify SES sender
aws ses list-verified-email-addresses

# Check sandbox mode
aws ses get-account-sending-enabled

# Test send
aws ses send-email \
  --from noreply@yourdomain.com \
  --to your-email@example.com \
  --subject "Test" \
  --text "Test email"
```

---

## Next Steps

1. ✅ **Test all features** using the checklist above
2. ✅ **Monitor logs** for errors
3. ✅ **Set up CloudWatch** for monitoring (optional)
4. ✅ **Configure backups** for RDS
5. ✅ **Set up CI/CD** with GitHub Actions (optional)
6. ✅ **Load test** with Apache Bench or k6

---

## Cleanup (When Done Testing)

To avoid ongoing charges:

```bash
# Terminate EC2 instance
# Delete RDS database
# Delete S3 bucket
# Delete SQS queues
# Remove SES verified identities
# Delete IAM user
```

---

## Support

- AWS Documentation: https://docs.aws.amazon.com
- EC2 Pricing: https://aws.amazon.com/ec2/pricing/
- SES Limits: https://docs.aws.amazon.com/ses/latest/dg/quotas.html
- Project Issues: [GitHub Issues]

---

**Status**: Ready to deploy to AWS! 🚀
