# 🚨 Build Error Fix - date-fns Compatibility

## Error Message
```
Module not found: Package path ./_lib/getTimezoneOffsetInMilliseconds/index.js 
is not exported from package date-fns
```

## Root Cause
Version incompatibility between `date-fns` v3.x and `date-fns-tz` v2.x.

---

## ✅ Quick Fix (Run on EC2)

### 1. Pull the latest code
```bash
cd ~/volunteer-signup-platform
git pull origin main
```

### 2. Remove old dependencies
```bash
rm -rf node_modules package-lock.json
```

### 3. Install compatible versions
```bash
npm install
```

### 4. Rebuild the application
```bash
npm run build
```

### 5. Restart PM2
```bash
pm2 restart all
```

---

## 📋 What Was Fixed

**Before** (Incompatible):
```json
"date-fns": "^3.0.6",
"date-fns-tz": "^2.0.0"
```

**After** (Compatible):
```json
"date-fns": "^2.30.0",
"date-fns-tz": "^2.0.0"
```

---

## 🔍 Database Configuration Also Fixed

**Updated `.env.example` to match `docker-compose.yml`**:

**Before**:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/volunteer_signup?schema=public"
```

**After**:
```env
# For local development with Docker Compose:
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/volunteer_signup?schema=public"
```

---

## 🚀 Complete Fix Procedure (Copy & Paste)

```bash
# Navigate to project
cd ~/volunteer-signup-platform

# Pull latest changes
git pull origin main

# Remove old dependencies
rm -rf node_modules package-lock.json

# Install fresh dependencies
npm install

# Ensure database is running
docker-compose up -d db
sleep 5

# Deploy database schema
npx prisma generate
npx prisma migrate deploy

# Build application
npm run build

# Restart all services
pm2 restart all
pm2 save

# Check status
pm2 status
pm2 logs web --lines 20
```

---

## ✅ Verify Fix

```bash
# Check build succeeded
npm run build

# Should complete without errors

# Check app is running
curl http://localhost:3000/api/health

# Should return: {"status":"ok"}

# Check PM2 status
pm2 status

# All processes should show "online"
```

---

## 🆘 If Still Failing

### Clear everything and start fresh:
```bash
# Stop all processes
pm2 delete all

# Remove all node modules
rm -rf node_modules package-lock.json

# Remove Next.js cache
rm -rf .next

# Install dependencies
npm install

# Rebuild
npm run build

# Start fresh
pm2 start ecosystem.config.js
pm2 save
```

---

## 📊 Version Compatibility Chart

| date-fns | date-fns-tz | Status |
|----------|-------------|--------|
| 3.x      | 2.x         | ❌ Incompatible |
| 2.30.x   | 2.x         | ✅ Compatible |
| 3.x      | 3.x         | ✅ Compatible |

**We chose**: `date-fns@2.30.0` + `date-fns-tz@2.0.0` for stability.

---

## 🔄 Alternative: Upgrade Both to v3

If you prefer the latest versions:

```bash
npm install date-fns@^3.0.6 date-fns-tz@^3.0.0
```

But this may require code changes if the API changed.

---

## 💡 Prevention

Always check compatibility between related packages:
- Read package.json peer dependencies
- Check package release notes
- Test locally before deploying

---

## 📚 Related Documentation

- **DEPLOYMENT_CARD.md** - Deployment checklist
- **FIX_DB_AUTH.md** - Database connection fix
- **TROUBLESHOOT_DB.md** - Database troubleshooting

---

## ✨ After This Fix

Your application should build successfully and you can proceed with:
1. Testing the signup flow
2. Setting up AWS services
3. Configuring email and Sheets sync
4. Setting up Nginx for HTTPS

See **QUICKSTART_AWS.md** for next steps!
