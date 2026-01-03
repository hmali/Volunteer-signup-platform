# 🎉 Database Troubleshooting Resources - Complete

## What We Created

We've built a comprehensive troubleshooting suite to help you fix the PostgreSQL authentication error (`P1000`) on your EC2 instance.

---

## 📚 Documentation Files

### 1. **FIX_DB_AUTH.md** - Quick Reference Card
**Purpose**: 30-second quick fix for the authentication error

**Contains**:
- Problem statement
- One-command solution
- Expected output
- Common credential mismatch examples
- Manual fix steps
- Nuclear option (fresh start)
- Next steps after fix
- Prevention tips

**Best for**: Quick reference while on EC2 terminal

---

### 2. **COPY_PASTE_DB_FIX.md** - Terminal Commands
**Purpose**: Copy-paste commands for EC2 terminal

**Contains**:
- Step-by-step commands with explanations
- Visual success/failure indicators
- Credential extraction commands
- Testing procedures
- Common error solutions
- Success checklist
- Next steps

**Best for**: Following along step-by-step on EC2

---

### 3. **TROUBLESHOOT_DB.md** - Comprehensive Guide
**Purpose**: Complete troubleshooting manual

**Contains**:
- Quick fix section
- Manual troubleshooting (8 steps)
- Common issues & solutions (5 scenarios)
- Verification checklist
- Debug info collection
- Nuclear reset option
- Prevention tips

**Best for**: When automated scripts don't work

---

## 🛠️ Scripts

### 1. **scripts/fix-postgres.sh** - Main Diagnostic Script
**What it does**:
- ✅ Checks Docker status
- ✅ Verifies PostgreSQL container
- ✅ Parses DATABASE_URL from .env
- ✅ Compares credentials with docker-compose.yml
- ✅ Auto-fixes credential mismatches
- ✅ Creates missing database
- ✅ Tests connection at multiple levels
- ✅ Provides specific next steps

**Usage**:
```bash
cd ~/volunteer-signup-platform
chmod +x scripts/fix-postgres.sh
./scripts/fix-postgres.sh
```

**Output**: Detailed diagnostic report with color-coded status messages

---

### 2. **scripts/quick-fix-db.sh** - One-Liner Fix
**What it does**:
- Starts PostgreSQL if stopped
- Extracts correct credentials from docker-compose.yml
- Updates .env automatically
- Tests connection
- Shows next steps

**Usage**:
```bash
cd ~/volunteer-signup-platform
./scripts/quick-fix-db.sh
```

**Output**: Quick fix with minimal output

---

## 🎯 Usage Flow

```
┌─────────────────────────────────────────────┐
│ User encounters P1000 authentication error  │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│ 1. Read FIX_DB_AUTH.md for quick context    │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│ 2. Run ./scripts/fix-postgres.sh            │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
         ┌────────┴────────┐
         │                 │
    ✅ Fixed          ❌ Still broken
         │                 │
         │                 ▼
         │    ┌────────────────────────────┐
         │    │ 3. Use COPY_PASTE_DB_FIX.md│
         │    │    for manual steps        │
         │    └─────────────┬──────────────┘
         │                  │
         │                  ▼
         │         ┌────────┴────────┐
         │         │                 │
         │    ✅ Fixed          ❌ Still broken
         │         │                 │
         │         │                 ▼
         │         │    ┌──────────────────────────┐
         │         │    │ 4. Read TROUBLESHOOT_DB.md│
         │         │    │    for advanced fixes    │
         │         │    └──────────┬───────────────┘
         │         │               │
         └─────────┴───────────────┘
                   │
                   ▼
         ┌─────────────────────┐
         │ 5. Run next steps:  │
         │ - prisma migrate    │
         │ - npm run build     │
         │ - pm2 restart       │
         └─────────────────────┘
```

---

## 🔍 What Each File Answers

| Question | Best File |
|----------|-----------|
| "How do I fix this quickly?" | `FIX_DB_AUTH.md` |
| "What commands should I run?" | `COPY_PASTE_DB_FIX.md` |
| "The script didn't work, now what?" | `TROUBLESHOOT_DB.md` |
| "I want automated fix" | `scripts/fix-postgres.sh` |
| "I just need credentials updated" | `scripts/quick-fix-db.sh` |

---

## 📋 Common Scenarios

### Scenario 1: Credentials Mismatch
**Symptoms**: 
- P1000 authentication error
- Can't connect to database
- Prisma commands fail

**Solution**:
```bash
./scripts/fix-postgres.sh
# Script detects mismatch and offers to auto-fix
```

**Manual Alternative**:
```bash
# Check docker-compose.yml credentials
grep -A 3 POSTGRES docker-compose.yml

# Update .env to match
nano .env
# Update DATABASE_URL with correct credentials
```

---

### Scenario 2: Container Not Running
**Symptoms**:
- `docker ps | grep db` shows nothing
- Connection refused error

**Solution**:
```bash
docker-compose up -d db
sleep 5
./scripts/fix-postgres.sh
```

---

### Scenario 3: Database Doesn't Exist
**Symptoms**:
- Can connect but "database does not exist"

**Solution**:
```bash
./scripts/fix-postgres.sh
# Script auto-creates database if missing
```

**Manual Alternative**:
```bash
docker exec -it $(docker ps -q --filter "name=db") psql -U volunteer -d postgres
CREATE DATABASE volunteer_signup;
GRANT ALL PRIVILEGES ON DATABASE volunteer_signup TO volunteer;
\q
```

---

### Scenario 4: Permission Issues
**Symptoms**:
- "permission denied" for Docker commands

**Solution**:
```bash
sudo usermod -aG docker $USER
newgrp docker
# Or logout and back in
```

---

### Scenario 5: Port Already in Use
**Symptoms**:
- "address already in use" for port 5433

**Solution**:
```bash
# Find what's using it
sudo lsof -i :5433

# Kill the process
sudo kill -9 <PID>

# Or change port in docker-compose.yml
```

---

## ✅ Success Criteria

After running fixes, you should be able to:

```bash
# 1. See PostgreSQL running
docker ps | grep db
# Output: Shows container in "Up" status

# 2. Connect with Prisma
npx prisma db pull --force
# Output: "Prisma schema loaded from prisma/schema.prisma"

# 3. Deploy migrations
npx prisma migrate deploy
# Output: All migrations applied successfully

# 4. Build app
npm run build
# Output: Build completed without errors

# 5. Start with PM2
pm2 restart all
# Output: All processes online

# 6. Access health endpoint
curl http://localhost:3000/api/health
# Output: {"status":"ok"}
```

---

## 🚀 Next Steps After Database Works

1. **Complete Application Setup**:
   ```bash
   npx prisma migrate deploy
   npm run build
   pm2 restart all
   pm2 save
   ```

2. **Set Up AWS Services**:
   ```bash
   ./scripts/create-aws-resources.sh
   # Follow prompts to create S3, SQS, SES
   ```

3. **Update Environment Variables**:
   ```bash
   nano .env
   # Add AWS credentials from step 2
   ```

4. **Configure Nginx** (for HTTPS):
   - See `QUICKSTART_AWS.md` section on Nginx setup
   - Install Let's Encrypt certificate
   - Configure reverse proxy

5. **Test Complete Flow**:
   - Visit signup page at `http://YOUR_EC2_IP`
   - Submit volunteer signup
   - Check email delivery
   - Verify Google Sheets sync
   - Check S3 backup

6. **Set Up Monitoring**:
   ```bash
   pm2 install pm2-logrotate
   pm2 set pm2-logrotate:max_size 10M
   pm2 set pm2-logrotate:retain 7
   ```

---

## 📖 Additional Documentation

- **QUICKSTART_AWS.md** - 30-minute deployment guide
- **AWS_TESTING_GUIDE.md** - Complete AWS setup (100+ steps)
- **AWS_ARCHITECTURE.md** - Infrastructure diagrams
- **AWS_SETUP_COMPLETE.md** - Master checklist
- **FRONTEND_SUMMARY.md** - UI components documentation

---

## 🆘 Still Need Help?

If you've tried all scripts and manual steps:

1. **Collect Debug Info**:
   ```bash
   ./scripts/fix-postgres.sh > debug.txt 2>&1
   docker logs $(docker ps -q --filter "name=db") >> debug.txt
   cat .env | grep -v PASSWORD >> debug.txt
   cat debug.txt
   ```

2. **Check These**:
   - Container logs: `docker logs <container-id>`
   - Application logs: `pm2 logs web --lines 100`
   - Nginx logs: `sudo tail -50 /var/log/nginx/error.log`
   - System logs: `sudo journalctl -xe | tail -50`

3. **Common Last Resorts**:
   ```bash
   # Rebuild everything
   docker-compose down -v
   docker-compose up -d
   npm run build
   pm2 restart all
   ```

---

## 📊 File Sizes & Locations

```
/Users/hmali/Documents/GitHub/Volunteer-signup-platform/
├── FIX_DB_AUTH.md              (~4 KB) - Quick reference
├── COPY_PASTE_DB_FIX.md        (~6 KB) - Terminal commands
├── TROUBLESHOOT_DB.md          (~8 KB) - Comprehensive guide
├── scripts/
│   ├── fix-postgres.sh         (~8 KB) - Main diagnostic
│   └── quick-fix-db.sh         (~2 KB) - Quick fixer
└── README.md                   (updated with links)
```

---

## 🎯 Summary

We created:
- ✅ **3 documentation files** covering quick to comprehensive troubleshooting
- ✅ **2 automated scripts** for diagnosis and fixing
- ✅ **Multiple usage paths** from automated to fully manual
- ✅ **Common scenario guides** with specific solutions
- ✅ **Success criteria** to verify fixes worked
- ✅ **Next steps guide** for post-fix deployment

**Total**: 5 new files + updated README with quick links

All scripts are executable and ready to use on EC2!
