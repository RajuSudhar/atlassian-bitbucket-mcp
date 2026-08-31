#!/usr/bin/env node
// Regenerates bitbucket-mcp.config.schema.json from serverConfigSchema.
// Run after `pnpm run build` (imports the compiled dist output, not TS
// source directly — this repo has no TS runtime for standalone scripts).

import { writeFile } from 'node:fs/promises';

import { z } from 'zod';

import { serverConfigSchema } from '../dist/src/config.js';

export function buildSchemaDocument() {
  const jsonSchema = z.toJSONSchema(serverConfigSchema, { target: 'draft-7' });
  return {
    ...jsonSchema,
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'atlassian-bitbucket-mcp server config',
    description:
      'Validated behavior config for atlassian-bitbucket-mcp: per-tool output-token limits.',
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const target = new URL('../bitbucket-mcp.config.schema.json', import.meta.url);
  await writeFile(target, JSON.stringify(buildSchemaDocument(), null, 2) + '\n');
}
