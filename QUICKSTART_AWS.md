# AWS Testing Quick Start

A streamlined guide to get your volunteer signup platform running on AWS in ~30 minutes.

## Prerequisites Checklist

- [ ] AWS Account with billing enabled
- [ ] AWS CLI installed (`brew install awscli` on macOS)
- [ ] AWS CLI configured (`aws configure`)
- [ ] Email address for SES verification
- [ ] SSH key pair created (or will create during setup)

## Option 1: Automated Setup (Recommended)

### Step 1: Create AWS Resources (5 minutes)

Run from your **local machine**:

```bash
# Make script executable
chmod +x scripts/create-aws-resources.sh

# Run setup
./scripts/create-aws-resources.sh
```

This will create:
- ✅ S3 bucket for JSON backups
- ✅ SQS queues (main + DLQ)
- ✅ SES email verification
- ✅ IAM user with access keys

**SAVE THE CREDENTIALS OUTPUT!** You'll need them for the `.env` file.

### Step 2: Launch EC2 Instance (10 minutes)

1. **Go to AWS EC2 Console** → Launch Instance

2. **Quick Configuration**:
   ```
   Name: volunteer-app-test
   AMI: Ubuntu Server 22.04 LTS
   Instance type: t3.small
   Key pair: Create new → volunteer-app-key (download .pem file)
   Network: Allow HTTP (80), HTTPS (443), SSH (22)
   Storage: 20 GB
   ```

3. **Launch** and copy the **Public IP address**

4. **SSH into EC2**:
   ```bash
   # Set key permissions
   chmod 400 ~/Downloads/volunteer-app-key.pem
   
   # Connect (replace with your IP)
   ssh -i ~/Downloads/volunteer-app-key.pem ubuntu@54.123.45.67
   ```

### Step 3: Setup EC2 Server (10 minutes)

Run this on the **EC2 instance**:

```bash
# Download setup script
wget https://raw.githubusercontent.com/YOUR_USERNAME/volunteer-signup-platform/main/scripts/setup-ec2.sh

# Make executable
chmod +x setup-ec2.sh

# Run setup
./setup-ec2.sh
```

When prompted, enter your Git repository URL.

### Step 4: Configure Application (5 minutes)

```bash
cd ~/volunteer-signup-platform

# Create .env from template
cp .env.template .env

# Edit with your credentials (from Step 1)
nano .env
```

**Paste the credentials from Step 1**, then:
- Replace `YOUR_EC2_IP` with your EC2 public IP
- Press `Ctrl+X`, then `Y`, then `Enter` to save

### Step 5: Start Services (5 minutes)

```bash
# Start PostgreSQL
docker-compose up -d db

# Wait for DB to start
sleep 10

# Run database migrations
npx prisma migrate deploy

# Seed with sample data
npx prisma db seed

# Build Next.js app
npm run build

# Start web server with PM2
pm2 start npm --name "web" -- run start

# Start worker
pm2 start npm --name "worker" -- run worker

# Save PM2 config
pm2 save

# Enable auto-restart on reboot
pm2 startup
# Run the command it outputs

# Check status
pm2 status
```

### Step 6: Test! 🎉

```bash
# Test health endpoint
curl http://localhost:3000/api/health

# Get EC2 public IP
curl http://169.254.169.254/latest/meta-data/public-ipv4
```

Open your browser: `http://YOUR_EC2_IP:3000`

You should see the volunteer signup platform homepage!

---

## Option 2: Manual Setup

Follow the detailed guide in [AWS_TESTING_GUIDE.md](./AWS_TESTING_GUIDE.md) for step-by-step manual configuration.

---

## Testing Checklist

Once deployed, test these features:

### Basic Functionality
- [ ] Homepage loads (`http://YOUR_IP:3000`)
- [ ] Health check works (`http://YOUR_IP:3000/api/health`)
- [ ] Calendar API returns data (`http://YOUR_IP:3000/api/public/events/EVT001/calendar?month=2026-01`)

### Signup Flow
- [ ] Visit signup page (`http://YOUR_IP:3000/signup/EVT001`)
- [ ] Calendar displays correctly
- [ ] Can select available slot
- [ ] Signup form appears
- [ ] Form submission works
- [ ] Success screen shows
- [ ] Confirmation email received ✉️

### Backend Verification
```bash
# SSH into EC2
ssh -i ~/Downloads/volunteer-app-key.pem ubuntu@YOUR_EC2_IP

# Check S3 uploads
aws s3 ls s3://YOUR_BUCKET_NAME/signups/ --recursive

# Check SQS queue
aws sqs get-queue-attributes \
  --queue-url YOUR_QUEUE_URL \
  --attribute-names ApproximateNumberOfMessages

# View application logs
pm2 logs web --lines 50

# View worker logs
pm2 logs worker --lines 50

# Check database
docker exec -it volunteer-signup-platform-db-1 psql -U volunteer_user -d volunteer_db -c "SELECT * FROM \"Signup\" LIMIT 5;"
```

---

## Common Issues & Fixes

### Issue: Can't connect to EC2
```bash
# Fix: Update security group to allow your IP
# Go to EC2 → Security Groups → volunteer-app-sg
# Edit inbound rules → Add SSH from "My IP"
```

### Issue: Health check fails
```bash
# Check if app is running
pm2 status

# Restart services
pm2 restart all

# Check logs
pm2 logs --lines 100
```

### Issue: Email not received
```bash
# Verify SES email
aws ses list-verified-email-addresses

# If in sandbox mode, verify recipient email too
aws ses verify-email-identity --email-address test-recipient@example.com

# Check SES sending
aws ses get-send-quota
```

### Issue: Worker not processing jobs
```bash
# Check worker status
pm2 status worker

# View worker logs
pm2 logs worker

# Check SQS queue
aws sqs receive-message --queue-url YOUR_QUEUE_URL --max-number-of-messages 1
```

### Issue: Database connection error
```bash
# Check if PostgreSQL container is running
docker ps

# Restart database
docker-compose restart db

# Check logs
docker logs volunteer-signup-platform-db-1
```

---

## Enable HTTPS (Optional)

### Prerequisites
- Domain name pointed to EC2 IP
- Port 80 and 443 open in security group

### Setup SSL with Let's Encrypt

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Configure Nginx
sudo nano /etc/nginx/sites-available/volunteer-app
```

Add:
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

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/volunteer-app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Get SSL certificate
sudo certbot --nginx -d volunteer.yourdomain.com

# Update .env
nano .env
# Change: NEXT_PUBLIC_BASE_URL="https://volunteer.yourdomain.com"

# Restart app
pm2 restart web
```

---

## Monitoring Commands

```bash
# Real-time monitoring
pm2 monit

# Resource usage
pm2 status
htop

# Application logs
pm2 logs --lines 100

# Disk usage
df -h

# Database size
docker exec -it volunteer-signup-platform-db-1 psql -U volunteer_user -d volunteer_db -c "SELECT pg_size_pretty(pg_database_size('volunteer_db'));"

# SQS queue depth
aws sqs get-queue-attributes \
  --queue-url YOUR_QUEUE_URL \
  --attribute-names All \
  --query 'Attributes.{Visible:ApproximateNumberOfMessages,InFlight:ApproximateNumberOfMessagesNotVisible}'
```

---

## Stopping Services (To Save Costs)

```bash
# Stop application
pm2 stop all

# Stop database
docker-compose stop

# Stop EC2 instance (from AWS console)
# This stops charges while preserving data
```

## Cleanup (When Done Testing)

To avoid ongoing AWS charges:

1. **Delete from AWS Console**:
   - [ ] Terminate EC2 instance
   - [ ] Delete S3 bucket (empty it first)
   - [ ] Delete SQS queues
   - [ ] Remove SES verified identities
   - [ ] Delete IAM user & access keys

2. **Or use AWS CLI**:
```bash
# Delete SQS queues
aws sqs delete-queue --queue-url YOUR_QUEUE_URL
aws sqs delete-queue --queue-url YOUR_DLQ_URL

# Empty and delete S3 bucket
aws s3 rm s3://YOUR_BUCKET_NAME --recursive
aws s3 rb s3://YOUR_BUCKET_NAME

# Delete IAM access keys
aws iam list-access-keys --user-name volunteer-app-user
aws iam delete-access-key --user-name volunteer-app-user --access-key-id YOUR_KEY_ID

# Detach policies and delete user
aws iam detach-user-policy --user-name volunteer-app-user --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess
aws iam detach-user-policy --user-name volunteer-app-user --policy-arn arn:aws:iam::aws:policy/AmazonSQSFullAccess
aws iam detach-user-policy --user-name volunteer-app-user --policy-arn arn:aws:iam::aws:policy/AmazonSESFullAccess
aws iam delete-user --user-name volunteer-app-user
```

---

## Cost Estimate

**Testing (1 week)**:
- EC2 t3.small: ~$3.50
- Storage: ~$0.50
- S3/SQS/SES: <$1
- **Total: ~$5**

**Monthly (production)**:
- EC2 t3.small: ~$15
- RDS db.t3.micro: ~$12 (if used)
- Other services: ~$2
- **Total: ~$17-29/month**

---

## Next Steps

1. ✅ Test all features
2. 📊 Set up CloudWatch for monitoring
3. 🔐 Add Cognito for admin authentication
4. 📝 Configure Google Sheets sync
5. 🚀 Set up CI/CD with GitHub Actions
6. 📧 Request SES production access
7. 🌐 Add custom domain with HTTPS

---

## Support

- Full deployment guide: [AWS_TESTING_GUIDE.md](./AWS_TESTING_GUIDE.md)
- Architecture details: [ARCHITECTURE.md](./ARCHITECTURE.md)
- API documentation: [API.md](./API.md)
- Frontend components: [FRONTEND_SUMMARY.md](./FRONTEND_SUMMARY.md)

---

**Happy Testing! 🎉**
