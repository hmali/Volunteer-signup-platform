#!/bin/bash
# 🚀 RUN THIS ON YOUR EC2 INSTANCE
# Copy this entire script and paste into your EC2 terminal

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║     Volunteer Sign-Up Platform - Database Connection Fix        ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# Navigate to project
cd ~/volunteer-signup-platform || { echo "❌ Project directory not found!"; exit 1; }

echo "📍 Current location: $(pwd)"
echo ""
echo "🔍 Running database connection diagnostic..."
echo ""

# Make script executable
chmod +x scripts/fix-postgres.sh

# Run the fix script
./scripts/fix-postgres.sh

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📖 If you need more help, read these guides:"
echo ""
echo "   Quick Reference:    cat FIX_DB_AUTH.md | less"
echo "   Copy/Paste Guide:   cat COPY_PASTE_DB_FIX.md | less"
echo "   Complete Manual:    cat TROUBLESHOOT_DB.md | less"
echo "   Deployment Card:    cat DEPLOYMENT_CARD.md | less"
echo ""
echo "   (Press 'q' to exit the viewer)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
