#!/bin/bash
# Fix PostgreSQL User Mismatch
# This script creates the correct user and updates your .env file

set -e

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║          PostgreSQL User Fix - Role Does Not Exist              ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    print_error "docker-compose.yml not found. Please run from project root."
    exit 1
fi

# Get container ID
CONTAINER_ID=$(docker ps -q --filter "name=db")

if [ -z "$CONTAINER_ID" ]; then
    print_error "PostgreSQL container not running!"
    echo ""
    echo "Starting PostgreSQL..."
    docker-compose up -d db
    sleep 5
    CONTAINER_ID=$(docker ps -q --filter "name=db")
    
    if [ -z "$CONTAINER_ID" ]; then
        print_error "Failed to start PostgreSQL container"
        exit 1
    fi
    print_status "PostgreSQL container started"
fi

print_status "PostgreSQL container found: $CONTAINER_ID"
echo ""

# Extract credentials from docker-compose.yml
print_info "Reading docker-compose.yml configuration..."
COMPOSE_USER=$(grep "POSTGRES_USER:" docker-compose.yml | awk '{print $2}' | tr -d '"' | tr -d "'")
COMPOSE_PASS=$(grep "POSTGRES_PASSWORD:" docker-compose.yml | awk '{print $2}' | tr -d '"' | tr -d "'")
COMPOSE_DB=$(grep "POSTGRES_DB:" docker-compose.yml | awk '{print $2}' | tr -d '"' | tr -d "'")

echo "  Docker Compose User: $COMPOSE_USER"
echo "  Docker Compose Password: ${COMPOSE_PASS:0:3}***"
echo "  Docker Compose Database: $COMPOSE_DB"
echo ""

# Check what user .env is trying to use
if [ -f ".env" ]; then
    print_info "Checking .env file..."
    if grep -q "^DATABASE_URL=" .env; then
        CURRENT_URL=$(grep "^DATABASE_URL=" .env | cut -d= -f2- | tr -d '"' | tr -d "'")
        CURRENT_USER=$(echo "$CURRENT_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
        echo "  Current .env user: $CURRENT_USER"
        echo ""
        
        if [ "$CURRENT_USER" != "$COMPOSE_USER" ]; then
            print_warning "User mismatch detected!"
            echo "  .env wants: $CURRENT_USER"
            echo "  docker-compose.yml has: $COMPOSE_USER"
            echo ""
        fi
    fi
fi

# Show solution options
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "                         SOLUTION OPTIONS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Option 1: Update .env to use '$COMPOSE_USER' (RECOMMENDED - FASTEST)"
echo "Option 2: Create 'volunteer' user in PostgreSQL"
echo "Option 3: Recreate PostgreSQL with 'volunteer' user"
echo ""
read -p "Choose option (1/2/3) [1]: " OPTION
OPTION=${OPTION:-1}

echo ""

if [ "$OPTION" = "1" ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "                    OPTION 1: Update .env File"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # Backup .env
    if [ -f ".env" ]; then
        cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
        print_status "Backed up .env"
    fi
    
    # Build new DATABASE_URL
    NEW_DATABASE_URL="postgresql://${COMPOSE_USER}:${COMPOSE_PASS}@localhost:5432/${COMPOSE_DB}?schema=public"
    
    # Update or create .env
    if [ -f ".env" ] && grep -q "^DATABASE_URL=" .env; then
        sed -i.bak "s|^DATABASE_URL=.*|DATABASE_URL=\"${NEW_DATABASE_URL}\"|" .env
        print_status "Updated DATABASE_URL in .env"
    else
        echo "DATABASE_URL=\"${NEW_DATABASE_URL}\"" >> .env
        print_status "Added DATABASE_URL to .env"
    fi
    
    echo ""
    echo "New DATABASE_URL:"
    echo "  $NEW_DATABASE_URL"
    echo ""
    
    # Test connection
    print_info "Testing connection with new credentials..."
    if docker exec "$CONTAINER_ID" psql -U "$COMPOSE_USER" -d "$COMPOSE_DB" -c "SELECT 1;" > /dev/null 2>&1; then
        print_status "Connection successful!"
    else
        # Database might not exist yet
        print_warning "Database '$COMPOSE_DB' might not exist yet"
        echo "Creating database..."
        docker exec "$CONTAINER_ID" psql -U "$COMPOSE_USER" -d postgres -c "CREATE DATABASE $COMPOSE_DB;" 2>/dev/null || print_info "Database may already exist"
        print_status "Database ready"
    fi

elif [ "$OPTION" = "2" ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "               OPTION 2: Create 'volunteer' User"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    print_info "Creating 'volunteer' user in PostgreSQL..."
    
    # Create user
    docker exec "$CONTAINER_ID" psql -U "$COMPOSE_USER" -d postgres -c "CREATE USER volunteer WITH PASSWORD 'volunteer_password' CREATEDB SUPERUSER;" 2>/dev/null || print_info "User may already exist"
    
    # Create database
    docker exec "$CONTAINER_ID" psql -U "$COMPOSE_USER" -d postgres -c "CREATE DATABASE volunteer_signup OWNER volunteer;" 2>/dev/null || print_info "Database may already exist"
    
    # Grant privileges
    docker exec "$CONTAINER_ID" psql -U "$COMPOSE_USER" -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE volunteer_signup TO volunteer;" 2>/dev/null
    
    print_status "User 'volunteer' created"
    
    # Update .env if needed
    if [ -f ".env" ]; then
        cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
        print_status "Backed up .env"
        
        NEW_DATABASE_URL="postgresql://volunteer:volunteer_password@localhost:5432/volunteer_signup?schema=public"
        
        if grep -q "^DATABASE_URL=" .env; then
            sed -i.bak "s|^DATABASE_URL=.*|DATABASE_URL=\"${NEW_DATABASE_URL}\"|" .env
            print_status "Updated DATABASE_URL in .env"
        else
            echo "DATABASE_URL=\"${NEW_DATABASE_URL}\"" >> .env
            print_status "Added DATABASE_URL to .env"
        fi
    fi
    
    # Test connection
    print_info "Testing connection..."
    if docker exec "$CONTAINER_ID" psql -U volunteer -d volunteer_signup -c "SELECT 1;" > /dev/null 2>&1; then
        print_status "Connection successful!"
    else
        print_error "Connection failed. Check logs above."
    fi

elif [ "$OPTION" = "3" ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "        OPTION 3: Recreate PostgreSQL with 'volunteer' User"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    print_warning "WARNING: This will delete all existing database data!"
    read -p "Are you sure? (yes/no) [no]: " CONFIRM
    
    if [ "$CONFIRM" = "yes" ]; then
        print_info "Stopping and removing PostgreSQL container..."
        docker-compose down -v
        
        print_info "Updating docker-compose.yml..."
        # Update docker-compose.yml to use volunteer user
        sed -i.bak 's/POSTGRES_USER: postgres/POSTGRES_USER: volunteer/' docker-compose.yml
        sed -i.bak 's/POSTGRES_PASSWORD: postgres/POSTGRES_PASSWORD: volunteer_password/' docker-compose.yml
        sed -i.bak 's/POSTGRES_DB: volunteer_signup/POSTGRES_DB: volunteer_signup/' docker-compose.yml
        
        print_status "docker-compose.yml updated"
        
        print_info "Starting PostgreSQL with new credentials..."
        docker-compose up -d db
        sleep 5
        
        # Update .env
        if [ -f ".env" ]; then
            cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
            NEW_DATABASE_URL="postgresql://volunteer:volunteer_password@localhost:5432/volunteer_signup?schema=public"
            sed -i.bak "s|^DATABASE_URL=.*|DATABASE_URL=\"${NEW_DATABASE_URL}\"|" .env
            print_status "Updated .env"
        fi
        
        print_status "PostgreSQL recreated with 'volunteer' user"
    else
        print_info "Cancelled"
        exit 0
    fi
else
    print_error "Invalid option"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "                          NEXT STEPS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Test Prisma connection:"
echo "   npx prisma db pull --force"
echo ""
echo "2. Deploy database migrations:"
echo "   npx prisma migrate deploy"
echo ""
echo "3. Build application:"
echo "   npm run build"
echo ""
echo "4. Start with PM2:"
echo "   pm2 restart all"
echo ""
print_status "Done!"
