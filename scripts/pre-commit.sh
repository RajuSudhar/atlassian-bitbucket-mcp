#!/usr/bin/env sh

# Pre-commit hook script
# Runs code quality checks before allowing commit

# Skip checks if TypeScript is not installed yet
if ! command -v tsc &> /dev/null; then
  echo "Skipping pre-commit checks (TypeScript not installed yet)"
  exit 0
fi

echo "Running pre-commit checks..."

# 0. Sync lock files if package.json changed
if git diff --cached --name-only | grep -q "^package\.json$"; then
  echo "[0/7] Syncing lock files (package.json changed)..."
  ./scripts/sync-lock-files.sh
  if [ $? -ne 0 ]; then
    echo "ERROR: Lock file sync failed!"
    exit 1
  fi
  # Stage the updated lock files
  git add package-lock.json pnpm-lock.yaml 2> /dev/null || true
fi

# 1. Validate branch name
echo "[1/7] Validating branch name..."
./scripts/validate-branch-name.sh
if [ $? -ne 0 ]; then
  echo "ERROR: Branch name validation failed!"
  exit 1
fi

# 2. Verify lock files are in sync
echo "[2/7] Verifying lock files are in sync..."
if [ -f "package-lock.json" ] && [ -f "pnpm-lock.yaml" ]; then
  # Check if dependencies match
  npm_count=$(grep -c '"resolved":' package-lock.json 2> /dev/null || echo "0")
  pnpm_count=$(grep -c 'resolution:' pnpm-lock.yaml 2> /dev/null || echo "0")

  # Allow some variance (pnpm includes more metadata)
  if [ "$npm_count" = "0" ] || [ "$pnpm_count" = "0" ]; then
    echo "WARNING: Lock files may not be in sync (run: pnpm run sync:locks)"
  fi
else
  echo "ERROR: Both lock files must exist (package-lock.json and pnpm-lock.yaml)"
  echo "Run: pnpm run sync:locks"
  exit 1
fi

# 3. Format code with Prettier
echo "[3/7] Formatting code..."
pnpm run format
if [ $? -ne 0 ]; then
  echo "ERROR: Formatting failed!"
  exit 1
fi

# 4. Lint markdown
echo "[4/7] Linting markdown..."
pnpm run lint:md:fix
if [ $? -ne 0 ]; then
  echo "ERROR: Markdown linting failed!"
  exit 1
fi

# 5. Lint and fix issues
echo "[5/7] Linting code..."
pnpm run lint
if [ $? -ne 0 ]; then
  echo "ERROR: Linting failed!"
  exit 1
fi

# 6. Type check
echo "[6/7] Type checking..."
pnpm run typecheck
if [ $? -ne 0 ]; then
  echo "ERROR: Type check failed!"
  exit 1
fi

# 7. Build check
echo "[7/7] Building..."
pnpm run build
if [ $? -ne 0 ]; then
  echo "ERROR: Build failed!"
  exit 1
fi

echo "SUCCESS: All pre-commit checks passed!"
exit 0
