# PostgreSQL Connection Troubleshooting Guide

## Current Error
```
P1000: Authentication failed against database server at localhost
```

This error means Prisma cannot connect to your PostgreSQL database. Let's fix it!

---

## Quick Fix (Run on EC2)

### 1. Navigate to your project
```bash
cd ~/volunteer-signup-platform
```

### 2. Run the diagnostic script
```bash
chmod +x scripts/fix-postgres.sh
./scripts/fix-postgres.sh
```

The script will:
- ✅ Check if Docker is running
- ✅ Verify PostgreSQL container status
- ✅ Parse your `.env` DATABASE_URL
- ✅ Compare credentials between `.env` and `docker-compose.yml`
- ✅ Auto-fix credential mismatches
- ✅ Create database if missing
- ✅ Test connection at multiple levels
- ✅ Provide specific next steps

---

## Manual Troubleshooting (if script doesn't work)

### Step 1: Check Docker Status
```bash
# Check if Docker is running
sudo systemctl status docker

# If not running, start it
sudo systemctl start docker

# Check containers
docker ps -a
```

**Expected Output**: You should see a container named something like `volunteer-signup-platform-db-1`

### Step 2: Check Container Logs
```bash
# View PostgreSQL logs
docker logs volunteer-signup-platform-db-1

# Or if named differently:
docker logs $(docker ps -a --filter "name=db" -q)
```

**Look for**: Errors about authentication, password, or initialization

### Step 3: Verify .env Credentials
```bash
# Show DATABASE_URL (masks password)
grep DATABASE_URL .env | sed 's/:[^:@]*@/:***@/'
```

**Expected Format**:
```
DATABASE_URL="postgresql://volunteer:***@localhost:5433/volunteer_signup?schema=public"
```

### Step 4: Compare with docker-compose.yml
```bash
# Show PostgreSQL environment variables
grep -A 5 "POSTGRES_" docker-compose.yml
```

**Check**: User, password, and database name must match between:
- `.env` DATABASE_URL
- `docker-compose.yml` environment variables

### Step 5: Restart PostgreSQL Container
```bash
# Stop and remove container
docker-compose down

# Start fresh
docker-compose up -d db

# Wait for it to be ready
sleep 5

# Check if it's healthy
docker ps
```

### Step 6: Test Connection Manually
```bash
# Get container ID
CONTAINER_ID=$(docker ps -q --filter "name=db")

# Test connection inside container
docker exec -it $CONTAINER_ID psql -U volunteer -d volunteer_signup

# If successful, you'll see:
# volunteer_signup=#

# Type \q to quit
```

### Step 7: Run Prisma Migration
```bash
# Generate Prisma Client
npx prisma generate

# Deploy migrations
npx prisma migrate deploy
```

---

## Common Issues & Solutions

### Issue 1: Container Not Running
```bash
# Symptom
docker ps  # Shows no db container

# Solution
docker-compose up -d db
```

### Issue 2: Port Already in Use
```bash
# Symptom
Error: bind: address already in use

# Find what's using port 5433
sudo lsof -i :5433

# Kill the process or change port in docker-compose.yml
```

### Issue 3: Permission Denied
```bash
# Symptom
permission denied while trying to connect to the Docker daemon

# Solution
sudo usermod -aG docker $USER
newgrp docker  # Activate immediately
```

### Issue 4: Database Doesn't Exist
```bash
# Connect to postgres database
docker exec -it $(docker ps -q --filter "name=db") psql -U volunteer -d postgres

# Create database
CREATE DATABASE volunteer_signup;

# Grant permissions
GRANT ALL PRIVILEGES ON DATABASE volunteer_signup TO volunteer;

# Exit
\q
```

---

## Verification Checklist

After fixing, verify everything works:

- [ ] `docker ps` shows db container running
- [ ] `docker logs <container>` shows no errors
- [ ] `.env` DATABASE_URL matches `docker-compose.yml` credentials
- [ ] `npx prisma db pull` works without errors
- [ ] `npx prisma migrate deploy` completes successfully
- [ ] `npm run dev` starts without database errors

---

## Still Not Working?

### Reset Everything (Nuclear Option)
```bash
# WARNING: This deletes all data!
docker-compose down -v  # Remove containers and volumes
docker-compose up -d db  # Start fresh
sleep 5
npx prisma migrate deploy  # Recreate schema
```

---

## Next Steps After Fix

Once database connection works:

1. **Deploy migrations**:
   ```bash
   npx prisma migrate deploy
   ```

2. **Build application**:
   ```bash
   npm run build
   ```

3. **Start with PM2**:
   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   ```

4. **Test the application**:
   ```bash
   curl http://localhost:3000/api/health
   ```

---

## Additional Resources

- **FIX_DB_AUTH.md** - Quick reference card
- **COPY_PASTE_DB_FIX.md** - Terminal commands ready to copy
- **DB_TROUBLESHOOTING_COMPLETE.md** - Summary of all resources
- **QUICKSTART_AWS.md** - Full deployment guide
