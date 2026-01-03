#!/bin/bash
# One-line database connection fixer
# Usage: curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/volunteer-signup-platform/main/scripts/quick-fix-db.sh | bash

echo "🔧 Quick Database Connection Fix"
echo ""

# Ensure we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Error: Not in project directory. Run: cd ~/volunteer-signup-platform"
    exit 1
fi

# Start PostgreSQL if not running
if ! docker ps | grep -q "db"; then
    echo "▶️  Starting PostgreSQL..."
    docker-compose up -d db
    sleep 5
fi

# Extract credentials from docker-compose.yml
POSTGRES_USER=$(grep "POSTGRES_USER:" docker-compose.yml | awk '{print $2}' | tr -d '"')
POSTGRES_PASS=$(grep "POSTGRES_PASSWORD:" docker-compose.yml | awk '{print $2}' | tr -d '"')
POSTGRES_DB=$(grep "POSTGRES_DB:" docker-compose.yml | awk '{print $2}' | tr -d '"')

# Build correct DATABASE_URL
NEW_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASS}@localhost:5433/${POSTGRES_DB}?schema=public"

# Backup and update .env
if [ -f ".env" ]; then
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    echo "📦 Backed up .env"
fi

# Update DATABASE_URL
if grep -q "^DATABASE_URL=" .env 2>/dev/null; then
    sed -i.bak "s|^DATABASE_URL=.*|DATABASE_URL=\"${NEW_URL}\"|" .env
else
    echo "DATABASE_URL=\"${NEW_URL}\"" >> .env
fi

echo "✅ Updated .env with correct credentials"
echo ""
echo "Testing connection..."

# Test with Prisma
if npx prisma db pull --force > /dev/null 2>&1; then
    echo "✅ Success! Database connection working!"
    echo ""
    echo "Next steps:"
    echo "  npx prisma migrate deploy"
    echo "  npm run build"
    echo "  pm2 restart all"
else
    echo "❌ Still having issues. Run for detailed diagnosis:"
    echo "  ./scripts/fix-postgres.sh"
fi
