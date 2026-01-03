# AWS Testing - Complete Guide Summary

## 📚 Documentation Index

Your volunteer signup platform now has complete AWS deployment documentation:

1. **[QUICKSTART_AWS.md](./QUICKSTART_AWS.md)** ⚡ **START HERE!**
   - 30-minute quick setup guide
   - Automated scripts
   - Step-by-step checklist
   - Testing procedures

2. **[AWS_TESTING_GUIDE.md](./AWS_TESTING_GUIDE.md)** 📖
   - Comprehensive manual setup
   - Detailed explanations for each service
   - Troubleshooting guide
   - Production setup (HTTPS)

3. **[AWS_ARCHITECTURE.md](./AWS_ARCHITECTURE.md)** 🏗️
   - Infrastructure diagrams
   - Data flow visualization
   - Security groups configuration
   - Cost breakdown

4. **[DEPLOYMENT.md](./DEPLOYMENT.md)** 🚀
   - Full production deployment guide
   - Multi-environment setup
   - CI/CD pipeline
   - Monitoring & logging

---

## 🎯 Quick Answer: What AWS Infrastructure Do You Need?

### Minimum (Testing):
```
✅ EC2 Instance (t3.small)      - $15/month  - Host application
✅ S3 Bucket                    - $1/month   - JSON backups
✅ SQS Queue + DLQ              - $1/month   - Background jobs
✅ SES                          - $0.10/mo   - Email sending
✅ IAM User                     - Free       - Access credentials
```
**Total: ~$17/month**

### Recommended (Production):
```
✅ Above + RDS PostgreSQL       - $12/month  - Managed database
✅ Route 53                     - $0.50/mo   - Domain DNS
✅ AWS Certificate Manager      - Free       - SSL certificate
✅ CloudWatch                   - $3/month   - Monitoring
✅ (Optional) Cognito           - Free tier  - Admin auth
```
**Total: ~$33/month**

---

## 🚀 Fastest Path to Testing (30 Minutes)

### Step 1: Create AWS Resources (5 min)
```bash
# Run from your LOCAL machine
./scripts/create-aws-resources.sh
```
**Saves credentials you'll need later!**

### Step 2: Launch EC2 (10 min)
- AWS Console → EC2 → Launch Instance
- Ubuntu 22.04, t3.small, create SSH key
- Allow ports: 22, 80, 443, 3000
- Copy public IP

### Step 3: Setup Server (10 min)
```bash
# SSH to EC2
ssh -i ~/Downloads/volunteer-app-key.pem ubuntu@YOUR_EC2_IP

# Download and run setup
wget https://raw.githubusercontent.com/YOUR_USER/volunteer-signup-platform/main/scripts/setup-ec2.sh
chmod +x setup-ec2.sh
./setup-ec2.sh
```

### Step 4: Configure & Start (5 min)
```bash
cd ~/volunteer-signup-platform
cp .env.template .env
nano .env  # Paste credentials from Step 1

# Start services
docker-compose up -d db
npx prisma migrate deploy
npx prisma db seed
npm run build
pm2 start npm --name web -- run start
pm2 start npm --name worker -- run worker
pm2 save
```

### Step 5: Test!
```
http://YOUR_EC2_IP:3000
```

---

## 📝 Complete Checklist

### Pre-Deployment
- [ ] AWS account created with billing enabled
- [ ] AWS CLI installed (`brew install awscli`)
- [ ] AWS CLI configured (`aws configure`)
- [ ] GitHub repository created (optional)
- [ ] Email for SES verification
- [ ] Domain name (optional, for HTTPS)

### AWS Resource Setup
- [ ] S3 bucket created with versioning + encryption
- [ ] SQS main queue created
- [ ] SQS dead letter queue created
- [ ] DLQ configured on main queue
- [ ] SES email verified (check inbox!)
- [ ] IAM user created with policies
- [ ] Access keys generated and saved

### EC2 Setup
- [ ] EC2 instance launched (t3.small, Ubuntu 22.04)
- [ ] Security group configured (ports 22, 80, 443)
- [ ] SSH key downloaded and permissions set
- [ ] Can SSH into instance
- [ ] Node.js 20 installed
- [ ] Docker installed
- [ ] PM2 installed
- [ ] Application cloned

### Application Configuration
- [ ] .env file created with all credentials
- [ ] Database URL configured
- [ ] AWS credentials added
- [ ] S3 bucket name set
- [ ] SQS queue URLs set
- [ ] SES email configured
- [ ] Base URL set to EC2 IP

### Database & Build
- [ ] PostgreSQL container started
- [ ] Database migrations run
- [ ] Sample data seeded
- [ ] Application built successfully
- [ ] No build errors

### Service Startup
- [ ] Web server started with PM2
- [ ] Worker started with PM2
- [ ] PM2 config saved
- [ ] Auto-restart enabled
- [ ] Services show as "online" in `pm2 status`

### Functionality Testing
- [ ] Health endpoint returns OK
- [ ] Homepage loads in browser
- [ ] Calendar API returns data
- [ ] Can view signup page
- [ ] Can select date and slot
- [ ] Signup form appears
- [ ] Can submit signup
- [ ] Confirmation screen shows
- [ ] Email received
- [ ] S3 has JSON file
- [ ] SQS queue processed
- [ ] Worker logs show job processing

### Optional Enhancements
- [ ] HTTPS configured with Let's Encrypt
- [ ] Domain name pointed to EC2
- [ ] Nginx configured as reverse proxy
- [ ] Google Sheets sync configured
- [ ] Cognito user pool created
- [ ] Admin authentication working
- [ ] CloudWatch logging enabled
- [ ] Backup strategy implemented

---

## 🛠️ Automated Setup Scripts

### 1. `scripts/create-aws-resources.sh`
**Run on: Your local machine**
**Purpose:** Creates S3, SQS, SES, IAM user
**Output:** Credentials for .env file

```bash
chmod +x scripts/create-aws-resources.sh
./scripts/create-aws-resources.sh
```

### 2. `scripts/setup-ec2.sh`
**Run on: EC2 instance**
**Purpose:** Installs all dependencies
**Output:** Ready-to-configure application

```bash
chmod +x setup-ec2.sh
./setup-ec2.sh
```

---

## 🧪 Testing Commands

### Health Checks
```bash
# API health
curl http://localhost:3000/api/health

# Database connectivity
docker exec -it volunteer-signup-platform-db-1 psql -U volunteer_user -d volunteer_db -c "SELECT 1;"

# Process status
pm2 status

# Docker containers
docker ps
```

### Application Testing
```bash
# Test calendar API
curl http://YOUR_IP:3000/api/public/events/EVT001/calendar?month=2026-01

# Check S3 uploads
aws s3 ls s3://YOUR_BUCKET/signups/ --recursive

# Check SQS queue
aws sqs get-queue-attributes \
  --queue-url YOUR_QUEUE_URL \
  --attribute-names ApproximateNumberOfMessages

# View logs
pm2 logs --lines 50
```

### Database Inspection
```bash
# Connect to database
docker exec -it volunteer-signup-platform-db-1 psql -U volunteer_user -d volunteer_db

# Run queries
SELECT * FROM "Event";
SELECT * FROM "Signup" ORDER BY "createdAt" DESC LIMIT 5;
SELECT COUNT(*) FROM "Slot";
\q
```

---

## ⚠️ Common Issues & Solutions

### "Cannot connect to EC2"
```bash
# Fix security group
# EC2 Console → Security Groups → Edit Inbound Rules
# Add SSH (22) from "My IP"

# Fix key permissions
chmod 400 volunteer-app-key.pem
```

### "Database connection refused"
```bash
# Check Docker
docker ps
docker-compose restart db

# Check connection string in .env
# Should be: postgresql://volunteer_user:volunteer_pass_123@localhost:5432/volunteer_db
```

### "Email not received"
```bash
# Check SES verification
aws ses list-verified-email-addresses

# If in sandbox, verify recipient too
# SES Console → Verified Identities → Create Identity

# Request production access
# SES Console → Account Dashboard → Request production access
```

### "Worker not processing jobs"
```bash
# Check worker is running
pm2 status worker

# Restart worker
pm2 restart worker

# Check logs
pm2 logs worker --lines 100

# Manually receive message
aws sqs receive-message --queue-url YOUR_QUEUE_URL
```

### "Build fails with TypeScript errors"
```bash
# The TypeScript errors about React modules are expected
# The app will still build and run correctly

# If build actually fails:
rm -rf .next node_modules
npm install --legacy-peer-deps
npm run build
```

---

## 💰 Cost Optimization

### Use Free Tier
```bash
# Instead of t3.small, use t3.micro (first year)
# Instead of RDS, use Docker PostgreSQL
# Use SES sandbox mode for testing
```
**Estimated cost: $5-10/month**

### Stop When Not Testing
```bash
# Stop services
pm2 stop all
docker-compose stop

# Stop EC2 (AWS Console)
# This pauses charges but preserves data
```

### Delete When Done
See cleanup section in QUICKSTART_AWS.md

---

## 📊 Monitoring

### Real-time Monitoring
```bash
# PM2 dashboard
pm2 monit

# System resources
htop

# Disk usage
df -h

# Memory usage
free -h
```

### Application Logs
```bash
# All logs
pm2 logs

# Specific service
pm2 logs web
pm2 logs worker

# Last 100 lines
pm2 logs --lines 100

# Follow in real-time
pm2 logs --follow
```

### AWS Resources
```bash
# SQS queue depth
aws sqs get-queue-attributes \
  --queue-url YOUR_QUEUE_URL \
  --attribute-names All

# S3 bucket size
aws s3 ls s3://YOUR_BUCKET --recursive --summarize

# SES sending quota
aws ses get-send-quota
```

---

## 🔐 Security Best Practices

### Implemented
- ✅ PostgreSQL not exposed publicly
- ✅ S3 bucket private with encryption
- ✅ IAM user with minimal permissions
- ✅ Secrets in .env (not committed)
- ✅ Input validation on all forms
- ✅ SQL injection prevention (Prisma)
- ✅ XSS protection (React escaping)

### Recommended for Production
- [ ] Enable HTTPS with SSL certificate
- [ ] Use AWS Secrets Manager for credentials
- [ ] Enable CloudTrail for audit logging
- [ ] Set up VPC with private subnets
- [ ] Enable RDS encryption
- [ ] Configure WAF for DDoS protection
- [ ] Implement Cognito for admin auth
- [ ] Set up regular automated backups

---

## 🎓 Learning Resources

- AWS Free Tier: https://aws.amazon.com/free/
- EC2 Getting Started: https://docs.aws.amazon.com/ec2/
- SES Documentation: https://docs.aws.amazon.com/ses/
- Next.js Deployment: https://nextjs.org/docs/deployment
- PM2 Guide: https://pm2.keymetrics.io/docs/usage/quick-start/

---

## 📞 Support & Next Steps

### Got Questions?
1. Check troubleshooting sections in guides
2. Review AWS CloudWatch logs
3. Check PM2 logs: `pm2 logs`
4. Review application logs in CloudWatch

### Next Steps After Testing
1. ✅ Request SES production access
2. 🌐 Set up custom domain + HTTPS
3. 🔐 Configure Cognito authentication
4. 📊 Set up CloudWatch dashboards
5. 🔄 Implement CI/CD with GitHub Actions
6. 📧 Configure Google Sheets sync
7. 🎨 Customize branding and styling

---

## 📁 Project Structure Recap

```
volunteer-signup-platform/
├── AWS_TESTING_GUIDE.md          ← Detailed manual setup
├── QUICKSTART_AWS.md             ← 30-minute quick start ⚡
├── AWS_ARCHITECTURE.md           ← Diagrams & architecture
├── scripts/
│   ├── create-aws-resources.sh   ← AWS resource creation
│   └── setup-ec2.sh              ← EC2 server setup
├── src/
│   ├── app/                      ← Next.js pages
│   ├── components/               ← React components
│   ├── lib/                      ← Core libraries
│   └── worker/                   ← Background jobs
├── prisma/
│   ├── schema.prisma             ← Database schema
│   └── seed.ts                   ← Sample data
└── docker-compose.yml            ← Local development
```

---

## ✅ Success Criteria

Your deployment is successful when:

- ✅ Can visit `http://YOUR_EC2_IP:3000`
- ✅ Homepage loads with no errors
- ✅ Can view calendar for sample event
- ✅ Can sign up for volunteer slot
- ✅ Receive confirmation email
- ✅ S3 contains JSON backup
- ✅ Worker processes jobs from SQS
- ✅ No errors in `pm2 logs`
- ✅ Database has signup records
- ✅ Can download calendar .ics file

---

## 🎉 You're Ready!

You now have everything you need to deploy and test your volunteer signup platform on AWS!

**Start with:** [QUICKSTART_AWS.md](./QUICKSTART_AWS.md)

**Good luck! 🚀**
