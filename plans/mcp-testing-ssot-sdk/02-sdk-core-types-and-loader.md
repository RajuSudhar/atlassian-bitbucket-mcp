# Phase 1: SDK Core Types & Loader

## Objective

Define the core TypeScript types for the SSOT system (`ToolDefinition`, `TestCase`,
`TestSuite`, etc.) in `src/lib/types.ts`, build a YAML loader that parses and
validates tool definition files against a meta-schema, and establish the SDK
barrel export.

## Scope

### In Scope

- All SDK type definitions in `src/lib/types.ts`
- YAML loader with structural validation in `src/lib/loader.ts`
- SDK barrel export in `src/lib/index.ts`
- Unit tests for the loader
- JSON Schema meta-schema for validating tool definition YAML structure

### Out of Scope

- Actual tool YAML definitions (Phase 2)
- Code generation (Phase 3)
- Test harness or test runner (Phase 4-5)

## Step 1: Define SDK Core Types

Create `src/lib/types.ts`:

```ts
import type { JSONSchema7 } from 'json-schema-to-zod';

export interface ToolAnnotations {
  audience?: string[];
  priority?: number;
  lastModified?: string;
}

export interface CacheConfig {
  ttl: number;
  key: string;
}

export type Permission =
  | 'read_pr'
  | 'write_pr'
  | 'manage_pr'
  | 'search_code'
  | 'read_repo'
  | 'read_project';

export interface ToolDefinition {
  name: string;
  description: string;
  permission: Permission;
  cache?: CacheConfig;
  annotations?: ToolAnnotations;
  input: JSONSchema7;
  output: JSONSchema7;
  handler: string;
}

export interface SharedSchema {
  definitions: Record<string, JSONSchema7>;
}

export interface MockConfig {
  endpoint: string;
  fixture?: string;
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface ExpectConfig {
  schema?: boolean;
  isError?: boolean;
  content_type?: 'text' | 'image' | 'resource';
  properties?: Record<string, PropertyAssertion>;
  error?: {
    code?: string;
    message?: string | RegExp;
  };
}

export type PropertyAssertion =
  | { eq: unknown }
  | { neq: unknown }
  | { gt: number }
  | { gte: number }
  | { lt: number }
  | { lte: number }
  | { contains: string }
  | { matches: string }
  | { length: number }
  | unknown;

export interface FixtureRef {
  name: string;
  file: string;
}

export interface TestCase {
  name: string;
  input: Record<string, unknown>;
  mock?: MockConfig | MockConfig[];
  expect: ExpectConfig;
}

export interface TestSuite {
  tool: string;
  fixtures?: FixtureRef[];
  cases: TestCase[];
}

export interface LoadedTool {
  definition: ToolDefinition;
  filePath: string;
}

export interface LoadResult {
  tools: LoadedTool[];
  schemas: Map<string, SharedSchema>;
  errors: LoadError[];
}

export interface LoadError {
  file: string;
  message: string;
  details?: unknown;
}
```

**CRITICAL**: The `JSONSchema7` type may need to be defined locally if
`json-schema-to-zod` does not export it. In that case, define a compatible
type:

```typescript
export interface JSONSchema7 {
  type?: string | string[];
  properties?: Record<string, JSONSchema7>;
  required?: string[];
  items?: JSONSchema7 | JSONSchema7[];
  enum?: unknown[];
  const?: unknown;
  description?: string;
  default?: unknown;
  $ref?: string;
  definitions?: Record<string, JSONSchema7>;
  allOf?: JSONSchema7[];
  anyOf?: JSONSchema7[];
  oneOf?: JSONSchema7[];
  not?: JSONSchema7;
  if?: JSONSchema7;
  then?: JSONSchema7;
  else?: JSONSchema7;
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  additionalProperties?: boolean | JSONSchema7;
  [key: string]: unknown;
}
```

## Step 2: Define the Tool Definition Meta-Schema

The loader validates every YAML file against this JSON Schema. This ensures
structural correctness before any runtime usage.

Define the meta-schema as a constant in `src/lib/loader.ts`:

```typescript
import Ajv from 'ajv';
import { parse as parseYaml } from 'yaml';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import type {
  ToolDefinition,
  SharedSchema,
  LoadedTool,
  LoadResult,
  LoadError,
  JSONSchema7,
} from './types.js';

const TOOL_DEFINITION_META_SCHEMA: JSONSchema7 = {
  type: 'object',
  required: ['name', 'description', 'permission', 'input', 'output', 'handler'],
  properties: {
    name: {
      type: 'string',
      pattern: '^[a-z][a-z0-9_]*$',
      description: 'Tool name in snake_case',
    },
    description: {
      type: 'string',
      minLength: 10,
    },
    permission: {
      type: 'string',
      enum: ['read_pr', 'write_pr', 'manage_pr', 'search_code', 'read_repo', 'read_project'],
    },
    cache: {
      type: 'object',
      properties: {
        ttl: { type: 'number', minimum: 0 },
        key: { type: 'string' },
      },
      required: ['ttl', 'key'],
    },
    annotations: {
      type: 'object',
      properties: {
        audience: { type: 'array', items: { type: 'string' } },
        priority: { type: 'number' },
        lastModified: { type: 'string' },
      },
    },
    input: {
      type: 'object',
      required: ['type'],
      properties: {
        type: { type: 'string', const: 'object' },
      },
    },
    output: {
      type: 'object',
      required: ['type'],
    },
    handler: {
      type: 'string',
      pattern: '^src/.+\\.ts#[a-zA-Z][a-zA-Z0-9]*$',
      description: 'Handler reference as file#functionName',
    },
  },
  additionalProperties: false,
};

const ajv = new Ajv({ allErrors: true, strict: false });
const validateToolDefinition = ajv.compile(TOOL_DEFINITION_META_SCHEMA);
```

## Step 3: Implement the YAML Loader

Continue in `src/lib/loader.ts`:

```typescript
export function parseToolYaml(content: string, filePath: string): ToolDefinition {
  const parsed = parseYaml(content);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`Invalid YAML in ${filePath}: expected an object`);
  }
  return parsed as ToolDefinition;
}

export function validateToolSchema(tool: unknown, filePath: string): string[] {
  const valid = validateToolDefinition(tool);
  if (valid) {
    return [];
  }
  return (validateToolDefinition.errors ?? []).map(
    (err) => `${filePath}: ${err.instancePath || '/'} ${err.message ?? 'unknown error'}`
  );
}

export function loadToolFile(filePath: string): LoadedTool {
  const content = readFileSync(filePath, 'utf-8');
  const definition = parseToolYaml(content, filePath);

  const errors = validateToolSchema(definition, filePath);
  if (errors.length > 0) {
    throw new Error(`Validation errors in ${filePath}:\n${errors.join('\n')}`);
  }

  return { definition, filePath };
}

export function loadSchemaFile(filePath: string): SharedSchema {
  const content = readFileSync(filePath, 'utf-8');
  const parsed = parseYaml(content);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`Invalid schema YAML in ${filePath}`);
  }
  return parsed as SharedSchema;
}

export function loadToolsFromDirectory(definitionsDir: string, schemasDir?: string): LoadResult {
  const result: LoadResult = {
    tools: [],
    schemas: new Map(),
    errors: [],
  };

  if (!existsSync(definitionsDir)) {
    result.errors.push({
      file: definitionsDir,
      message: `Definitions directory does not exist: ${definitionsDir}`,
    });
    return result;
  }

  const toolFiles = readdirSync(definitionsDir)
    .filter((f) => f.endsWith('.tool.yaml'))
    .sort();

  for (const file of toolFiles) {
    const filePath = join(definitionsDir, file);
    try {
      const loaded = loadToolFile(filePath);
      result.tools.push(loaded);
    } catch (error) {
      result.errors.push({
        file: filePath,
        message: error instanceof Error ? error.message : String(error),
        details: error,
      });
    }
  }

  if (schemasDir && existsSync(schemasDir)) {
    const schemaFiles = readdirSync(schemasDir)
      .filter((f) => f.endsWith('.schema.yaml'))
      .sort();

    for (const file of schemaFiles) {
      const filePath = join(schemasDir, file);
      try {
        const schema = loadSchemaFile(filePath);
        const name = basename(file, '.schema.yaml');
        result.schemas.set(name, schema);
      } catch (error) {
        result.errors.push({
          file: filePath,
          message: error instanceof Error ? error.message : String(error),
          details: error,
        });
      }
    }
  }

  const toolNames = result.tools.map((t) => t.definition.name);
  const duplicates = toolNames.filter((name, index) => toolNames.indexOf(name) !== index);
  if (duplicates.length > 0) {
    result.errors.push({
      file: definitionsDir,
      message: `Duplicate tool names found: ${[...new Set(duplicates)].join(', ')}`,
    });
  }

  return result;
}

export function resolveRefs(
  schema: JSONSchema7,
  sharedSchemas: Map<string, SharedSchema>
): JSONSchema7 {
  const resolved = JSON.parse(JSON.stringify(schema)) as JSONSchema7;
  return resolveRefsRecursive(resolved, sharedSchemas);
}

function resolveRefsRecursive(
  node: JSONSchema7,
  sharedSchemas: Map<string, SharedSchema>
): JSONSchema7 {
  if (typeof node !== 'object' || node === null) {
    return node;
  }

  if (node.$ref) {
    const ref = node.$ref;
    const match = ref.match(/^([^#]+)#\/definitions\/(.+)$/);
    if (match) {
      const [, schemaFile, defName] = match;
      const schemaName = schemaFile.replace('.schema.yaml', '').replace(/.*\//, '');
      const shared = sharedSchemas.get(schemaName);
      if (shared?.definitions[defName]) {
        return resolveRefsRecursive(
          JSON.parse(JSON.stringify(shared.definitions[defName])),
          sharedSchemas
        );
      }
      throw new Error(`Unresolved $ref: ${ref}`);
    }

    const localMatch = ref.match(/^#\/definitions\/(.+)$/);
    if (localMatch) {
      return node;
    }

    throw new Error(`Unsupported $ref format: ${ref}`);
  }

  for (const key of Object.keys(node)) {
    const value = node[key];
    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        (node as Record<string, unknown>)[key] = value.map((item) =>
          typeof item === 'object' && item !== null
            ? resolveRefsRecursive(item as JSONSchema7, sharedSchemas)
            : item
        );
      } else {
        (node as Record<string, unknown>)[key] = resolveRefsRecursive(
          value as JSONSchema7,
          sharedSchemas
        );
      }
    }
  }

  return node;
}
```

## Step 4: Create SDK Barrel Export

Create `src/lib/index.ts`:

```typescript
export type {
  ToolDefinition,
  SharedSchema,
  LoadedTool,
  LoadResult,
  LoadError,
  CacheConfig,
  Permission,
  ToolAnnotations,
  TestCase,
  TestSuite,
  FixtureRef,
  MockConfig,
  ExpectConfig,
  PropertyAssertion,
  JSONSchema7,
} from './types.js';

export {
  parseToolYaml,
  validateToolSchema,
  loadToolFile,
  loadSchemaFile,
  loadToolsFromDirectory,
  resolveRefs,
} from './loader.js';
```

**IMPORTANT**: All exports use `.js` extensions because this is an ESM project.
TypeScript resolves `.js` imports to `.ts` files at compile time.

## Step 5: Unit Tests for the Loader

Create `tests/unit/loader.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import {
  parseToolYaml,
  validateToolSchema,
  loadToolFile,
  loadToolsFromDirectory,
  resolveRefs,
} from '@lib/loader.js';
import type { JSONSchema7 } from '@lib/types.js';

const TEST_DIR = join(import.meta.dirname, '../.test-temp');
const DEFS_DIR = join(TEST_DIR, 'definitions');
const SCHEMAS_DIR = join(TEST_DIR, 'schemas');

const VALID_TOOL_YAML = `
name: test_tool
description: "A test tool for unit testing the loader"
permission: read_pr
cache:
  ttl: 300
  key: "\${workspace}:test"
input:
  type: object
  required:
    - workspace
  properties:
    workspace:
      type: string
      description: "The workspace slug"
output:
  type: object
  properties:
    result:
      type: string
handler: src/handlers/test.ts#handleTest
`;

const INVALID_TOOL_YAML_MISSING_NAME = `
description: "Missing name field"
permission: read_pr
input:
  type: object
output:
  type: object
handler: src/handlers/test.ts#handleTest
`;

const INVALID_TOOL_YAML_BAD_PERMISSION = `
name: bad_permission
description: "Tool with invalid permission value"
permission: admin_all
input:
  type: object
output:
  type: object
handler: src/handlers/test.ts#handleTest
`;

const SHARED_SCHEMA_YAML = `
definitions:
  User:
    type: object
    properties:
      uuid:
        type: string
      display_name:
        type: string
    required:
      - uuid
      - display_name
`;

const TOOL_WITH_REF_YAML = `
name: tool_with_ref
description: "A tool that references a shared schema definition"
permission: read_pr
input:
  type: object
  required:
    - workspace
  properties:
    workspace:
      type: string
output:
  type: object
  properties:
    author:
      $ref: "common.schema.yaml#/definitions/User"
handler: src/handlers/test.ts#handleRef
`;

beforeAll(() => {
  mkdirSync(DEFS_DIR, { recursive: true });
  mkdirSync(SCHEMAS_DIR, { recursive: true });
});

afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('parseToolYaml', () => {
  it('parses valid YAML into a ToolDefinition', () => {
    const result = parseToolYaml(VALID_TOOL_YAML, 'test.yaml');
    expect(result.name).toBe('test_tool');
    expect(result.description).toContain('test tool');
    expect(result.permission).toBe('read_pr');
    expect(result.input.type).toBe('object');
    expect(result.handler).toBe('src/handlers/test.ts#handleTest');
  });

  it('throws on non-object YAML', () => {
    expect(() => parseToolYaml('just a string', 'bad.yaml')).toThrow('expected an object');
  });

  it('throws on empty YAML', () => {
    expect(() => parseToolYaml('', 'empty.yaml')).toThrow();
  });
});

describe('validateToolSchema', () => {
  it('returns no errors for valid tool definition', () => {
    const tool = parseToolYaml(VALID_TOOL_YAML, 'valid.yaml');
    const errors = validateToolSchema(tool, 'valid.yaml');
    expect(errors).toHaveLength(0);
  });

  it('returns errors for missing required fields', () => {
    const tool = parseToolYaml(INVALID_TOOL_YAML_MISSING_NAME, 'missing.yaml');
    const errors = validateToolSchema(tool, 'missing.yaml');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('name'))).toBe(true);
  });

  it('returns errors for invalid permission value', () => {
    const tool = parseToolYaml(INVALID_TOOL_YAML_BAD_PERMISSION, 'bad-perm.yaml');
    const errors = validateToolSchema(tool, 'bad-perm.yaml');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('permission'))).toBe(true);
  });
});

describe('loadToolFile', () => {
  it('loads and validates a tool YAML file', () => {
    const filePath = join(DEFS_DIR, 'test-tool.tool.yaml');
    writeFileSync(filePath, VALID_TOOL_YAML);

    const result = loadToolFile(filePath);
    expect(result.definition.name).toBe('test_tool');
    expect(result.filePath).toBe(filePath);
  });

  it('throws for invalid tool definition', () => {
    const filePath = join(DEFS_DIR, 'invalid-tool.tool.yaml');
    writeFileSync(filePath, INVALID_TOOL_YAML_MISSING_NAME);

    expect(() => loadToolFile(filePath)).toThrow('Validation errors');
  });
});

describe('loadToolsFromDirectory', () => {
  it('loads all .tool.yaml files from a directory', () => {
    const dir = join(TEST_DIR, 'load-dir');
    mkdirSync(dir, { recursive: true });

    writeFileSync(join(dir, 'tool-a.tool.yaml'), VALID_TOOL_YAML);
    writeFileSync(
      join(dir, 'tool-b.tool.yaml'),
      VALID_TOOL_YAML.replace('test_tool', 'another_tool')
    );
    writeFileSync(join(dir, 'not-a-tool.yaml'), 'ignored: true');

    const result = loadToolsFromDirectory(dir);
    expect(result.tools).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  it('reports errors for invalid files without stopping', () => {
    const dir = join(TEST_DIR, 'load-dir-errors');
    mkdirSync(dir, { recursive: true });

    writeFileSync(join(dir, 'good.tool.yaml'), VALID_TOOL_YAML);
    writeFileSync(join(dir, 'bad.tool.yaml'), INVALID_TOOL_YAML_MISSING_NAME);

    const result = loadToolsFromDirectory(dir);
    expect(result.tools).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
  });

  it('detects duplicate tool names', () => {
    const dir = join(TEST_DIR, 'load-dir-dupes');
    mkdirSync(dir, { recursive: true });

    writeFileSync(join(dir, 'tool-1.tool.yaml'), VALID_TOOL_YAML);
    writeFileSync(join(dir, 'tool-2.tool.yaml'), VALID_TOOL_YAML);

    const result = loadToolsFromDirectory(dir);
    expect(result.errors.some((e) => e.message.includes('Duplicate'))).toBe(true);
  });

  it('returns error for non-existent directory', () => {
    const result = loadToolsFromDirectory('/nonexistent/path');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('does not exist');
  });
});

describe('resolveRefs', () => {
  it('resolves $ref to shared schema definitions', () => {
    const schemas = new Map();
    const sharedSchema = parseToolYaml(SHARED_SCHEMA_YAML, 'common.schema.yaml') as any;
    schemas.set('common', sharedSchema);

    const schemaWithRef: JSONSchema7 = {
      type: 'object',
      properties: {
        author: { $ref: 'common.schema.yaml#/definitions/User' },
      },
    };

    const resolved = resolveRefs(schemaWithRef, schemas);
    expect(resolved.properties?.author).toHaveProperty('type', 'object');
    expect((resolved.properties?.author as JSONSchema7).properties).toHaveProperty('uuid');
    expect((resolved.properties?.author as JSONSchema7).properties).toHaveProperty('display_name');
  });

  it('throws for unresolved $ref', () => {
    const schemas = new Map();
    const schemaWithBadRef: JSONSchema7 = {
      type: 'object',
      properties: {
        author: { $ref: 'missing.schema.yaml#/definitions/Nope' },
      },
    };

    expect(() => resolveRefs(schemaWithBadRef, schemas)).toThrow('Unresolved $ref');
  });

  it('does not mutate the original schema', () => {
    const schemas = new Map();
    const sharedSchema = parseToolYaml(SHARED_SCHEMA_YAML, 'common.schema.yaml') as any;
    schemas.set('common', sharedSchema);

    const original: JSONSchema7 = {
      type: 'object',
      properties: {
        author: { $ref: 'common.schema.yaml#/definitions/User' },
      },
    };

    const originalCopy = JSON.parse(JSON.stringify(original));
    resolveRefs(original, schemas);
    expect(original).toEqual(originalCopy);
  });
});
```

## Step 6: Verify

```sh
# Run loader unit tests
npx vitest run tests/unit/loader.test.ts --reporter=verbose

# Type check
npx tsc --noEmit -p tsconfig.test.json
```

All tests should pass. The loader correctly:

1. Parses YAML tool definitions
2. Validates them against the meta-schema
3. Loads all tools from a directory
4. Detects duplicates and reports errors gracefully
5. Resolves `$ref` references to shared schemas

## Files Created

| File                        | Purpose                                 |
| --------------------------- | --------------------------------------- |
| `src/lib/types.ts`          | All SDK type definitions                |
| `src/lib/loader.ts`         | YAML loader with meta-schema validation |
| `src/lib/index.ts`          | SDK barrel export                       |
| `tests/unit/loader.test.ts` | Loader unit tests                       |

## Commit

```text
feat(lib): add SDK core types and YAML tool definition loader

- Define ToolDefinition, TestCase, TestSuite types in src/lib/types.ts
- Implement YAML loader with AJV meta-schema validation
- Support $ref resolution for shared schema fragments
- Add comprehensive unit tests for loader
- Export all public API from src/lib/index.ts
```
