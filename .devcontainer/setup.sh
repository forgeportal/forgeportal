#!/usr/bin/env bash
# ForgePortal — Dev Container one-time setup
# Runs automatically via postCreateCommand in devcontainer.json
set -euo pipefail

echo ""
echo "⚡ ForgePortal — Dev Container Setup"
echo "─────────────────────────────────────"

# ── 1. Copy .env ──────────────────────────────────────────────────────────────
if [ ! -f .env ]; then
  echo "📋 Creating .env from .env.example"
  cp .env.example .env
  # Patch DB vars to match the devcontainer PostgreSQL feature defaults
  sed -i 's/^DB_HOST=.*/DB_HOST=localhost/'     .env
  sed -i 's/^DB_PORT=.*/DB_PORT=5432/'          .env
  sed -i 's/^DB_USER=.*/DB_USER=postgres/'      .env
  sed -i 's/^DB_PASSWORD=.*/DB_PASSWORD=postgres/' .env
  sed -i 's/^DB_NAME=.*/DB_NAME=forgeportal_dev/' .env
  echo "   ✅ .env ready — edit it to add your SCM token and OIDC config"
else
  echo "   ⏭  .env already exists — skipping"
fi

# ── 2. Wait for PostgreSQL ─────────────────────────────────────────────────────
echo ""
echo "⏳ Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
  pg_isready -h localhost -U postgres -q && break
  sleep 1
done
pg_isready -h localhost -U postgres -q || { echo "❌ PostgreSQL did not start in time"; exit 1; }
echo "   ✅ PostgreSQL ready"

# ── 3. Create database ─────────────────────────────────────────────────────────
DB_EXISTS=$(psql -h localhost -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='forgeportal_dev'" 2>/dev/null || echo "0")
if [ "$DB_EXISTS" != "1" ]; then
  psql -h localhost -U postgres -c "CREATE DATABASE forgeportal_dev;" -q
  echo "   ✅ Database forgeportal_dev created"
else
  echo "   ⏭  Database forgeportal_dev already exists — skipping"
fi

# ── 4. Run migrations in order ────────────────────────────────────────────────
echo ""
echo "🔄 Running migrations..."
MIGRATION_DIR="tools/migration"
if [ -d "$MIGRATION_DIR" ]; then
  for f in $(ls "$MIGRATION_DIR"/*.sql | sort); do
    echo "   → $(basename "$f")"
    psql -h localhost -U postgres -d forgeportal_dev -f "$f" -q 2>&1 | grep -v "^$" || true
  done
  echo "   ✅ All migrations applied"
else
  echo "   ⚠️  No migration directory found at $MIGRATION_DIR"
fi

# ── 5. Seed demo data ─────────────────────────────────────────────────────────
SEED_FILE="tools/seed/seed_v1.sql"
if [ -f "$SEED_FILE" ]; then
  # Only seed if entities table is empty
  ENTITY_COUNT=$(psql -h localhost -U postgres -d forgeportal_dev -tAc "SELECT COUNT(*) FROM entities" 2>/dev/null || echo "0")
  if [ "$ENTITY_COUNT" = "0" ]; then
    echo ""
    echo "🌱 Seeding demo data..."
    psql -h localhost -U postgres -d forgeportal_dev -f "$SEED_FILE" -q
    echo "   ✅ Demo data loaded"
  else
    echo ""
    echo "   ⏭  Database already has data ($ENTITY_COUNT entities) — skipping seed"
  fi
fi

# ── Done ───────────────────────────────────────────────────────────────────────
echo ""
echo "─────────────────────────────────────────────────────"
echo "✅ ForgePortal dev environment is ready!"
echo ""
echo "   Start everything:  pnpm dev"
echo ""
echo "   UI  →  http://localhost:3000"
echo "   API →  http://localhost:4000"
echo ""
echo "   Tip: edit .env to add your SCM token (GitHub/GitLab)"
echo "        and OIDC config. Dev mode works without OIDC."
echo "─────────────────────────────────────────────────────"
echo ""
