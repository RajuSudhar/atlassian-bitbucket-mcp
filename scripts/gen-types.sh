#!/usr/bin/env sh

# Generate TypeScript types from OpenAPI YAML specs.
#
# Reads:    openapi/bitbucket-cloud.yaml, openapi/bitbucket-server.yaml
# Writes:   types/generated/bitbucket-cloud.d.ts,
#           types/generated/bitbucket-server.d.ts
#
# YAML is the source of truth; generated files are committed for
# deterministic builds. CI runs this script and fails on drift.

set -eu

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
OPENAPI_DIR="$ROOT_DIR/openapi"
OUT_DIR="$ROOT_DIR/types/generated"

mkdir -p "$OUT_DIR"

echo "Generating types from openapi/bitbucket-cloud.yaml..."
pnpm exec openapi-typescript "$OPENAPI_DIR/bitbucket-cloud.yaml" \
  --output "$OUT_DIR/bitbucket-cloud.d.ts" \
  --immutable

echo "Generating types from openapi/bitbucket-server.yaml..."
pnpm exec openapi-typescript "$OPENAPI_DIR/bitbucket-server.yaml" \
  --output "$OUT_DIR/bitbucket-server.d.ts" \
  --immutable

echo "SUCCESS: types/generated/*.d.ts up to date"
