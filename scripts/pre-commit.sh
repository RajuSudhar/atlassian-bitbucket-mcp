#!/usr/bin/env sh

# Pre-commit hook script
# Runs code quality checks before allowing commit

# Skip checks if TypeScript is not installed yet
if ! command -v tsc > /dev/null 2>&1; then
  echo "Skipping pre-commit checks (TypeScript not installed yet)"
  exit 0
fi

echo "Running pre-commit checks..."

# 0. Regenerate types if any openapi/*.yaml changed; stage them; verify no drift
if git diff --cached --name-only | grep -qE "^openapi/.*\.ya?ml$"; then
  echo "[0/7] Regenerating types from openapi/*.yaml..."
  ./scripts/gen-types.sh
  if [ $? -ne 0 ]; then
    echo "ERROR: Type generation failed!"
    exit 1
  fi
  git add types/generated 2> /dev/null || true

  echo "[0/7] Verifying types/generated has no remaining drift..."
  ./scripts/check-types-drift.sh
  if [ $? -ne 0 ]; then
    echo "ERROR: openapi -> types drift detected after regeneration!"
    exit 1
  fi
fi

# 1. Validate branch name
echo "[1/7] Validating branch name..."
./scripts/validate-branch-name.sh
if [ $? -ne 0 ]; then
  echo "ERROR: Branch name validation failed!"
  exit 1
fi

# 2. Format code with Prettier
echo "[2/7] Formatting code..."
pnpm run format
if [ $? -ne 0 ]; then
  echo "ERROR: Formatting failed!"
  exit 1
fi

# 3. Lint markdown
echo "[3/7] Linting markdown..."
pnpm run lint:md:fix
if [ $? -ne 0 ]; then
  echo "ERROR: Markdown linting failed!"
  exit 1
fi

# 4. Lint and fix issues
echo "[4/7] Linting code..."
pnpm run lint
if [ $? -ne 0 ]; then
  echo "ERROR: Linting failed!"
  exit 1
fi

# 5. Type check
echo "[5/7] Type checking..."
pnpm run typecheck
if [ $? -ne 0 ]; then
  echo "ERROR: Type check failed!"
  exit 1
fi

# 6. Build check
echo "[6/7] Building..."
pnpm run build
if [ $? -ne 0 ]; then
  echo "ERROR: Build failed!"
  exit 1
fi

echo "SUCCESS: All pre-commit checks passed!"
exit 0
