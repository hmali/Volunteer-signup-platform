# 🎯 Database Connection - Copy & Paste Commands

## Current Error
```
P1000: Authentication failed against database server at localhost
```

---

## ⚡ Quick Fix (Copy all at once)

```bash
cd ~/volunteer-signup-platform
chmod +x scripts/fix-postgres.sh
./scripts/fix-postgres.sh
```

**This will diagnose and fix the issue automatically.**

---

## 📋 Step-by-Step (if quick fix doesn't work)

### Step 1: Check if PostgreSQL is running
```bash
docker ps | grep db
```

**Expected**: You should see a container with "db" in the name

**If NOT running**:
```bash
docker-compose up -d db
sleep 5
docker ps | grep db
```

---

### Step 2: Get credentials from docker-compose.yml
```bash
grep -A 5 POSTGRES docker-compose.yml
```

**Note down**:
- `POSTGRES_USER`: _____________
- `POSTGRES_PASSWORD`: _____________
- `POSTGRES_DB`: _____________

---

### Step 3: Check your current DATABASE_URL
```bash
grep DATABASE_URL .env
```

**Expected format**:
```
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5433/DATABASE?schema=public"
```

**Compare**: Do USER, PASSWORD, and DATABASE match step 2?

---

### Step 4: Fix credentials if they don't match

```bash
# Backup your .env
cp .env .env.backup

# Edit .env
nano .env
```

**Update the DATABASE_URL line to**:
```env
DATABASE_URL="postgresql://volunteer:volunteer_password@localhost:5433/volunteer_signup?schema=public"
```

**(Replace with YOUR credentials from step 2)**

**Save**: Press `Ctrl+X`, then `Y`, then `Enter`

---

### Step 5: Restart PostgreSQL
```bash
docker-compose restart db
sleep 5
```

---

### Step 6: Test connection
```bash
npx prisma db pull --force
```

**✅ Success**: You'll see "Prisma schema loaded"
**❌ Failed**: Run the full diagnostic script:

```bash
./scripts/fix-postgres.sh
```

---

## 🎯 After Connection Works

### Deploy database schema
```bash
npx prisma migrate deploy
```

### Generate Prisma Client
```bash
npx prisma generate
```

### Build application
```bash
npm run build
```

### Start with PM2
```bash
pm2 restart all
```

### Verify it's working
```bash
# Check PM2 status
pm2 status

# Check app health
curl http://localhost:3000/api/health

# Check logs
pm2 logs web --lines 50
```

---

## 🔍 Still Not Working?

### Get detailed logs
```bash
# PostgreSQL logs
docker logs $(docker ps -q --filter "name=db") | tail -50

# Application logs
pm2 logs web --lines 50

# Run full diagnostic
./scripts/fix-postgres.sh > debug-output.txt
cat debug-output.txt
```

---

## 📚 Documentation Files

- **FIX_DB_AUTH.md** - Quick reference for this error
- **TROUBLESHOOT_DB.md** - Complete troubleshooting guide
- **QUICKSTART_AWS.md** - Full deployment guide
- **AWS_TESTING_GUIDE.md** - Step-by-step AWS setup

---

## 🆘 Common Solutions

### Problem: "permission denied while trying to connect to Docker"
```bash
sudo usermod -aG docker $USER
newgrp docker
# Or logout and back in
```

### Problem: Port 5433 already in use
```bash
# Find what's using it
sudo lsof -i :5433

# Kill the process or change port in docker-compose.yml
```

### Problem: Container keeps restarting
```bash
# Check logs
docker logs $(docker ps -aq --filter "name=db")

# Remove and recreate
docker-compose down
docker-compose up -d db
```

### Problem: "relation does not exist"
```bash
# Database exists but schema is missing
npx prisma migrate deploy
```

### Problem: Wrong database name
```bash
# Connect to PostgreSQL
docker exec -it $(docker ps -q --filter "name=db") psql -U volunteer -d postgres

# List databases
\l

# If volunteer_signup doesn't exist, create it:
CREATE DATABASE volunteer_signup;
GRANT ALL PRIVILEGES ON DATABASE volunteer_signup TO volunteer;
\q
```

---

## ✅ Success Checklist

Once everything works, you should be able to:

- [ ] `docker ps` shows PostgreSQL running
- [ ] `npx prisma db pull` works without errors
- [ ] `npm run build` completes successfully
- [ ] `pm2 status` shows "online" for all processes
- [ ] `curl http://localhost:3000/api/health` returns success
- [ ] Can access app at `http://YOUR_EC2_IP:3000`

---

## 🚀 Next Steps After Database Works

1. **Set up Nginx** (for HTTPS and domain):
   ```bash
   sudo systemctl start nginx
   sudo systemctl enable nginx
   ```

2. **Configure AWS services** (if not done):
   ```bash
   ./scripts/create-aws-resources.sh
   ```

3. **Update .env with AWS credentials**

4. **Test complete signup flow**:
   - Visit signup page
   - Submit volunteer form
   - Check email delivery
   - Verify Google Sheets sync

5. **Set up monitoring**:
   ```bash
   pm2 install pm2-logrotate
   ```

See **QUICKSTART_AWS.md** for complete deployment guide.
