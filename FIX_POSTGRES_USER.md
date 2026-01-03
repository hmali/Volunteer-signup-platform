# 🚨 PostgreSQL User Error Fix

## Error
```
psql: error: FATAL: role "volunteer" does not exist
```

## Root Cause
Your `docker-compose.yml` creates PostgreSQL with user `postgres`, but your `.env` file is trying to use user `volunteer`.

---

## ⚡ FASTEST FIX (30 seconds on EC2)

### Copy & paste this entire block:

```bash
cd ~/volunteer-signup-platform

# Backup .env
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

# Update DATABASE_URL to use 'postgres' user (matches docker-compose.yml)
cat > .env << 'EOF'
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/volunteer_signup?schema=public"
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="your-access-key-id"
AWS_SECRET_ACCESS_KEY="your-secret-access-key"
S3_BUCKET_NAME="volunteer-signups-bucket"
S3_BUCKET_REGION="us-east-1"
SQS_QUEUE_URL="https://sqs.us-east-1.amazonaws.com/123456789012/volunteer-jobs"
SQS_DLQ_URL="https://sqs.us-east-1.amazonaws.com/123456789012/volunteer-jobs-dlq"
SES_FROM_EMAIL="noreply@yourdomain.com"
SES_FROM_NAME="Temple Volunteering"
SES_REGION="us-east-1"
COGNITO_USER_POOL_ID="us-east-1_ABC123XYZ"
COGNITO_CLIENT_ID="your-cognito-app-client-id"
COGNITO_REGION="us-east-1"
NEXTAUTH_SECRET="change-this-to-a-random-secret-at-least-32-characters-long"
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_SERVICE_ACCOUNT_EMAIL="volunteer-sync@your-project.iam.gserviceaccount.com"
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-private-key-here\n-----END PRIVATE KEY-----"
GOOGLE_PROJECT_ID="your-google-cloud-project-id"
GOOGLE_DRIVE_FOLDER_ID="1abc123def456ghi789jkl"
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
DEFAULT_TIMEZONE="America/New_York"
WORKER_POLL_INTERVAL_MS="5000"
WORKER_MAX_RETRIES="5"
WORKER_RETRY_BACKOFF_MS="1000"
RATE_LIMIT_SIGNUP_PER_MINUTE="10"
RATE_LIMIT_CALENDAR_PER_MINUTE="60"
NODE_ENV="production"
LOG_LEVEL="info"
DISABLE_EMAIL_SENDING="true"
DISABLE_SHEETS_SYNC="true"
EOF

echo "✅ Updated .env to use 'postgres' user"

# Test connection
docker exec $(docker ps -q --filter "name=db") psql -U postgres -d volunteer_signup -c "SELECT 1;" && echo "✅ Connection works!" || echo "❌ Database might not exist yet"

# Create database if it doesn't exist
docker exec $(docker ps -q --filter "name=db") psql -U postgres -d postgres -c "CREATE DATABASE volunteer_signup;" 2>/dev/null || echo "ℹ️  Database already exists"

# Test again
docker exec $(docker ps -q --filter "name=db") psql -U postgres -d volunteer_signup -c "SELECT version();" && echo "✅ Database ready!"
```

---

## 🎯 Then Deploy Schema:

```bash
# Generate Prisma client
npx prisma generate

# Deploy migrations
npx prisma migrate deploy

# Build app
npm run build

# Restart PM2
pm2 restart all
pm2 save

# Check status
pm2 status
```

---

## 🔄 Alternative: Use Interactive Script

```bash
cd ~/volunteer-signup-platform
./scripts/fix-postgres-user.sh
```

This script gives you 3 options:
1. **Update .env to use 'postgres'** (recommended)
2. **Create 'volunteer' user** (keeps .env as-is)
3. **Recreate container with 'volunteer' user** (destroys data)

---

## ✅ Verify It Works

```bash
# Test database connection
docker exec $(docker ps -q --filter "name=db") psql -U postgres -d volunteer_signup -c "\dt"

# Test Prisma
npx prisma db pull --force

# Should see: "Prisma schema loaded from prisma/schema.prisma"
```

---

## 📋 What Changed

**Before** (WRONG):
```env
DATABASE_URL="postgresql://volunteer:password@localhost:5432/volunteer_signup?schema=public"
```

**After** (CORRECT):
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/volunteer_signup?schema=public"
```

This matches your `docker-compose.yml` settings:
```yaml
POSTGRES_USER: postgres
POSTGRES_PASSWORD: postgres
POSTGRES_DB: volunteer_signup
```

---

## 🔍 Why This Happened

1. Your `docker-compose.yml` creates PostgreSQL with user `postgres`
2. Your `.env.example` had user `volunteer` as a placeholder
3. When you copied `.env.example` to `.env`, the mismatch occurred

---

## 🛡️ Prevention

Always match these three places:
- `docker-compose.yml` → POSTGRES_USER
- `.env` → DATABASE_URL username
- `prisma/schema.prisma` → datasource url

---

## 🆘 Still Not Working?

```bash
# Check what user Docker is using
docker exec $(docker ps -q --filter "name=db") psql -U postgres -d postgres -c "\du"

# Check current .env
grep DATABASE_URL .env

# Compare with docker-compose.yml
grep POSTGRES docker-compose.yml
```

---

## 📞 Debug Info

```bash
# Get comprehensive debug output
cat << 'SCRIPT' > /tmp/debug-db.sh
#!/bin/bash
echo "=== DOCKER CONTAINER ==="
docker ps -a | grep db

echo -e "\n=== DOCKER COMPOSE CONFIG ==="
grep -A 5 POSTGRES docker-compose.yml

echo -e "\n=== CURRENT .ENV ==="
grep DATABASE_URL .env | sed 's/:[^:@]*@/:***@/'

echo -e "\n=== POSTGRESQL USERS ==="
docker exec $(docker ps -q --filter "name=db") psql -U postgres -d postgres -c "\du"

echo -e "\n=== DATABASES ==="
docker exec $(docker ps -q --filter "name=db") psql -U postgres -d postgres -c "\l"
SCRIPT

chmod +x /tmp/debug-db.sh
/tmp/debug-db.sh
```
