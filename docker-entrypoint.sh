#!/bin/sh
set -e

echo ""
echo "========================================"
echo "  PDF Image Extractor - Starting"
echo "========================================"
echo ""
echo "Environment: ${NODE_ENV:-production}"
echo "Port: ${PORT:-3001}"
echo "Database: ${DATABASE_URL:-file:/data/db/prod.db}"
echo ""

# ===========================================
# Environment Validation (fail fast)
# ===========================================

# Check JWT_SECRET BEFORE starting anything
if [ -z "$JWT_SECRET" ]; then
    echo "========================================================================"
    echo "❌ FATAL: JWT_SECRET environment variable is not set"
    echo "========================================================================"
    echo ""
    echo "JWT_SECRET is REQUIRED for production deployments."
    echo "It must be at least 32 characters long."
    echo ""
    echo "📋 HOW TO FIX:"
    echo ""
    if [ -n "$RAILWAY_STATIC_URL" ] || [ -n "$RAILWAY_PUBLIC_DOMAIN" ]; then
        echo "   Railway:"
        echo "   1. Go to your Railway project dashboard"
        echo "   2. Click on your service → Variables tab"
        echo "   3. Add: JWT_SECRET = <your-secret-here>"
        echo ""
    elif [ -n "$RENDER" ]; then
        echo "   Render:"
        echo "   1. Go to your Render dashboard"
        echo "   2. Click on your service → Environment tab"
        echo "   3. Add: JWT_SECRET = <your-secret-here>"
        echo ""
    else
        echo "   Set the JWT_SECRET environment variable in your deployment platform."
        echo ""
    fi
    echo "🔑 Generate a secure secret with:"
    echo "   node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""
    echo ""
    echo "========================================================================"
    echo ""
    exit 1
fi

# Check JWT_SECRET length
if [ ${#JWT_SECRET} -lt 32 ]; then
    echo "========================================================================"
    echo "❌ FATAL: JWT_SECRET is too short (minimum 32 characters required)"
    echo "========================================================================"
    echo ""
    echo "Current length: ${#JWT_SECRET} characters"
    echo ""
    echo "🔑 Generate a secure secret with:"
    echo "   node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""
    echo ""
    echo "========================================================================"
    echo ""
    exit 1
fi

echo "✓ JWT_SECRET validated"

# ===========================================
# Directory Setup
# ===========================================

echo "Setting up data directories..."
mkdir -p /data/storage /data/db 2>/dev/null || true
echo "✓ Directories ready"

# ===========================================
# Database Migrations
# ===========================================

echo ""
echo "Running database migrations..."
cd /app/server
npx prisma migrate deploy || {
    echo "Migration failed, attempting db push for SQLite..."
    npx prisma db push --accept-data-loss || {
        echo "⚠️  WARNING: Database initialization failed. Continuing anyway..."
    }
}
echo "✓ Database ready"
cd /app

# ===========================================
# Start Server
# ===========================================

echo ""
echo "========================================"
echo "  Starting server on 0.0.0.0:${PORT:-3001}"
echo "========================================"
echo ""
exec node server/dist/index.js
