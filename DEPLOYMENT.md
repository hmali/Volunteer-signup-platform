# Volunteer Signup Platform - Deployment Guide

## Prerequisites

- AWS Account with admin access
- Domain name (optional but recommended)
- Ubuntu 22.04 EC2 instance (t3.medium or larger)
- PostgreSQL database (RDS or local)

---

## Part 1: AWS Setup

### 1.1 Create S3 Bucket

```bash
# Replace with your bucket name
BUCKET_NAME="volunteer-signups-prod"
AWS_REGION="us-east-1"

aws s3 mb s3://${BUCKET_NAME} --region ${AWS_REGION}

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket ${BUCKET_NAME} \
  --versioning-configuration Status=Enabled

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket ${BUCKET_NAME} \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

# Block public access
aws s3api put-public-access-block \
  --bucket ${BUCKET_NAME} \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

### 1.2 Create SQS Queues

```bash
# Main queue
aws sqs create-queue \
  --queue-name volunteer-jobs \
  --region ${AWS_REGION} \
  --attributes VisibilityTimeout=300,MessageRetentionPeriod=1209600

# Dead Letter Queue
aws sqs create-queue \
  --queue-name volunteer-jobs-dlq \
  --region ${AWS_REGION}

# Get queue URLs and ARNs
aws sqs get-queue-url --queue-name volunteer-jobs --region ${AWS_REGION}
aws sqs get-queue-url --queue-name volunteer-jobs-dlq --region ${AWS_REGION}
```

### 1.3 Configure SES

```bash
# Verify your email address (for development)
aws ses verify-email-identity \
  --email-address noreply@yourdomain.com \
  --region ${AWS_REGION}

# For production, verify your domain instead
aws ses verify-domain-identity \
  --domain yourdomain.com \
  --region ${AWS_REGION}

# Move out of SES sandbox (production only)
# Request via AWS Console: SES > Account Dashboard > Request Production Access
```

### 1.4 Create IAM User

```bash
# Create user
aws iam create-user --user-name volunteer-app

# Create policy
cat > volunteer-app-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::${BUCKET_NAME}",
        "arn:aws:s3:::${BUCKET_NAME}/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "sqs:SendMessage",
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes"
      ],
      "Resource": [
        "arn:aws:sqs:${AWS_REGION}:*:volunteer-jobs",
        "arn:aws:sqs:${AWS_REGION}:*:volunteer-jobs-dlq"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendRawEmail"
      ],
      "Resource": "*"
    }
  ]
}
EOF

# Attach policy
aws iam put-user-policy \
  --user-name volunteer-app \
  --policy-name VolunteerAppPolicy \
  --policy-document file://volunteer-app-policy.json

# Create access key
aws iam create-access-key --user-name volunteer-app
# Save the AccessKeyId and SecretAccessKey!
```

### 1.5 Create Cognito User Pool (Admin Auth)

```bash
# Create user pool via console or CLI
aws cognito-idp create-user-pool \
  --pool-name volunteer-admin-pool \
  --region ${AWS_REGION} \
  --policies '{
    "PasswordPolicy": {
      "MinimumLength": 12,
      "RequireUppercase": true,
      "RequireLowercase": true,
      "RequireNumbers": true,
      "RequireSymbols": true
    }
  }'

# Create app client
aws cognito-idp create-user-pool-client \
  --user-pool-id <pool-id> \
  --client-name volunteer-web-app \
  --region ${AWS_REGION}
```

---

## Part 2: Google Sheets Setup

### 2.1 Create Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project: "Volunteer Signup"
3. Enable APIs:
   - Google Sheets API
   - Google Drive API
4. Create Service Account:
   - IAM & Admin > Service Accounts > Create Service Account
   - Name: `volunteer-sync`
   - Grant role: None needed
5. Create Key:
   - Click on service account > Keys > Add Key > JSON
   - Download JSON file (keep secure!)

### 2.2 Share Drive Folder

1. Create a folder in Google Drive: "Volunteer Rosters"
2. Share folder with service account email (from JSON):
   - Email looks like: `volunteer-sync@project-id.iam.gserviceaccount.com`
   - Grant "Editor" permission
3. Copy folder ID from URL:
   - URL: `https://drive.google.com/drive/folders/1abc123def456`
   - Folder ID: `1abc123def456`

### 2.3 Extract Service Account Credentials

From the downloaded JSON file:

```bash
# Extract values for .env
cat service-account.json | jq -r '.client_email'
cat service-account.json | jq -r '.private_key'
cat service-account.json | jq -r '.project_id'
```

---

## Part 3: PostgreSQL Setup

### Option A: AWS RDS (Recommended for Production)

```bash
aws rds create-db-instance \
  --db-instance-identifier volunteer-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 15.3 \
  --master-username postgres \
  --master-user-password <your-secure-password> \
  --allocated-storage 20 \
  --publicly-accessible \
  --vpc-security-group-ids <sg-id> \
  --region ${AWS_REGION}

# Get endpoint
aws rds describe-db-instances \
  --db-instance-identifier volunteer-db \
  --query 'DBInstances[0].Endpoint.Address'
```

### Option B: Docker Container (Development/Small Scale)

Included in docker-compose.yml (see below)

---

## Part 4: EC2 Instance Setup

### 4.1 Launch EC2 Instance

```bash
# Launch Ubuntu 22.04 instance
# Instance type: t3.medium (2 vCPU, 4 GB RAM)
# Storage: 30 GB gp3
# Security Group: Allow ports 22 (SSH), 80 (HTTP), 443 (HTTPS)

# Get instance public IP
aws ec2 describe-instances \
  --instance-ids <instance-id> \
  --query 'Reservations[0].Instances[0].PublicIpAddress'
```

### 4.2 Connect and Install Dependencies

```bash
# SSH into instance
ssh -i your-key.pem ubuntu@<public-ip>

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.23.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Node.js (for building)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install Git
sudo apt install -y git

# Logout and login again to apply docker group
exit
ssh -i your-key.pem ubuntu@<public-ip>
```

### 4.3 Clone Repository

```bash
cd ~
git clone <your-repo-url> volunteer-signup-platform
cd volunteer-signup-platform
```

### 4.4 Configure Environment

```bash
# Create .env file
cp .env.example .env
nano .env

# Fill in all values (see .env.example for reference)
```

**Required variables**:
```bash
DATABASE_URL="postgresql://user:pass@localhost:5432/volunteer_signup"
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"
S3_BUCKET_NAME="volunteer-signups-prod"
SQS_QUEUE_URL="https://sqs.us-east-1.amazonaws.com/123/volunteer-jobs"
SES_FROM_EMAIL="noreply@yourdomain.com"
GOOGLE_SERVICE_ACCOUNT_EMAIL="volunteer-sync@project.iam.gserviceaccount.com"
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
GOOGLE_DRIVE_FOLDER_ID="1abc123def456"
NEXT_PUBLIC_BASE_URL="https://yourdomain.com"
NEXTAUTH_SECRET="<generate-random-32-char-string>"
```

### 4.5 Build Application

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Build Next.js
npm run build
```

---

## Part 5: Docker Deployment

### 5.1 Create Dockerfiles

**Dockerfile.web**:
```dockerfile
FROM node:18-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# Production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT 3000

CMD ["node", "server.js"]
```

**Dockerfile.worker**:
```dockerfile
FROM node:18-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npx prisma generate

EXPOSE 3001

CMD ["npm", "run", "worker"]
```

### 5.2 Create docker-compose.yml

```yaml
version: '3.8'

services:
  db:
    image: postgres:15-alpine
    restart: always
    environment:
      POSTGRES_DB: volunteer_signup
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  web:
    build:
      context: .
      dockerfile: Dockerfile.web
    restart: always
    ports:
      - "3000:3000"
    env_file:
      - .env
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  worker:
    build:
      context: .
      dockerfile: Dockerfile.worker
    restart: always
    env_file:
      - .env
    depends_on:
      - db
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
    depends_on:
      - web

volumes:
  postgres_data:
```

### 5.3 Run Database Migrations

```bash
# Run migrations
npx prisma migrate deploy

# Seed database
npm run db:seed
```

### 5.4 Start Services

```bash
# Build and start
docker-compose up -d --build

# Check logs
docker-compose logs -f

# Check status
docker-compose ps
```

---

## Part 6: Nginx & SSL Setup

### 6.1 Create Nginx Configuration

Create `nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream web {
        server web:3000;
    }

    server {
        listen 80;
        server_name yourdomain.com www.yourdomain.com;

        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            return 301 https://$server_name$request_uri;
        }
    }

    server {
        listen 443 ssl http2;
        server_name yourdomain.com www.yourdomain.com;

        ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;

        client_max_body_size 10M;

        location / {
            proxy_pass http://web;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }
    }
}
```

### 6.2 Install SSL Certificate (Let's Encrypt)

```bash
# Install certbot
sudo apt install certbot

# Stop nginx temporarily
docker-compose stop nginx

# Get certificate
sudo certbot certonly --standalone \
  -d yourdomain.com \
  -d www.yourdomain.com \
  --email admin@yourdomain.com \
  --agree-tos \
  --non-interactive

# Create certbot directories
mkdir -p certbot/conf certbot/www

# Copy certificates
sudo cp -r /etc/letsencrypt/* certbot/conf/

# Fix permissions
sudo chown -R $(whoami):$(whoami) certbot/

# Restart nginx
docker-compose up -d nginx

# Set up auto-renewal
sudo crontab -e
# Add: 0 3 * * * certbot renew --quiet && docker-compose restart nginx
```

---

## Part 7: Monitoring & Maintenance

### 7.1 View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f web
docker-compose logs -f worker

# Last 100 lines
docker-compose logs --tail=100
```

### 7.2 Health Checks

```bash
# Web app
curl http://localhost:3000/api/health

# Worker
curl http://localhost:3001/health

# Check all containers
docker-compose ps
```

### 7.3 Restart Services

```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart web
docker-compose restart worker

# Full rebuild
docker-compose down
docker-compose up -d --build
```

### 7.4 Backup Database

```bash
# Backup
docker-compose exec db pg_dump -U postgres volunteer_signup > backup_$(date +%Y%m%d).sql

# Restore
cat backup_20260102.sql | docker-compose exec -T db psql -U postgres volunteer_signup
```

### 7.5 Update Application

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose down
docker-compose up -d --build

# Run any new migrations
docker-compose exec web npx prisma migrate deploy
```

---

## Part 8: Security Checklist

- [ ] Strong database password
- [ ] AWS IAM least-privilege policy
- [ ] S3 bucket encryption enabled
- [ ] S3 bucket public access blocked
- [ ] SES out of sandbox (production)
- [ ] SSL certificate installed and auto-renewing
- [ ] Firewall rules (only 80, 443, 22)
- [ ] SSH key-based authentication only
- [ ] Regular security updates (`apt update && apt upgrade`)
- [ ] Google Service Account key secure
- [ ] `.env` file not committed to git
- [ ] Cognito MFA enabled for admins

---

## Troubleshooting

### Issue: Database connection failed
```bash
# Check if DB is running
docker-compose ps db

# Check logs
docker-compose logs db

# Test connection
docker-compose exec db psql -U postgres volunteer_signup
```

### Issue: Worker not processing jobs
```bash
# Check worker logs
docker-compose logs -f worker

# Check SQS queue
aws sqs get-queue-attributes \
  --queue-url <queue-url> \
  --attribute-names ApproximateNumberOfMessages

# Restart worker
docker-compose restart worker
```

### Issue: Emails not sending
```bash
# Verify SES identity
aws ses get-identity-verification-attributes \
  --identities noreply@yourdomain.com

# Check SES sandbox status
aws ses get-account-sending-enabled

# Check worker logs for email errors
docker-compose logs worker | grep EMAIL
```

### Issue: Google Sheets sync failed
```bash
# Check service account permissions
# Verify folder is shared with service account email

# Test credentials
docker-compose exec worker node -e "
  const { google } = require('googleapis');
  const auth = new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    null,
    process.env.GOOGLE_PRIVATE_KEY.replace(/\\\\n/g, '\n'),
    ['https://www.googleapis.com/auth/spreadsheets']
  );
  auth.authorize().then(() => console.log('✓ Auth OK')).catch(console.error);
"
```

---

## Cost Estimation

**Monthly AWS costs** (500 signups/month):
- EC2 t3.medium: $30
- RDS t3.micro: $15
- S3: $0.02
- SQS: Free tier
- SES: $0.20 (2,000 emails)
- Data transfer: $5
- **Total: ~$50/month**

**Google Workspace**: Free (under API quotas)

---

## Support

For issues or questions:
1. Check logs: `docker-compose logs -f`
2. Verify environment variables
3. Test individual components (DB, S3, SQS, Sheets)
4. Review ARCHITECTURE.md for system design

---

## Next Steps After Deployment

1. Create your first admin user in Cognito
2. Log in to admin dashboard
3. Create an event
4. Define seva types
5. Generate monthly schedule
6. Share public signup link
7. Monitor signups in Google Sheets
