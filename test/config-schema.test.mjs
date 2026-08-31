import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';

import { serverConfigSchema } from '../dist/src/config.js';
import { buildSchemaDocument } from '../scripts/generate-config-schema.mjs';

describe('Unit: config schema', () => {
  it('example config parses against serverConfigSchema', () => {
    const examplePath = new URL('../bitbucket-mcp.config.example.json', import.meta.url);
    const exampleContent = fs.readFileSync(examplePath, 'utf8');
    const exampleConfig = JSON.parse(exampleContent);

    const parsed = serverConfigSchema.parse(exampleConfig);

    assert.equal(
      parsed.defaults.maxOutputTokens,
      25000,
      'defaults.maxOutputTokens should be 25000'
    );
    assert.equal(
      parsed.tools.bitbucket_list_pull_requests.maxOutputTokens,
      10000,
      'bitbucket_list_pull_requests maxOutputTokens should be 10000'
    );
    assert.equal(
      parsed.tools.bitbucket_search_code.maxOutputTokens,
      10000,
      'bitbucket_search_code maxOutputTokens should be 10000'
    );
  });

  it('schema-file matches generator output (drift detection)', () => {
    const schemaPath = new URL('../bitbucket-mcp.config.schema.json', import.meta.url);
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    const committedSchema = JSON.parse(schemaContent);

    const generatedSchema = buildSchemaDocument();

    assert.deepEqual(
      committedSchema,
      generatedSchema,
      'committed schema must match generated output — run `pnpm run schema:gen` and commit the result'
    );
  });

  it('schema has required top-level fields', () => {
    const schemaPath = new URL('../bitbucket-mcp.config.schema.json', import.meta.url);
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    const schema = JSON.parse(schemaContent);

    assert.ok(schema.$schema, 'should have $schema field');
    assert.ok(
      schema.$schema.startsWith('http://json-schema.org/draft-07'),
      '$schema should start with draft-07'
    );
    assert.ok(schema.title, 'should have title field');
    assert.ok(schema.description, 'should have description field');
  });
});
