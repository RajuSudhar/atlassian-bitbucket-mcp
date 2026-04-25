# Phase 4: Test Infrastructure

## Objective

Build the in-memory MCP test harness, the Bitbucket API mock layer using MSW,
and the schema validation engine — the three pillars required for the
declarative test runner in Phase 5.

## Scope

### In Scope

- In-memory MCP test harness in `src/lib/test-harness.ts`
- Schema validation engine in `src/lib/schema-validator.ts`
- MSW-based API mock helper in `tests/helpers/api-mock.ts`
- Mock server helper in `tests/helpers/mock-server.ts`
- Unit tests for the schema validator
- Vitest setup file for MSW lifecycle

### Out of Scope

- YAML test case parsing (Phase 5)
- Declarative test runner (Phase 5)
- Actual test cases for specific tools (Phase 5-6)

## Step 1: Build the In-Memory MCP Test Harness

The test harness creates a real MCP Server instance, registers tools from YAML definitions, and provides methods to call tools directly without transport overhead.

Create `src/lib/test-harness.ts`:

```ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { jsonSchemaToZod } from 'json-schema-to-zod';
import { loadToolsFromDirectory, resolveRefs } from './loader.js';
import type { ToolDefinition, Permission, JSONSchema7, SharedSchema } from './types.js';

export interface TestHarnessOptions {
  definitionsDir: string;
  schemasDir?: string;
  allowedActions?: Permission[];
  handlers?: Record<string, (args: Record<string, unknown>) => Promise<CallToolResult>>;
}

export interface ToolCallOptions {
  validateInput?: boolean;
  validateOutput?: boolean;
}

export class TestHarness {
  private server: Server;
  private toolDefinitions: Map<string, ToolDefinition> = new Map();
  private toolHandlers: Map<string, (args: Record<string, unknown>) => Promise<CallToolResult>> =
    new Map();
  private inputSchemas: Map<string, z.ZodType> = new Map();
  private outputSchemas: Map<string, JSONSchema7> = new Map();
  private sharedSchemas: Map<string, SharedSchema> = new Map();
  private initialized = false;

  constructor(private options: TestHarnessOptions) {
    this.server = new Server({
      name: 'test-harness',
      version: '0.0.0',
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const loadResult = loadToolsFromDirectory(this.options.definitionsDir, this.options.schemasDir);

    if (loadResult.errors.length > 0) {
      throw new Error(
        `Failed to load tool definitions:\n${loadResult.errors.map((e) => `  ${e.file}: ${e.message}`).join('\n')}`
      );
    }

    this.sharedSchemas = loadResult.schemas;

    for (const { definition } of loadResult.tools) {
      this.toolDefinitions.set(definition.name, definition);

      const resolvedInput = resolveRefs(definition.input, loadResult.schemas);
      const resolvedOutput = resolveRefs(definition.output, loadResult.schemas);

      const inputZod = this.jsonSchemaToZodRuntime(resolvedInput);
      this.inputSchemas.set(definition.name, inputZod);
      this.outputSchemas.set(definition.name, resolvedOutput);

      const handler = this.options.handlers?.[definition.name];
      if (handler) {
        this.toolHandlers.set(definition.name, handler);
      }
    }

    this.initialized = true;
  }

  setHandler(
    toolName: string,
    handler: (args: Record<string, unknown>) => Promise<CallToolResult>
  ): void {
    if (!this.toolDefinitions.has(toolName)) {
      throw new Error(
        `Unknown tool: ${toolName}. Available: ${[...this.toolDefinitions.keys()].join(', ')}`
      );
    }
    this.toolHandlers.set(toolName, handler);
  }

  async callTool(
    toolName: string,
    args: Record<string, unknown>,
    callOptions: ToolCallOptions = {}
  ): Promise<CallToolResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const definition = this.toolDefinitions.get(toolName);
    if (!definition) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    if (callOptions.validateInput !== false) {
      const inputSchema = this.inputSchemas.get(toolName);
      if (inputSchema) {
        const result = inputSchema.safeParse(args);
        if (!result.success) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Input validation failed',
                    details: result.error.issues,
                  },
                }),
              },
            ],
            isError: true,
          };
        }
      }
    }

    const handler = this.toolHandlers.get(toolName);
    if (!handler) {
      throw new Error(
        `No handler registered for tool: ${toolName}. ` +
          `Use setHandler() or pass handlers in options.`
      );
    }

    try {
      const result = await handler(args);
      return result;
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: {
                code: 'HANDLER_ERROR',
                message: error instanceof Error ? error.message : String(error),
              },
            }),
          },
        ],
        isError: true,
      };
    }
  }

  getToolDefinition(toolName: string): ToolDefinition | undefined {
    return this.toolDefinitions.get(toolName);
  }

  getOutputSchema(toolName: string): JSONSchema7 | undefined {
    return this.outputSchemas.get(toolName);
  }

  getToolNames(): string[] {
    return [...this.toolDefinitions.keys()];
  }

  private jsonSchemaToZodRuntime(schema: JSONSchema7): z.ZodType {
    const zodSource = jsonSchemaToZod(schema as Record<string, unknown>, { module: 'esm' });
    const cleanSource = zodSource.replace(/^import.*;\n*/gm, '').replace(/^export default /m, '');
    const fn = new Function('z', `return ${cleanSource}`);
    return fn(z) as z.ZodType;
  }
}
```

## Step 2: Build the Schema Validation Engine

The schema validator checks tool output against the JSON Schema defined in the tool's YAML. It uses AJV for JSON Schema validation and provides clear error messages.

Create `src/lib/schema-validator.ts`:

```typescript
import Ajv from 'ajv';
import type { JSONSchema7 } from './types.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

const ajv = new Ajv({ allErrors: true, strict: false });

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  path: string;
  message: string;
  expected?: string;
  received?: string;
}

export function validateOutputSchema(
  output: CallToolResult,
  schema: JSONSchema7
): ValidationResult {
  const content = extractContent(output);

  if (content === null) {
    return {
      valid: false,
      errors: [
        {
          path: '/',
          message: 'No text content found in CallToolResult',
        },
      ],
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return {
      valid: false,
      errors: [
        {
          path: '/',
          message: `Output is not valid JSON: ${content.slice(0, 100)}`,
        },
      ],
    };
  }

  return validateAgainstSchema(parsed, schema);
}

export function validateAgainstSchema(data: unknown, schema: JSONSchema7): ValidationResult {
  const validate = ajv.compile(schema);
  const valid = validate(data);

  if (valid) {
    return { valid: true, errors: [] };
  }

  const errors: ValidationError[] = (validate.errors ?? []).map((err) => ({
    path: err.instancePath || '/',
    message: err.message ?? 'Unknown validation error',
    expected: err.params ? JSON.stringify(err.params) : undefined,
  }));

  return { valid: false, errors };
}

export function extractContent(result: CallToolResult): string | null {
  if (!result.content || result.content.length === 0) {
    return null;
  }

  const textContent = result.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    return null;
  }

  return textContent.text;
}

export function extractParsedContent(result: CallToolResult): unknown {
  const text = extractContent(result);
  if (text === null) {
    throw new Error('No text content in result');
  }
  return JSON.parse(text);
}

export interface PropertyAssertionResult {
  pass: boolean;
  message: string;
}

export function assertProperty(
  data: unknown,
  path: string,
  assertion: Record<string, unknown>
): PropertyAssertionResult {
  const value = getNestedValue(data, path);

  for (const [op, expected] of Object.entries(assertion)) {
    switch (op) {
      case 'eq':
        if (value !== expected) {
          return {
            pass: false,
            message: `${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(value)}`,
          };
        }
        break;
      case 'neq':
        if (value === expected) {
          return {
            pass: false,
            message: `${path}: expected not equal to ${JSON.stringify(expected)}`,
          };
        }
        break;
      case 'gt':
        if (typeof value !== 'number' || value <= (expected as number)) {
          return { pass: false, message: `${path}: expected > ${expected}, got ${value}` };
        }
        break;
      case 'gte':
        if (typeof value !== 'number' || value < (expected as number)) {
          return { pass: false, message: `${path}: expected >= ${expected}, got ${value}` };
        }
        break;
      case 'lt':
        if (typeof value !== 'number' || value >= (expected as number)) {
          return { pass: false, message: `${path}: expected < ${expected}, got ${value}` };
        }
        break;
      case 'lte':
        if (typeof value !== 'number' || value > (expected as number)) {
          return { pass: false, message: `${path}: expected <= ${expected}, got ${value}` };
        }
        break;
      case 'contains':
        if (typeof value !== 'string' || !value.includes(expected as string)) {
          return {
            pass: false,
            message: `${path}: expected to contain "${expected}", got "${value}"`,
          };
        }
        break;
      case 'matches':
        if (typeof value !== 'string' || !new RegExp(expected as string).test(value)) {
          return {
            pass: false,
            message: `${path}: expected to match /${expected}/, got "${value}"`,
          };
        }
        break;
      case 'length':
        if (!Array.isArray(value) || value.length !== (expected as number)) {
          return {
            pass: false,
            message: `${path}: expected length ${expected}, got ${Array.isArray(value) ? value.length : 'non-array'}`,
          };
        }
        break;
      default:
        if (value !== expected) {
          return {
            pass: false,
            message: `${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(value)}`,
          };
        }
    }
  }

  return { pass: true, message: 'OK' };
}

function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}
```

## Step 3: Build the MSW API Mock Helper

Create `tests/helpers/api-mock.ts`:

```typescript
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { MockConfig } from '@lib/types.js';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const FIXTURES_DIR = join(import.meta.dirname, '../fixtures');

export type MockServer = ReturnType<typeof setupServer>;

let mockServerInstance: MockServer | null = null;

export function getMockServer(): MockServer {
  if (!mockServerInstance) {
    mockServerInstance = setupServer();
  }
  return mockServerInstance;
}

export function setupMockHandlers(
  mocks: MockConfig | MockConfig[],
  baseUrl: string = 'https://api.bitbucket.org'
): void {
  const mockArray = Array.isArray(mocks) ? mocks : [mocks];
  const server = getMockServer();

  const handlers = mockArray.map((mock) => {
    const { method, path } = parseEndpoint(mock.endpoint);
    const url = `${baseUrl}${path}`;

    let responseBody: unknown;
    if (mock.fixture) {
      responseBody = loadFixture(mock.fixture);
    } else if (mock.body !== undefined) {
      responseBody = mock.body;
    } else {
      responseBody = {};
    }

    const responseHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...mock.headers,
    };

    const httpMethod = getHttpMethod(method);

    return httpMethod(url, () => {
      return HttpResponse.json(responseBody as Record<string, unknown>, {
        status: mock.status,
        headers: responseHeaders,
      });
    });
  });

  server.use(...handlers);
}

export function loadFixture(fixturePath: string): unknown {
  let resolvedPath = fixturePath;

  if (!fixturePath.startsWith('/')) {
    resolvedPath = join(FIXTURES_DIR, fixturePath);
  }

  if (!existsSync(resolvedPath)) {
    throw new Error(`Fixture not found: ${resolvedPath}`);
  }

  const content = readFileSync(resolvedPath, 'utf-8');
  return JSON.parse(content);
}

function parseEndpoint(endpoint: string): { method: string; path: string } {
  const spaceIndex = endpoint.indexOf(' ');
  if (spaceIndex === -1) {
    return { method: 'GET', path: endpoint };
  }
  return {
    method: endpoint.slice(0, spaceIndex).toUpperCase(),
    path: endpoint.slice(spaceIndex + 1),
  };
}

function getHttpMethod(method: string) {
  switch (method) {
    case 'GET':
      return http.get;
    case 'POST':
      return http.post;
    case 'PUT':
      return http.put;
    case 'PATCH':
      return http.patch;
    case 'DELETE':
      return http.delete;
    default:
      return http.get;
  }
}

export function resetMockHandlers(): void {
  getMockServer().resetHandlers();
}

export function closeMockServer(): void {
  if (mockServerInstance) {
    mockServerInstance.close();
    mockServerInstance = null;
  }
}
```

**CRITICAL**: MSW v2 uses `http` and `HttpResponse` (not `rest`). The import paths are `msw` and `msw/node`.

## Step 4: Build the Mock MCP Server Helper

Create `tests/helpers/mock-server.ts`:

```typescript
import { TestHarness } from '@lib/test-harness.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { join } from 'node:path';

const PROJECT_ROOT = join(import.meta.dirname, '../..');
const DEFINITIONS_DIR = join(PROJECT_ROOT, 'src/tools/definitions');
const SCHEMAS_DIR = join(PROJECT_ROOT, 'src/tools/schemas');

export interface MockToolHandler {
  (args: Record<string, unknown>): Promise<CallToolResult>;
}

export function createTestHarness(handlers?: Record<string, MockToolHandler>): TestHarness {
  return new TestHarness({
    definitionsDir: DEFINITIONS_DIR,
    schemasDir: SCHEMAS_DIR,
    handlers,
  });
}

export function makeTextResult(data: unknown): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(data),
      },
    ],
  };
}

export function makeErrorResult(code: string, message: string): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ error: { code, message } }),
      },
    ],
    isError: true,
  };
}
```

## Step 5: Create Vitest Setup for MSW

Create `tests/helpers/setup.ts`:

```typescript
import { beforeAll, afterAll, afterEach } from 'vitest';
import { getMockServer, resetMockHandlers, closeMockServer } from './api-mock.js';

beforeAll(() => {
  getMockServer().listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  resetMockHandlers();
});

afterAll(() => {
  closeMockServer();
});
```

Update `vitest.config.ts` to include the setup file for tool tests:

Add a workspace configuration or update the existing config. The simplest approach is to add the setup file conditionally:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      exclude: ['src/generated/**', 'src/**/*.d.ts'],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    setupFiles: ['tests/helpers/setup.ts'],
    alias: {
      '@/': new URL('./src/', import.meta.url).pathname,
      '@lib/': new URL('./src/lib/', import.meta.url).pathname,
      '@generated/': new URL('./src/generated/', import.meta.url).pathname,
    },
  },
});
```

**IMPORTANT**: The MSW setup file is now loaded for ALL tests, including unit tests. This is acceptable because MSW is a no-op when no handlers are registered. If unit tests do not make HTTP calls, MSW adds zero overhead.

## Step 6: Unit Tests for Schema Validator

Create `tests/unit/schema-validator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  validateOutputSchema,
  validateAgainstSchema,
  extractContent,
  extractParsedContent,
  assertProperty,
} from '@lib/schema-validator.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { JSONSchema7 } from '@lib/types.js';

const SAMPLE_SCHEMA: JSONSchema7 = {
  type: 'object',
  properties: {
    values: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          title: { type: 'string' },
        },
        required: ['id', 'title'],
      },
    },
    count: { type: 'integer' },
  },
  required: ['values', 'count'],
};

function makeResult(data: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data) }],
  };
}

describe('validateOutputSchema', () => {
  it('validates valid output', () => {
    const result = makeResult({
      values: [{ id: 1, title: 'Test PR' }],
      count: 1,
    });
    const validation = validateOutputSchema(result, SAMPLE_SCHEMA);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('rejects output missing required fields', () => {
    const result = makeResult({ values: [] });
    const validation = validateOutputSchema(result, SAMPLE_SCHEMA);
    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });

  it('rejects output with wrong types', () => {
    const result = makeResult({
      values: [{ id: 'not-a-number', title: 123 }],
      count: 1,
    });
    const validation = validateOutputSchema(result, SAMPLE_SCHEMA);
    expect(validation.valid).toBe(false);
  });

  it('handles empty content array', () => {
    const result: CallToolResult = { content: [] };
    const validation = validateOutputSchema(result, SAMPLE_SCHEMA);
    expect(validation.valid).toBe(false);
    expect(validation.errors[0].message).toContain('No text content');
  });

  it('handles non-JSON content', () => {
    const result: CallToolResult = {
      content: [{ type: 'text', text: 'not json' }],
    };
    const validation = validateOutputSchema(result, SAMPLE_SCHEMA);
    expect(validation.valid).toBe(false);
    expect(validation.errors[0].message).toContain('not valid JSON');
  });
});

describe('validateAgainstSchema', () => {
  it('validates a plain object against schema', () => {
    const data = { values: [{ id: 1, title: 'PR' }], count: 1 };
    const result = validateAgainstSchema(data, SAMPLE_SCHEMA);
    expect(result.valid).toBe(true);
  });

  it('rejects invalid data', () => {
    const data = { values: 'not-an-array', count: 1 };
    const result = validateAgainstSchema(data, SAMPLE_SCHEMA);
    expect(result.valid).toBe(false);
  });
});

describe('extractContent', () => {
  it('extracts text from CallToolResult', () => {
    const result = makeResult({ test: true });
    expect(extractContent(result)).toBe('{"test":true}');
  });

  it('returns null for empty content', () => {
    expect(extractContent({ content: [] })).toBeNull();
  });

  it('returns null for image-only content', () => {
    const result: CallToolResult = {
      content: [{ type: 'image', data: 'base64data', mimeType: 'image/png' }],
    };
    expect(extractContent(result)).toBeNull();
  });
});

describe('extractParsedContent', () => {
  it('extracts and parses JSON content', () => {
    const result = makeResult({ id: 42 });
    expect(extractParsedContent(result)).toEqual({ id: 42 });
  });

  it('throws for empty content', () => {
    expect(() => extractParsedContent({ content: [] })).toThrow('No text content');
  });
});

describe('assertProperty', () => {
  const data = {
    values: [
      { id: 1, title: 'First' },
      { id: 2, title: 'Second' },
    ],
    count: 2,
    name: 'test-repo',
    nested: { deep: { value: 42 } },
  };

  it('asserts equality', () => {
    expect(assertProperty(data, 'count', { eq: 2 }).pass).toBe(true);
    expect(assertProperty(data, 'count', { eq: 3 }).pass).toBe(false);
  });

  it('asserts inequality', () => {
    expect(assertProperty(data, 'count', { neq: 3 }).pass).toBe(true);
    expect(assertProperty(data, 'count', { neq: 2 }).pass).toBe(false);
  });

  it('asserts greater than', () => {
    expect(assertProperty(data, 'count', { gt: 1 }).pass).toBe(true);
    expect(assertProperty(data, 'count', { gt: 2 }).pass).toBe(false);
  });

  it('asserts greater than or equal', () => {
    expect(assertProperty(data, 'count', { gte: 2 }).pass).toBe(true);
    expect(assertProperty(data, 'count', { gte: 3 }).pass).toBe(false);
  });

  it('asserts less than', () => {
    expect(assertProperty(data, 'count', { lt: 3 }).pass).toBe(true);
    expect(assertProperty(data, 'count', { lt: 2 }).pass).toBe(false);
  });

  it('asserts contains for strings', () => {
    expect(assertProperty(data, 'name', { contains: 'repo' }).pass).toBe(true);
    expect(assertProperty(data, 'name', { contains: 'xyz' }).pass).toBe(false);
  });

  it('asserts matches for regex', () => {
    expect(assertProperty(data, 'name', { matches: '^test-' }).pass).toBe(true);
    expect(assertProperty(data, 'name', { matches: '^foo' }).pass).toBe(false);
  });

  it('asserts array length', () => {
    expect(assertProperty(data, 'values', { length: 2 }).pass).toBe(true);
    expect(assertProperty(data, 'values', { length: 1 }).pass).toBe(false);
  });

  it('navigates nested paths', () => {
    expect(assertProperty(data, 'nested.deep.value', { eq: 42 }).pass).toBe(true);
  });

  it('returns false for undefined paths', () => {
    expect(assertProperty(data, 'nonexistent.path', { eq: 1 }).pass).toBe(false);
  });
});
```

## Step 7: Update SDK Barrel Export

Add test harness and schema validator exports to `src/lib/index.ts`:

```typescript
export { TestHarness } from './test-harness.js';
export type { TestHarnessOptions, ToolCallOptions } from './test-harness.js';

export {
  validateOutputSchema,
  validateAgainstSchema,
  extractContent,
  extractParsedContent,
  assertProperty,
} from './schema-validator.js';
export type { ValidationResult, ValidationError } from './schema-validator.js';
```

Append these to the existing exports.

## Step 8: Verify

```bash
# Run all unit tests including new ones
npx vitest run tests/unit/ --reporter=verbose

# Verify schema validator tests pass
npx vitest run tests/unit/schema-validator.test.ts --reporter=verbose

# Type check
npx tsc --noEmit -p tsconfig.test.json
```

## Files Created

| File                                  | Purpose                                        |
| ------------------------------------- | ---------------------------------------------- |
| `src/lib/test-harness.ts`             | In-memory MCP tool test harness                |
| `src/lib/schema-validator.ts`         | Output schema validation + property assertions |
| `tests/helpers/api-mock.ts`           | MSW-based Bitbucket API mock layer             |
| `tests/helpers/mock-server.ts`        | Test harness factory + result helpers          |
| `tests/helpers/setup.ts`              | Vitest setup for MSW lifecycle                 |
| `tests/unit/schema-validator.test.ts` | Schema validator unit tests                    |

## Files Modified

| File               | Changes                                     |
| ------------------ | ------------------------------------------- |
| `src/lib/index.ts` | Added TestHarness, schema validator exports |
| `vitest.config.ts` | Added `setupFiles` for MSW lifecycle        |

## Commit

```text
feat(test): add MCP test harness, schema validator, and API mock infrastructure

- Build in-memory MCP test harness with direct tool calling
- Implement schema validation engine with property assertions
- Add MSW-based API mock layer for Bitbucket HTTP calls
- Create test helper utilities for mock server and result construction
- Configure Vitest setup for MSW lifecycle management
- Add comprehensive unit tests for schema validator
```
