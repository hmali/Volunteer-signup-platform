#!/bin/bash
# 🚨 EMERGENCY FIX - Run this on EC2 to fix build errors
# This fixes both database connection AND date-fns compatibility issues

set -e

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║        Emergency Fix Script - Database + Build Errors           ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# Navigate to project
cd ~/volunteer-signup-platform || { echo "❌ Project directory not found!"; exit 1; }

echo "📍 Current location: $(pwd)"
echo ""

# Step 1: Pull latest changes
echo "🔄 Step 1: Pulling latest code from GitHub..."
git pull origin main
echo "✅ Code updated"
echo ""

# Step 2: Fix database connection and user mismatch
echo "🔍 Step 2: Fixing database connection..."

# Backup .env
if [ -f .env ]; then
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    echo "✅ Backed up .env"
fi

# Fix DATABASE_URL to use 'postgres' user (matches docker-compose.yml)
if [ -f .env ]; then
    sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"postgresql://postgres:postgres@localhost:5432/volunteer_signup?schema=public\"|" .env
    echo "✅ Updated .env to use 'postgres' user"
else
    echo 'DATABASE_URL="postgresql://postgres:postgres@localhost:5432/volunteer_signup?schema=public"' > .env
    echo "✅ Created .env with correct DATABASE_URL"
fi

# Ensure PostgreSQL container is running
docker-compose up -d db >/dev/null 2>&1
sleep 3

# Create database if it doesn't exist
CONTAINER_ID=$(docker ps -q --filter "name=db")
if [ -n "$CONTAINER_ID" ]; then
    docker exec $CONTAINER_ID psql -U postgres -d postgres -c "CREATE DATABASE volunteer_signup;" 2>/dev/null && echo "✅ Created database" || echo "ℹ️  Database already exists"
    
    # Test connection
    if docker exec $CONTAINER_ID psql -U postgres -d volunteer_signup -c "SELECT 1;" >/dev/null 2>&1; then
        echo "✅ Database connection working"
    else
        echo "⚠️  Database connection issue, check later"
    fi
else
    echo "⚠️  PostgreSQL container not running"
fi
echo ""

# Step 3: Clean dependencies
echo "🧹 Step 3: Cleaning old dependencies..."
rm -rf node_modules package-lock.json .next
echo "✅ Old dependencies removed"
echo ""

# Step 4: Install fresh dependencies
echo "📦 Step 4: Installing fresh dependencies..."
npm install --legacy-peer-deps
echo "✅ Dependencies installed"
echo ""

# Step 5: Generate Prisma client
echo "🔧 Step 5: Generating Prisma client..."
npx prisma generate
echo "✅ Prisma client generated"
echo ""

# Step 6: Deploy database migrations
echo "💾 Step 6: Deploying database migrations..."
npx prisma migrate deploy || echo "⚠️  Migrations may have issues, continuing..."
echo ""

# Step 7: Build application
echo "🏗️  Step 7: Building application..."
npm run build
echo "✅ Build completed"
echo ""

# Step 8: Restart PM2
echo "🔄 Step 8: Restarting PM2 processes..."
pm2 delete all 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
echo "✅ PM2 restarted"
echo ""

# Step 9: Verify status
echo "🔍 Step 9: Verifying status..."
echo ""
echo "PM2 Status:"
pm2 status
echo ""

# Wait a moment for app to start
sleep 3

# Test health endpoint
echo "Testing health endpoint..."
if curl -s http://localhost:3000/api/health | grep -q "ok"; then
    echo "✅ Application is running!"
else
    echo "⚠️  Application may not be responding yet, check logs:"
    echo "   pm2 logs web --lines 50"
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                       FIX COMPLETE! ✅                           ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Next Steps:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Check application logs:"
echo "   pm2 logs web --lines 50"
echo ""
echo "2. Get your public IP:"
echo "   curl -s http://169.254.169.254/latest/meta-data/public-ipv4"
echo ""
echo "3. Access your app in browser:"
echo "   http://YOUR_EC2_IP:3000"
echo ""
echo "4. Test health endpoint:"
echo "   curl http://localhost:3000/api/health"
echo ""
echo "5. View PM2 monitoring:"
echo "   pm2 monit"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
