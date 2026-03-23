#!/usr/bin/env bash
# ============================================================================
# prisma bootstrap — Manual QA Test Script
# ============================================================================
#
# Prerequisites:
#   - Run from the prisma/prisma repo root
#   - Set BOOTSTRAP_QA_API_KEY and BOOTSTRAP_QA_DB_ID env vars
#   - tsx must be available (pnpm install)
#
# Usage:
#   BOOTSTRAP_QA_API_KEY="eyJ..." BOOTSTRAP_QA_DB_ID="db_cmmx..." \
#     bash packages/cli/src/bootstrap/__tests__/manual-qa.sh
#
# ============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../../../.." && pwd)"
CLI_BIN="$REPO_ROOT/packages/cli/src/bin.ts"
QA_ROOT="/tmp/bootstrap-qa-$(date +%s)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

pass_count=0
fail_count=0
skip_count=0

# ---------- helpers ----------

run_prisma() {
  npx tsx "$CLI_BIN" "$@"
}

header() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo -e "  ${BOLD}TEST: $1${NC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

pass() {
  echo -e "  ${GREEN}✔ PASS${NC}: $1"
  pass_count=$((pass_count + 1))
}

fail() {
  echo -e "  ${RED}✗ FAIL${NC}: $1"
  fail_count=$((fail_count + 1))
}

skip() {
  echo -e "  ${YELLOW}– SKIP${NC}: $1"
  skip_count=$((skip_count + 1))
}

check_contains() {
  local output="$1"
  local expected="$2"
  local label="$3"
  if echo "$output" | grep -qi -- "$expected"; then
    pass "$label"
  else
    fail "$label (expected '$expected' in output)"
    echo "    Actual output (last 10 lines):"
    echo "$output" | tail -10 | sed 's/^/      /'
  fi
}

check_file_exists() {
  local filepath="$1"
  local label="$2"
  if [ -f "$filepath" ]; then
    pass "$label"
  else
    fail "$label (file not found: $filepath)"
  fi
}

check_file_contains() {
  local filepath="$1"
  local expected="$2"
  local label="$3"
  if [ -f "$filepath" ] && grep -q "$expected" "$filepath"; then
    pass "$label"
  else
    fail "$label (expected '$expected' in $filepath)"
  fi
}

# ---------- preflight ----------

if [ -z "${BOOTSTRAP_QA_API_KEY:-}" ]; then
  echo -e "${RED}Error: BOOTSTRAP_QA_API_KEY is not set${NC}"
  echo "Generate one with:"
  echo "  cd /path/to/pdp-control-plane"
  echo '  pnpm --filter @pdp/auth doppler:production -- tsx ./scripts/token.ts -- --workspace-id cmhki6m13022a3qfm0w74ezop'
  exit 1
fi

if [ -z "${BOOTSTRAP_QA_DB_ID:-}" ]; then
  echo -e "${RED}Error: BOOTSTRAP_QA_DB_ID is not set${NC}"
  echo "Use a database ID from the QA workspace, e.g.:"
  echo "  export BOOTSTRAP_QA_DB_ID=db_cmmx8hich0z3izyfssp1zr26c"
  exit 1
fi

API_KEY="$BOOTSTRAP_QA_API_KEY"
DB_ID="$BOOTSTRAP_QA_DB_ID"

mkdir -p "$QA_ROOT"
echo -e "${BOLD}QA workspace: $QA_ROOT${NC}"
echo ""


# ============================================================================
# TEST 1: From scratch (empty directory)
#
# Exercises: init → link → completion (no models, no migrate, no seed)
# Validates: Project scaffolding, .env creation, correct next steps
# ============================================================================

header "1 — From scratch: empty directory"
TEST_DIR="$QA_ROOT/t1-empty"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

output=$(run_prisma bootstrap --api-key "$API_KEY" --database "$DB_ID" 2>&1) || true
echo "$output"

check_contains "$output" "Bootstrap completed" "Command reports success"
check_file_exists "$TEST_DIR/prisma/schema.prisma" "Schema file created by init"
check_file_exists "$TEST_DIR/prisma.config.ts" "Config file created by init"
check_file_exists "$TEST_DIR/.env" ".env created with connection string"
check_file_contains "$TEST_DIR/.env" "db.prisma.io" ".env contains Prisma Postgres URL"
check_contains "$output" "Init" "Summary includes init step"
check_contains "$output" "Define your data model" "Next steps suggest defining models (no models yet)"


# ============================================================================
# TEST 2: Existing project with models
#
# Exercises: skip init → link → migrate prompt (decline) → completion
# Validates: Init skip, model detection, migrate consent gate
# ============================================================================

header "2 — Existing project with models (decline migrate)"
TEST_DIR="$QA_ROOT/t2-with-models"
mkdir -p "$TEST_DIR/prisma"
cd "$TEST_DIR"

cat > "$TEST_DIR/package.json" << 'PKGJSON'
{
  "name": "bootstrap-qa-models",
  "version": "1.0.0"
}
PKGJSON

cat > "$TEST_DIR/prisma/schema.prisma" << 'SCHEMA'
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  published Boolean  @default(false)
  createdAt DateTime @default(now())
}
SCHEMA

# Pipe "n" to decline the migrate prompt
output=$(echo "n" | run_prisma bootstrap --api-key "$API_KEY" --database "$DB_ID" 2>&1) || true
echo "$output"

check_contains "$output" "Bootstrap completed" "Command reports success"
check_file_exists "$TEST_DIR/.env" ".env created with connection string"
check_file_contains "$TEST_DIR/.env" "db.prisma.io" ".env contains Prisma Postgres URL"
check_contains "$output" "skipped" "Summary shows migration was skipped"
check_contains "$output" "prisma generate" "Next steps suggest prisma generate (has models)"

# Verify init was not run (original schema should be untouched)
if grep -q "model Post" "$TEST_DIR/prisma/schema.prisma"; then
  pass "Original schema preserved (init was skipped)"
else
  fail "Schema was modified — init should have been skipped"
fi


# ============================================================================
# TEST 3: Already linked project (idempotency + --force)
#
# Exercises: Link idempotency guard, --force override
# Validates: Error message for already-linked, --force re-links successfully
# ============================================================================

header "3 — Already linked: idempotency + --force"
TEST_DIR="$QA_ROOT/t3-already-linked"
mkdir -p "$TEST_DIR/prisma"
cd "$TEST_DIR"

# Pre-create .env with a Prisma Postgres URL to simulate already linked
cat > "$TEST_DIR/.env" << 'ENV'
DATABASE_URL='postgres://user:pass@db.prisma.io:5432/postgres'
ENV

cat > "$TEST_DIR/prisma/schema.prisma" << 'SCHEMA'
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
SCHEMA

# First attempt: should fail because already linked
output=$(run_prisma bootstrap --api-key "$API_KEY" --database "$DB_ID" 2>&1) || true
echo "$output"
check_contains "$output" "already linked" "Rejects re-link without --force"

# Second attempt with --force: should succeed
output=$(run_prisma bootstrap --api-key "$API_KEY" --database "$DB_ID" --force 2>&1) || true
echo "$output"
check_contains "$output" "Bootstrap completed" "--force re-links successfully"
check_file_contains "$TEST_DIR/.env" "db.prisma.io" ".env still has Prisma Postgres URL after re-link"


# ============================================================================
# TEST 4: Bad API key
#
# Exercises: Error handling for invalid credentials
# Validates: Clean error message, no stack trace, no API key leak
# ============================================================================

header "4 — Bad API key: error handling"
TEST_DIR="$QA_ROOT/t4-bad-key"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

output=$(run_prisma bootstrap --api-key "invalid_key_1234" --database "$DB_ID" 2>&1) || true
echo "$output"

check_contains "$output" "Invalid credentials\|authentication\|unauthorized\|failed" "Shows auth error"

# Verify the API key is NOT in the output
if echo "$output" | grep -q "invalid_key_1234"; then
  fail "API key leaked in error output"
else
  pass "API key is not exposed in error output"
fi


# ============================================================================
# TEST 5: Help flag
#
# Exercises: --help output
# Validates: Usage text, examples, flag descriptions
# ============================================================================

header "5 — Help flag"
TEST_DIR="$QA_ROOT/t5-help"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

output=$(run_prisma bootstrap --help 2>&1) || true

check_contains "$output" "prisma bootstrap" "Help mentions command name"
check_contains "$output" "--api-key" "Help documents --api-key flag"
check_contains "$output" "--database" "Help documents --database flag"
check_contains "$output" "--force" "Help documents --force flag"


# ============================================================================
# TEST 6: Link refactor backward compat — prisma postgres link still works
#
# Exercises: Existing `prisma postgres link` command after LinkResult refactor
# Validates: No regression in the link command's CLI output
# ============================================================================

header "6 — Backward compat: prisma postgres link"
TEST_DIR="$QA_ROOT/t6-link-compat"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

output=$(run_prisma postgres link --api-key "$API_KEY" --database "$DB_ID" 2>&1) || true
echo "$output"

check_contains "$output" "linked successfully" "Link command still works after refactor"
check_file_exists "$TEST_DIR/.env" ".env created by link"


# ============================================================================
# SUMMARY
# ============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  ${BOLD}RESULTS${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "  ${GREEN}Passed${NC}: $pass_count"
echo -e "  ${RED}Failed${NC}: $fail_count"
echo -e "  ${YELLOW}Skipped${NC}: $skip_count"
echo ""
echo "  QA artifacts: $QA_ROOT"
echo ""

if [ "$fail_count" -gt 0 ]; then
  echo -e "  ${RED}${BOLD}SOME TESTS FAILED${NC}"
  exit 1
else
  echo -e "  ${GREEN}${BOLD}ALL TESTS PASSED${NC}"
fi
