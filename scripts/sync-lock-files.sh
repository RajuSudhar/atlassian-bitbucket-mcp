#!/usr/bin/env sh

# Sync Lock Files Script
# Ensures both package-lock.json (npm) and pnpm-lock.yaml (pnpm) are in sync
# This allows developers to use either npm or pnpm while maintaining compatibility

set -e

echo "Synchronizing lock files..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "WARNING: node_modules not found. Installing dependencies first..."
  pnpm install
fi

# Function to check if a command exists
command_exists() {
  command -v "$1" > /dev/null 2>&1
}

# Check for required commands
if ! command_exists pnpm; then
  echo "ERROR: pnpm is not installed"
  echo "Install with: npm install -g pnpm"
  exit 1
fi

if ! command_exists npm; then
  echo "ERROR: npm is not installed"
  echo "npm should be installed with Node.js"
  exit 1
fi

# Detect which lock file was modified most recently
pnpm_modified=0
npm_modified=0

if [ -f "pnpm-lock.yaml" ]; then
  pnpm_modified=$(stat -f %m "pnpm-lock.yaml" 2> /dev/null || stat -c %Y "pnpm-lock.yaml" 2> /dev/null || echo 0)
fi

if [ -f "package-lock.json" ]; then
  npm_modified=$(stat -f %m "package-lock.json" 2> /dev/null || stat -c %Y "package-lock.json" 2> /dev/null || echo 0)
fi

# Determine source of truth
if [ "$pnpm_modified" -gt "$npm_modified" ]; then
  echo "INFO: pnpm-lock.yaml is newer, syncing to package-lock.json..."

  # Remove old package-lock.json and node_modules to ensure clean sync
  rm -f package-lock.json

  # Generate package-lock.json from pnpm-lock.yaml
  echo "INFO: Generating package-lock.json from pnpm dependencies..."
  npm install --package-lock-only --ignore-scripts --legacy-peer-deps

  if [ $? -ne 0 ]; then
    echo "WARNING: npm install failed, trying with --force..."
    npm install --package-lock-only --ignore-scripts --force
  fi

  if [ $? -eq 0 ]; then
    echo "SUCCESS: package-lock.json updated from pnpm-lock.yaml"
  else
    echo "ERROR: Failed to generate package-lock.json"
    exit 1
  fi

elif [ "$npm_modified" -gt "$pnpm_modified" ]; then
  echo "INFO: package-lock.json is newer, syncing to pnpm-lock.yaml..."

  # Remove old pnpm-lock.yaml to ensure clean sync
  rm -f pnpm-lock.yaml

  # Generate pnpm-lock.yaml from package-lock.json
  echo "INFO: Generating pnpm-lock.yaml from npm dependencies..."
  pnpm install --lockfile-only --ignore-scripts

  if [ $? -eq 0 ]; then
    echo "SUCCESS: pnpm-lock.yaml updated from package-lock.json"
  else
    echo "ERROR: Failed to generate pnpm-lock.yaml"
    exit 1
  fi

else
  echo "INFO: Both lock files are in sync or don't exist yet"

  # If neither exists, generate both
  if [ ! -f "pnpm-lock.yaml" ] && [ ! -f "package-lock.json" ]; then
    echo "INFO: Generating both lock files..."
    pnpm install --lockfile-only --ignore-scripts
    npm install --package-lock-only --ignore-scripts
    echo "SUCCESS: Both lock files generated"
  fi
fi

# Verify both files exist
if [ ! -f "pnpm-lock.yaml" ]; then
  echo "ERROR: pnpm-lock.yaml not found after sync"
  exit 1
fi

if [ ! -f "package-lock.json" ]; then
  echo "ERROR: package-lock.json not found after sync"
  exit 1
fi

echo ""
echo "SUCCESS: Lock files synchronized"
echo "  - pnpm-lock.yaml: present"
echo "  - package-lock.json: present"
echo ""
echo "Both npm and pnpm users can now install dependencies with their preferred package manager."
