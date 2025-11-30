#!/bin/bash

# Script to check if a package is in the compromised packages list
# Usage: ./scripts/check-package-security.sh <package-name>

PACKAGE_NAME=$1
COMPROMISED_LIST_URL="https://raw.githubusercontent.com/DataDog/indicators-of-compromise/main/shai-hulud-2.0/consolidated_iocs.csv"
TEMP_FILE="/tmp/compromised_packages_check.csv"

if [ -z "$PACKAGE_NAME" ]; then
  echo "Usage: $0 <package-name>"
  echo "Example: $0 express"
  exit 1
fi

echo "Checking package: $PACKAGE_NAME"
echo "Downloading latest compromised packages list..."

# Download the latest list
curl -s "$COMPROMISED_LIST_URL" -o "$TEMP_FILE"

if [ ! -f "$TEMP_FILE" ]; then
  echo "Error: Failed to download compromised packages list"
  exit 1
fi

# Check if package is in the list
if grep -q "^$PACKAGE_NAME," "$TEMP_FILE"; then
  echo "WARNING: Package '$PACKAGE_NAME' is COMPROMISED!"
  echo "Details:"
  grep "^$PACKAGE_NAME," "$TEMP_FILE"
  echo ""
  echo "DO NOT INSTALL this package!"
  exit 1
else
  echo "SUCCESS: Package '$PACKAGE_NAME' is NOT in the compromised list"
  echo "Note: This doesn't guarantee the package is safe. Always:"
  echo "  - Review the package on npm"
  echo "  - Check the GitHub repository"
  echo "  - Run 'npm audit' after installation"
  exit 0
fi
