#!/usr/bin/env sh

# Verifies generated types match the OpenAPI YAMLs.
#
# Regenerates types/generated/*.d.ts and fails if the working tree shows
# a diff. Used by pre-commit (when YAML changes) and CI.

set -eu

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)

"$ROOT_DIR/scripts/gen-types.sh"

if ! git diff --exit-code -- types/generated > /dev/null 2>&1; then
  echo ""
  echo "ERROR: Generated types drifted from openapi/*.yaml."
  echo "Run 'pnpm run types:gen' and commit the result."
  echo ""
  git --no-pager diff -- types/generated | head -80
  exit 1
fi

echo "SUCCESS: types/generated/*.d.ts in sync with openapi/*.yaml"
