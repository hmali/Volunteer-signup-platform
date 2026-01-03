# 🚀 Volunteer Sign-Up Platform - EC2 Deployment Card

## Current Status: Database Authentication Fix Ready ✅

---

## 📍 You Are Here

```
✅ Code pushed to GitHub
✅ EC2 instance running
✅ Dependencies installed
✅ Docker & Docker Compose installed
⚠️  PostgreSQL authentication error (P1000)
❌ Database migrations not deployed
❌ Application not running
```

---

## 🎯 Quick Fix (2 minutes)

### On Your EC2 Instance:

```bash
# 1. Go to project
cd ~/volunteer-signup-platform

# 2. Run auto-fix script
chmod +x scripts/fix-postgres.sh
./scripts/fix-postgres.sh
```

**What it does**:
- Checks Docker & PostgreSQL status
- Compares .env vs docker-compose.yml credentials
- Auto-fixes mismatches
- Tests connection
- Tells you what to do next

---

## 📖 If Script Doesn't Work

Open one of these guides on your EC2 terminal:

| Guide | Purpose | When to Use |
|-------|---------|-------------|
| **FIX_DB_AUTH.md** | Quick reference | Need fast overview |
| **COPY_PASTE_DB_FIX.md** | Step-by-step commands | Want to copy/paste |
| **TROUBLESHOOT_DB.md** | Complete manual | Script didn't work |

```bash
# Read a guide directly on EC2
cat FIX_DB_AUTH.md | less
# Press 'q' to quit

# Or use nano
nano COPY_PASTE_DB_FIX.md
```

---

## ✅ After Database Works

Once `./scripts/fix-postgres.sh` succeeds:

```bash
# 1. Deploy database schema
npx prisma migrate deploy

# 2. Build application
npm run build

# 3. Start with PM2
pm2 start ecosystem.config.js
pm2 save

# 4. Check status
pm2 status
pm2 logs web --lines 20

# 5. Test health endpoint
curl http://localhost:3000/api/health
```

**Expected**: `{"status":"ok"}`

---

## 🌐 Access Your Application

Once PM2 shows "online":

```bash
# Get your EC2 public IP
curl -s http://169.254.169.254/latest/meta-data/public-ipv4
```

**Open in browser**:
```
http://YOUR_EC2_IP:3000
```

---

## 🔧 Common Quick Fixes

### PostgreSQL not running
```bash
docker-compose up -d db
sleep 5
```

### Credential mismatch
```bash
./scripts/quick-fix-db.sh
```

### Port 3000 blocked
```bash
# Check security group allows port 3000
# Or use Nginx (see QUICKSTART_AWS.md)
```

### PM2 not starting
```bash
pm2 delete all
pm2 start ecosystem.config.js
```

---

## 📚 Complete Documentation

All guides are in your project root:

### Setup & Deployment
- **QUICKSTART_AWS.md** - 30-min quick deployment
- **AWS_TESTING_GUIDE.md** - Complete 100+ step guide
- **AWS_ARCHITECTURE.md** - Infrastructure diagrams
- **AWS_SETUP_COMPLETE.md** - Master checklist

### Troubleshooting
- **FIX_DB_AUTH.md** - Database auth quick fix
- **COPY_PASTE_DB_FIX.md** - Copy/paste commands
- **TROUBLESHOOT_DB.md** - Complete DB troubleshooting
- **DB_TROUBLESHOOTING_COMPLETE.md** - All resources summary

### Development
- **README.md** - Project overview
- **ARCHITECTURE.md** - System design
- **API.md** - API documentation
- **FRONTEND_SUMMARY.md** - UI components

---

## 🎯 Next Steps After Application Runs

### 1. Set Up AWS Services
```bash
./scripts/create-aws-resources.sh
# Creates S3, SQS, SES automatically
```

### 2. Configure Environment
```bash
nano .env
# Add AWS credentials from step 1
```

### 3. Set Up Nginx (Optional - for HTTPS)
See **QUICKSTART_AWS.md** section "HTTPS with Let's Encrypt"

### 4. Test Complete Flow
- Visit signup page
- Submit volunteer form
- Check email delivery
- Verify Google Sheets sync
- Check S3 backup

---

## 🆘 Need Help?

### Get Debug Info
```bash
# Comprehensive diagnostics
./scripts/fix-postgres.sh > debug.txt 2>&1
cat debug.txt

# Docker logs
docker logs $(docker ps -q --filter "name=db")

# Application logs
pm2 logs web --lines 100

# System status
docker ps -a
pm2 status
```

### Reset Everything (Last Resort)
```bash
# WARNING: Deletes all data!
docker-compose down -v
docker-compose up -d db
sleep 5
npx prisma migrate deploy
npm run build
pm2 restart all
```

---

## 📊 Health Check Commands

```bash
# Database
docker ps | grep db
npx prisma db pull --force

# Application
pm2 status
curl http://localhost:3000/api/health

# Services
docker-compose ps
sudo systemctl status nginx
```

---

## 🎓 Architecture Quick Reference

```
User → Nginx (HTTPS) → Next.js App → PostgreSQL
                            ↓
                        SQS Queue → Worker
                            ↓
                    S3 + Sheets + SES
```

**Data Flow**:
1. User signs up → DB saves (atomic)
2. Job queued → SQS
3. Worker processes → Sheets sync + Email
4. Backup → S3

---

## 💰 Cost Estimate

**Testing Setup** (~$17/month):
- EC2 t3.small: $15
- S3: $1
- SQS + SES: <$1

**Production** (~$33/month):
- Add RDS PostgreSQL: +$15
- Add Route 53: +$1

**Free Tier** (first 12 months):
- EC2 t3.micro: FREE
- S3 5GB: FREE
- SES 62k emails: FREE

---

## ✨ Features Ready

- ✅ Calendar-based scheduling
- ✅ Automatic Thu/Fri exclusion
- ✅ Race-safe capacity enforcement
- ✅ Email confirmations (SES)
- ✅ Google Sheets export
- ✅ S3 JSON backup
- ✅ Secure cancellation links
- ✅ Admin dashboard (needs UI)
- ✅ Background worker
- ✅ Comprehensive testing

---

## 📞 Support Resources

1. **Documentation**: All guides in project root
2. **Logs**: `pm2 logs` and `docker logs`
3. **Scripts**: Automated helpers in `scripts/`
4. **Health Check**: `/api/health` endpoint

---

## 🎉 Success Criteria

You're ready to go live when:

- [ ] `docker ps` shows PostgreSQL running
- [ ] `npx prisma migrate deploy` completes
- [ ] `npm run build` succeeds
- [ ] `pm2 status` shows all "online"
- [ ] `/api/health` returns `{"status":"ok"}`
- [ ] Can access at `http://YOUR_IP:3000`
- [ ] Can submit test signup
- [ ] Email confirmation received
- [ ] Google Sheets updated

---

**Last Updated**: January 2, 2026
**Current Phase**: Database Connection Fix
**Next Phase**: Complete AWS Setup
