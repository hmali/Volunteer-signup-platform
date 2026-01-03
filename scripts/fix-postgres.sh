#!/bin/bash
# Troubleshooting and Fixing PostgreSQL Connection Issues
# Run this on your EC2 instance

set -e

echo "🔍 Diagnosing PostgreSQL Connection Issue..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_step() {
    echo -e "${GREEN}[STEP]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

# Step 1: Check if Docker is running
print_step "Checking Docker status..."
if ! docker ps &> /dev/null; then
    print_error "Docker is not running or you don't have permission"
    echo "Fixing permissions..."
    sudo usermod -aG docker $USER
    echo "Please log out and back in, then run this script again"
    exit 1
else
    echo "✓ Docker is accessible"
fi

# Step 2: Check if PostgreSQL container exists
print_step "Checking PostgreSQL container..."
CONTAINER_NAME=$(docker ps -a --filter "name=postgres\|db" --format "{{.Names}}" | head -n 1)

if [ -z "$CONTAINER_NAME" ]; then
    print_error "No PostgreSQL container found"
    echo "Let's start it with docker-compose..."
    
    # Check if docker-compose.yml exists
    if [ ! -f "docker-compose.yml" ]; then
        print_error "docker-compose.yml not found in current directory"
        echo "Please run this from the project root: cd ~/volunteer-signup-platform"
        exit 1
    fi
    
    print_step "Starting PostgreSQL with docker-compose..."
    docker-compose up -d db
    sleep 10
    
    CONTAINER_NAME=$(docker ps --filter "name=postgres\|db" --format "{{.Names}}" | head -n 1)
    if [ -z "$CONTAINER_NAME" ]; then
        print_error "Failed to start PostgreSQL container"
        echo "Checking logs..."
        docker-compose logs db
        exit 1
    fi
else
    echo "✓ Found container: $CONTAINER_NAME"
fi

# Step 3: Check if container is running
print_step "Checking if container is running..."
if ! docker ps --filter "name=$CONTAINER_NAME" --format "{{.Names}}" | grep -q "$CONTAINER_NAME"; then
    print_info "Container exists but is not running. Starting it..."
    docker start "$CONTAINER_NAME"
    sleep 5
fi

# Step 4: Check container status
STATUS=$(docker inspect --format='{{.State.Status}}' "$CONTAINER_NAME" 2>/dev/null || echo "unknown")
echo "Container status: $STATUS"

if [ "$STATUS" != "running" ]; then
    print_error "Container is not running properly"
    echo "Checking logs..."
    docker logs "$CONTAINER_NAME" --tail 20
    exit 1
fi

echo "✓ PostgreSQL container is running"

# Step 5: Extract database credentials from .env
print_step "Checking .env file..."
if [ ! -f ".env" ]; then
    print_error ".env file not found!"
    echo "Please create it from the template:"
    echo "  cp .env.template .env"
    echo "  nano .env"
    exit 1
fi

# Parse DATABASE_URL from .env
DB_URL=$(grep "^DATABASE_URL=" .env | cut -d'"' -f2)
if [ -z "$DB_URL" ]; then
    DB_URL=$(grep "^DATABASE_URL=" .env | cut -d'=' -f2)
fi

echo "Database URL from .env: $DB_URL"

# Extract credentials using regex
if [[ $DB_URL =~ postgresql://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+)\? ]]; then
    DB_USER="${BASH_REMATCH[1]}"
    DB_PASS="${BASH_REMATCH[2]}"
    DB_HOST="${BASH_REMATCH[3]}"
    DB_PORT="${BASH_REMATCH[4]}"
    DB_NAME="${BASH_REMATCH[5]}"
    
    echo "Parsed credentials:"
    echo "  User: $DB_USER"
    echo "  Password: $DB_PASS"
    echo "  Host: $DB_HOST"
    echo "  Port: $DB_PORT"
    echo "  Database: $DB_NAME"
else
    print_error "Could not parse DATABASE_URL"
    echo "Expected format: postgresql://user:password@host:port/database?schema=public"
    exit 1
fi

# Step 6: Check docker-compose.yml credentials
print_step "Checking docker-compose.yml credentials..."
if [ -f "docker-compose.yml" ]; then
    COMPOSE_USER=$(grep "POSTGRES_USER:" docker-compose.yml | awk '{print $2}' | tr -d '"')
    COMPOSE_PASS=$(grep "POSTGRES_PASSWORD:" docker-compose.yml | awk '{print $2}' | tr -d '"')
    COMPOSE_DB=$(grep "POSTGRES_DB:" docker-compose.yml | awk '{print $2}' | tr -d '"')
    
    echo "docker-compose.yml credentials:"
    echo "  User: $COMPOSE_USER"
    echo "  Password: $COMPOSE_PASS"
    echo "  Database: $COMPOSE_DB"
    
    # Compare credentials
    if [ "$DB_USER" != "$COMPOSE_USER" ] || [ "$DB_PASS" != "$COMPOSE_PASS" ] || [ "$DB_NAME" != "$COMPOSE_DB" ]; then
        print_error "Credential mismatch!"
        echo ""
        echo "Your .env file has different credentials than docker-compose.yml"
        echo ""
        echo "Option 1: Update .env to match docker-compose.yml"
        echo "  DATABASE_URL=\"postgresql://$COMPOSE_USER:$COMPOSE_PASS@localhost:5432/$COMPOSE_DB?schema=public\""
        echo ""
        echo "Option 2: Restart PostgreSQL with new credentials"
        echo "  docker-compose down"
        echo "  docker-compose up -d db"
        echo ""
        read -p "Do you want to update .env automatically? (y/N): " UPDATE_ENV
        
        if [ "$UPDATE_ENV" = "y" ] || [ "$UPDATE_ENV" = "Y" ]; then
            # Backup .env
            cp .env .env.backup
            
            # Update DATABASE_URL in .env
            NEW_URL="postgresql://$COMPOSE_USER:$COMPOSE_PASS@localhost:5432/$COMPOSE_DB?schema=public"
            sed -i "s|DATABASE_URL=.*|DATABASE_URL=\"$NEW_URL\"|g" .env
            
            echo "✓ Updated .env file (backup saved as .env.backup)"
            echo "New DATABASE_URL: $NEW_URL"
            
            # Update variables for testing
            DB_USER="$COMPOSE_USER"
            DB_PASS="$COMPOSE_PASS"
            DB_NAME="$COMPOSE_DB"
        else
            echo "Please fix the credentials manually and run this script again"
            exit 1
        fi
    else
        echo "✓ Credentials match!"
    fi
fi

# Step 7: Test database connection
print_step "Testing database connection..."

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
    if docker exec "$CONTAINER_NAME" pg_isready -U "$DB_USER" &> /dev/null; then
        echo "✓ PostgreSQL is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        print_error "PostgreSQL did not become ready in time"
        echo "Checking logs..."
        docker logs "$CONTAINER_NAME" --tail 20
        exit 1
    fi
    echo "Waiting... ($i/30)"
    sleep 1
done

# Test connection with psql
echo "Testing connection with psql..."
if docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" &> /dev/null; then
    echo "✓ Successfully connected to database!"
else
    print_error "Failed to connect to database"
    echo "Attempting to create database..."
    
    # Try to create the database if it doesn't exist
    docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || echo "Database may already exist"
    
    # Test again
    if docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" &> /dev/null; then
        echo "✓ Successfully connected after creating database!"
    else
        print_error "Still cannot connect. Checking detailed error..."
        docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;"
        exit 1
    fi
fi

# Step 8: Test from host
print_step "Testing connection from host using Prisma..."
echo "Running: npx prisma db pull --schema=./prisma/schema.prisma"

if npx prisma db pull --schema=./prisma/schema.prisma --force &> /dev/null; then
    echo "✓ Prisma can connect to the database!"
else
    print_error "Prisma cannot connect. Detailed error:"
    npx prisma db pull --schema=./prisma/schema.prisma --force
    exit 1
fi

echo ""
echo "================================"
echo "✅ All checks passed!"
echo "================================"
echo ""
echo "You can now run migrations:"
echo "  npx prisma migrate deploy"
echo ""
echo "Or apply migrations for development:"
echo "  npx prisma migrate dev"
echo ""

# Show current database status
print_step "Current database status:"
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public';" 2>/dev/null || echo "No tables yet (this is normal for first deployment)"
