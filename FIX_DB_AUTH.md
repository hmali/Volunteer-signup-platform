# 🚨 PostgreSQL Authentication Error - Quick Fix

## Problem
```
Error: P1000: Authentication failed against database server at localhost
```

## Solution (30 seconds)

### On Your EC2 Instance:

```bash
# 1. Go to project directory
cd ~/volunteer-signup-platform

# 2. Run the fix script
chmod +x scripts/fix-postgres.sh
./scripts/fix-postgres.sh
```

**The script will automatically**:
- ✅ Diagnose the exact issue
- ✅ Fix credential mismatches
- ✅ Start PostgreSQL if stopped
- ✅ Create missing database
- ✅ Test connection
- ✅ Tell you next steps

---

## Expected Output

You should see something like:

```
🔍 Diagnosing PostgreSQL Connection Issue...

[STEP] Checking Docker status...
✓ Docker is accessible

[STEP] Checking PostgreSQL container...
✓ Container 'volunteer-signup-platform-db-1' is running

[STEP] Parsing DATABASE_URL from .env...
✓ Credentials parsed successfully
  User: volunteer
  Password: ***
  Host: localhost
  Port: 5433
  Database: volunteer_signup

[STEP] Comparing with docker-compose.yml...
✓ Credentials match!

[STEP] Testing connection...
✓ Successfully connected to PostgreSQL

[INFO] Database is ready! You can now run:
  npx prisma migrate deploy
```

---

## If Script Fails

### Check Container Status
```bash
docker ps -a | grep db
```

**If not running**:
```bash
docker-compose up -d db
sleep 5
```

### Check Credentials Match
```bash
# From .env
grep DATABASE_URL .env

# From docker-compose.yml
grep -A 3 POSTGRES docker-compose.yml
```

**Username, password, and database name must match!**

### Common Mismatch Example

❌ **WRONG** - Credentials don't match:
```bash
# .env
DATABASE_URL="postgresql://admin:secret@localhost:5433/mydb?schema=public"

# docker-compose.yml
POSTGRES_USER: volunteer
POSTGRES_PASSWORD: volunteer_password
POSTGRES_DB: volunteer_signup
```

✅ **CORRECT** - Credentials match:
```bash
# .env
DATABASE_URL="postgresql://volunteer:volunteer_password@localhost:5433/volunteer_signup?schema=public"

# docker-compose.yml
POSTGRES_USER: volunteer
POSTGRES_PASSWORD: volunteer_password
POSTGRES_DB: volunteer_signup
```

---

## Manual Fix (if script doesn't work)

### 1. Update .env to match docker-compose.yml
```bash
# Backup current .env
cp .env .env.backup

# Edit .env
nano .env
```

**Update DATABASE_URL to match these values from docker-compose.yml**:
- Username: `POSTGRES_USER` value
- Password: `POSTGRES_PASSWORD` value
- Database: `POSTGRES_DB` value
- Port: `5433` (or whatever is mapped in ports section)

Example:
```env
DATABASE_URL="postgresql://volunteer:volunteer_password@localhost:5433/volunteer_signup?schema=public"
```

### 2. Restart PostgreSQL
```bash
docker-compose restart db
sleep 5
```

### 3. Test Connection
```bash
npx prisma db pull --force
```

✅ **Success**: You'll see "Prisma schema loaded from prisma/schema.prisma"

❌ **Still failing**: Continue to next section

---

## Nuclear Option (Fresh Start)

**⚠️ WARNING: This deletes all data!**

```bash
# Stop and remove everything
docker-compose down -v

# Start fresh PostgreSQL
docker-compose up -d db

# Wait for it to initialize
sleep 10

# Verify .env credentials match docker-compose.yml
# Then run migrations
npx prisma migrate deploy
```

---

## After Fix: Next Steps

Once database connection works:

```bash
# 1. Deploy migrations
npx prisma migrate deploy

# 2. Build application
npm run build

# 3. Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 status

# 4. Test health endpoint
curl http://localhost:3000/api/health
```

---

## Get More Help

If still stuck, run this to collect debug info:

```bash
# Save detailed diagnostics
./scripts/fix-postgres.sh > db-debug.txt 2>&1

# Show the output
cat db-debug.txt
```

**Then check**:
- `TROUBLESHOOT_DB.md` - Complete troubleshooting guide
- `QUICKSTART_AWS.md` - Full deployment guide
- Container logs: `docker logs $(docker ps -q --filter "name=db")`

---

## Prevention

✅ **DO**:
- Keep `.env` and `docker-compose.yml` credentials in sync
- Test locally before deploying
- Use version control for `docker-compose.yml`
- Backup `.env` before editing

❌ **DON'T**:
- Commit `.env` to git
- Change database credentials without updating both files
- Delete Docker volumes without backup
