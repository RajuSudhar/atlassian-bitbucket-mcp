# Phase 5: Declarative Test Cases

## Objective

Build the YAML test case runner in `src/lib/test-runner.ts`, create the Vitest entry point that dynamically loads and executes YAML test suites, write test cases for the three exemplar tools, and establish the fixture data files.

## Scope

### In Scope
- YAML test case runner in `src/lib/test-runner.ts`
- Vitest entry point `tests/runner.test.ts` that loads YAML test suites
- Test case YAML files for `list_pull_requests`, `get_pull_request`, `list_repositories`
- Fixture JSON files for Bitbucket API mock responses
- Meta-schema validation of test case YAML structure

### Out of Scope
- Test cases for the remaining 17 tools (Phase 6)
- Real handler implementations (stubs return fixture data for testing)
- Performance testing or benchmarks

## Step 1: Build the YAML Test Runner

The test runner parses YAML test suites and executes each case against the in-memory MCP test harness. It integrates with the schema validator and API mock layer.

Create `src/lib/test-runner.ts`:

```typescript
import { parse as parseYaml } from 'yaml';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import Ajv from 'ajv';
import type {
  TestSuite,
  TestCase,
  MockConfig,
  ExpectConfig,
  FixtureRef,
  JSONSchema7,
} from './types.js';

const TEST_SUITE_META_SCHEMA: JSONSchema7 = {
  type: 'object',
  required: ['tool', 'cases'],
  properties: {
    tool: { type: 'string' },
    fixtures: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'file'],
        properties: {
          name: { type: 'string' },
          file: { type: 'string' },
        },
      },
    },
    cases: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['name', 'expect'],
        properties: {
          name: { type: 'string' },
          input: { type: 'object' },
          mock: {},
          expect: {
            type: 'object',
            properties: {
              schema: { type: 'boolean' },
              isError: { type: 'boolean' },
              content_type: {
                type: 'string',
                enum: ['text', 'image', 'resource'],
              },
              properties: { type: 'object' },
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: {},
                },
              },
            },
          },
        },
      },
    },
  },
  additionalProperties: false,
};

const ajv = new Ajv({ allErrors: true, strict: false });
const validateTestSuite = ajv.compile(TEST_SUITE_META_SCHEMA);

export function parseTestSuiteYaml(content: string, filePath: string): TestSuite {
  const parsed = parseYaml(content);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`Invalid test suite YAML in ${filePath}: expected an object`);
  }

  const valid = validateTestSuite(parsed);
  if (!valid) {
    const errors = (validateTestSuite.errors ?? [])
      .map((err) => `${err.instancePath || '/'} ${err.message ?? 'unknown error'}`)
      .join('\n  ');
    throw new Error(`Test suite validation failed in ${filePath}:\n  ${errors}`);
  }

  return parsed as TestSuite;
}

export function loadTestSuite(filePath: string): TestSuite {
  const content = readFileSync(filePath, 'utf-8');
  return parseTestSuiteYaml(content, filePath);
}

export function loadTestSuitesFromDirectory(testsDir: string): Map<string, TestSuite> {
  const suites = new Map<string, TestSuite>();

  if (!existsSync(testsDir)) {
    return suites;
  }

  const files = readdirSync(testsDir)
    .filter((f) => f.endsWith('.test.yaml'))
    .sort();

  for (const file of files) {
    const filePath = join(testsDir, file);
    const suite = loadTestSuite(filePath);
    suites.set(basename(file, '.test.yaml'), suite);
  }

  return suites;
}

export function loadFixtures(
  refs: FixtureRef[] | undefined,
  fixturesDir: string
): Map<string, unknown> {
  const fixtures = new Map<string, unknown>();

  if (!refs || refs.length === 0) {
    return fixtures;
  }

  for (const ref of refs) {
    let resolvedPath = ref.file;
    if (!resolvedPath.startsWith('/')) {
      resolvedPath = join(fixturesDir, ref.file);
    }

    if (!existsSync(resolvedPath)) {
      throw new Error(`Fixture file not found: ${resolvedPath} (referenced as '${ref.name}')`);
    }

    const content = readFileSync(resolvedPath, 'utf-8');
    fixtures.set(ref.name, JSON.parse(content));
  }

  return fixtures;
}

export function resolveFixtureReference(
  value: unknown,
  fixtures: Map<string, unknown>
): unknown {
  if (typeof value === 'string' && value.startsWith('$fixture:')) {
    const fixtureName = value.slice('$fixture:'.length);
    if (!fixtures.has(fixtureName)) {
      throw new Error(`Unknown fixture reference: ${fixtureName}`);
    }
    return fixtures.get(fixtureName);
  }
  return value;
}

export function resolveMockFixtures(
  mock: MockConfig | MockConfig[] | undefined,
  fixtures: Map<string, unknown>
): MockConfig | MockConfig[] | undefined {
  if (!mock) return undefined;

  const mocks = Array.isArray(mock) ? mock : [mock];

  const resolved = mocks.map((m) => {
    if (m.fixture && typeof m.fixture === 'string') {
      const fixtureData = fixtures.get(m.fixture) ?? resolveFixtureReference(`$fixture:${m.fixture}`, fixtures);
      return { ...m, body: fixtureData };
    }
    return m;
  });

  return resolved.length === 1 ? resolved[0] : resolved;
}
```

## Step 2: Create Test Fixtures

### `tests/fixtures/pull-requests.json`

```json
{
  "size": 2,
  "page": 1,
  "pagelen": 25,
  "values": [
    {
      "id": 101,
      "title": "Add user authentication flow",
      "description": "Implements OAuth2 authentication for the API",
      "state": "OPEN",
      "created_on": "2026-04-10T14:30:00.000000+00:00",
      "updated_on": "2026-04-14T09:15:00.000000+00:00",
      "author": {
        "uuid": "{a1b2c3d4-e5f6-7890-abcd-ef1234567890}",
        "display_name": "Alice Developer",
        "nickname": "alicedev",
        "account_id": "123456789"
      },
      "source": {
        "branch": {
          "name": "feature/auth"
        },
        "commit": {
          "hash": "abc123def456"
        },
        "repository": {
          "full_name": "myteam/my-repo",
          "name": "my-repo",
          "uuid": "{repo-uuid-1}"
        }
      },
      "destination": {
        "branch": {
          "name": "main"
        },
        "commit": {
          "hash": "789xyz012345"
        },
        "repository": {
          "full_name": "myteam/my-repo",
          "name": "my-repo",
          "uuid": "{repo-uuid-1}"
        }
      },
      "reviewers": [
        {
          "uuid": "{b2c3d4e5-f6a7-8901-bcde-f12345678901}",
          "display_name": "Bob Reviewer",
          "nickname": "bobreview"
        }
      ],
      "participants": [],
      "close_source_branch": true,
      "comment_count": 3,
      "task_count": 1,
      "links": {
        "self": {
          "href": "https://api.bitbucket.org/2.0/repositories/myteam/my-repo/pullrequests/101"
        },
        "html": {
          "href": "https://bitbucket.org/myteam/my-repo/pull-requests/101"
        }
      }
    },
    {
      "id": 102,
      "title": "Fix pagination bug in search results",
      "description": "Fixes off-by-one error in pagination logic",
      "state": "OPEN",
      "created_on": "2026-04-12T10:00:00.000000+00:00",
      "updated_on": "2026-04-13T16:45:00.000000+00:00",
      "author": {
        "uuid": "{c3d4e5f6-a7b8-9012-cdef-123456789012}",
        "display_name": "Charlie Coder",
        "nickname": "charliec"
      },
      "source": {
        "branch": {
          "name": "bugfix/pagination"
        },
        "commit": {
          "hash": "def456ghi789"
        },
        "repository": {
          "full_name": "myteam/my-repo",
          "name": "my-repo",
          "uuid": "{repo-uuid-1}"
        }
      },
      "destination": {
        "branch": {
          "name": "main"
        },
        "commit": {
          "hash": "789xyz012345"
        },
        "repository": {
          "full_name": "myteam/my-repo",
          "name": "my-repo",
          "uuid": "{repo-uuid-1}"
        }
      },
      "reviewers": [],
      "participants": [],
      "close_source_branch": false,
      "comment_count": 0,
      "task_count": 0,
      "links": {
        "self": {
          "href": "https://api.bitbucket.org/2.0/repositories/myteam/my-repo/pullrequests/102"
        },
        "html": {
          "href": "https://bitbucket.org/myteam/my-repo/pull-requests/102"
        }
      }
    }
  ]
}
```

### `tests/fixtures/pull-request-detail.json`

```json
{
  "id": 101,
  "title": "Add user authentication flow",
  "description": "Implements OAuth2 authentication for the API.\n\n## Changes\n- Add OAuth2 middleware\n- Add token refresh logic\n- Add login/logout endpoints",
  "state": "OPEN",
  "created_on": "2026-04-10T14:30:00.000000+00:00",
  "updated_on": "2026-04-14T09:15:00.000000+00:00",
  "author": {
    "uuid": "{a1b2c3d4-e5f6-7890-abcd-ef1234567890}",
    "display_name": "Alice Developer",
    "nickname": "alicedev",
    "account_id": "123456789"
  },
  "source": {
    "branch": { "name": "feature/auth" },
    "commit": { "hash": "abc123def456" },
    "repository": { "full_name": "myteam/my-repo", "name": "my-repo", "uuid": "{repo-uuid-1}" }
  },
  "destination": {
    "branch": { "name": "main" },
    "commit": { "hash": "789xyz012345" },
    "repository": { "full_name": "myteam/my-repo", "name": "my-repo", "uuid": "{repo-uuid-1}" }
  },
  "reviewers": [
    {
      "uuid": "{b2c3d4e5-f6a7-8901-bcde-f12345678901}",
      "display_name": "Bob Reviewer",
      "nickname": "bobreview"
    }
  ],
  "participants": [
    {
      "user": {
        "uuid": "{b2c3d4e5-f6a7-8901-bcde-f12345678901}",
        "display_name": "Bob Reviewer"
      },
      "role": "REVIEWER",
      "approved": false,
      "state": null
    }
  ],
  "close_source_branch": true,
  "merge_commit": null,
  "comment_count": 3,
  "task_count": 1,
  "links": {
    "self": { "href": "https://api.bitbucket.org/2.0/repositories/myteam/my-repo/pullrequests/101" },
    "html": { "href": "https://bitbucket.org/myteam/my-repo/pull-requests/101" },
    "diff": { "href": "https://api.bitbucket.org/2.0/repositories/myteam/my-repo/pullrequests/101/diff" }
  }
}
```

### `tests/fixtures/repositories.json`

```json
{
  "size": 2,
  "page": 1,
  "pagelen": 25,
  "values": [
    {
      "uuid": "{repo-uuid-1}",
      "name": "my-repo",
      "full_name": "myteam/my-repo",
      "slug": "my-repo",
      "description": "Main application repository",
      "is_private": true,
      "created_on": "2025-01-15T10:00:00.000000+00:00",
      "updated_on": "2026-04-14T12:00:00.000000+00:00",
      "language": "typescript",
      "mainbranch": {
        "name": "main",
        "type": "branch"
      },
      "owner": {
        "uuid": "{owner-uuid-1}",
        "display_name": "My Team"
      },
      "project": {
        "key": "PROJ",
        "name": "Main Project",
        "uuid": "{project-uuid-1}"
      },
      "links": {
        "self": { "href": "https://api.bitbucket.org/2.0/repositories/myteam/my-repo" },
        "html": { "href": "https://bitbucket.org/myteam/my-repo" },
        "clone": [
          { "href": "https://bitbucket.org/myteam/my-repo.git", "name": "https" },
          { "href": "git@bitbucket.org:myteam/my-repo.git", "name": "ssh" }
        ]
      }
    },
    {
      "uuid": "{repo-uuid-2}",
      "name": "shared-lib",
      "full_name": "myteam/shared-lib",
      "slug": "shared-lib",
      "description": "Shared utility library",
      "is_private": true,
      "created_on": "2025-03-20T08:00:00.000000+00:00",
      "updated_on": "2026-04-10T15:30:00.000000+00:00",
      "language": "typescript",
      "mainbranch": {
        "name": "main",
        "type": "branch"
      },
      "owner": {
        "uuid": "{owner-uuid-1}",
        "display_name": "My Team"
      },
      "project": {
        "key": "PROJ",
        "name": "Main Project",
        "uuid": "{project-uuid-1}"
      },
      "links": {
        "self": { "href": "https://api.bitbucket.org/2.0/repositories/myteam/shared-lib" },
        "html": { "href": "https://bitbucket.org/myteam/shared-lib" }
      }
    }
  ]
}
```

## Step 3: Write Declarative Test Cases

### `tests/tools/list-pull-requests.test.yaml`

```yaml
tool: list_pull_requests
fixtures:
  - name: mock_prs
    file: pull-requests.json
cases:
  - name: "lists open pull requests successfully"
    input:
      workspace: "myteam"
      repo_slug: "my-repo"
    mock:
      endpoint: GET /2.0/repositories/myteam/my-repo/pullrequests
      fixture: mock_prs
      status: 200
    expect:
      schema: true
      content_type: text
      properties:
        values.length:
          eq: 2
        size:
          eq: 2

  - name: "filters by state parameter"
    input:
      workspace: "myteam"
      repo_slug: "my-repo"
      state: "OPEN"
    mock:
      endpoint: GET /2.0/repositories/myteam/my-repo/pullrequests?state=OPEN
      fixture: mock_prs
      status: 200
    expect:
      schema: true

  - name: "returns error for missing workspace"
    input:
      repo_slug: "my-repo"
    expect:
      isError: true
      error:
        code: "VALIDATION_ERROR"

  - name: "returns error for missing repo_slug"
    input:
      workspace: "myteam"
    expect:
      isError: true
      error:
        code: "VALIDATION_ERROR"

  - name: "handles API 404 error"
    input:
      workspace: "nonexistent"
      repo_slug: "no-repo"
    mock:
      endpoint: GET /2.0/repositories/nonexistent/no-repo/pullrequests
      status: 404
      body:
        error:
          message: "Repository not found"
    expect:
      isError: true

  - name: "supports pagination parameters"
    input:
      workspace: "myteam"
      repo_slug: "my-repo"
      page: 2
      pagelen: 10
    mock:
      endpoint: GET /2.0/repositories/myteam/my-repo/pullrequests?page=2&pagelen=10
      fixture: mock_prs
      status: 200
    expect:
      schema: true
```

### `tests/tools/get-pull-request.test.yaml`

```yaml
tool: get_pull_request
fixtures:
  - name: mock_pr_detail
    file: pull-request-detail.json
cases:
  - name: "gets a specific pull request by ID"
    input:
      workspace: "myteam"
      repo_slug: "my-repo"
      pull_request_id: 101
    mock:
      endpoint: GET /2.0/repositories/myteam/my-repo/pullrequests/101
      fixture: mock_pr_detail
      status: 200
    expect:
      schema: true
      properties:
        id:
          eq: 101
        title:
          contains: "authentication"
        state:
          eq: "OPEN"

  - name: "returns error for missing pull_request_id"
    input:
      workspace: "myteam"
      repo_slug: "my-repo"
    expect:
      isError: true
      error:
        code: "VALIDATION_ERROR"

  - name: "returns error for non-integer pull_request_id"
    input:
      workspace: "myteam"
      repo_slug: "my-repo"
      pull_request_id: "abc"
    expect:
      isError: true
      error:
        code: "VALIDATION_ERROR"

  - name: "handles API 404 for nonexistent PR"
    input:
      workspace: "myteam"
      repo_slug: "my-repo"
      pull_request_id: 99999
    mock:
      endpoint: GET /2.0/repositories/myteam/my-repo/pullrequests/99999
      status: 404
      body:
        error:
          message: "Pull request not found"
    expect:
      isError: true
```

### `tests/tools/list-repositories.test.yaml`

```yaml
tool: list_repositories
fixtures:
  - name: mock_repos
    file: repositories.json
cases:
  - name: "lists repositories in a workspace"
    input:
      workspace: "myteam"
    mock:
      endpoint: GET /2.0/repositories/myteam
      fixture: mock_repos
      status: 200
    expect:
      schema: true
      properties:
        values.length:
          eq: 2

  - name: "filters by project key"
    input:
      workspace: "myteam"
      project_key: "PROJ"
    mock:
      endpoint: GET /2.0/repositories/myteam?q=project.key="PROJ"
      fixture: mock_repos
      status: 200
    expect:
      schema: true

  - name: "returns error for missing workspace"
    input: {}
    expect:
      isError: true
      error:
        code: "VALIDATION_ERROR"

  - name: "supports sort parameter"
    input:
      workspace: "myteam"
      sort: "-updated_on"
    mock:
      endpoint: GET /2.0/repositories/myteam?sort=-updated_on
      fixture: mock_repos
      status: 200
    expect:
      schema: true

  - name: "handles API 401 unauthorized"
    input:
      workspace: "myteam"
    mock:
      endpoint: GET /2.0/repositories/myteam
      status: 401
      body:
        error:
          message: "Authentication required"
    expect:
      isError: true
```

## Step 4: Build the Vitest Entry Point

Create `tests/runner.test.ts`:

```typescript
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { TestHarness } from '@lib/test-harness.js';
import {
  loadTestSuitesFromDirectory,
  loadFixtures,
  resolveMockFixtures,
} from '@lib/test-runner.js';
import {
  validateOutputSchema,
  extractParsedContent,
  assertProperty,
} from '@lib/schema-validator.js';
import { setupMockHandlers, resetMockHandlers } from './helpers/api-mock.js';
import { makeTextResult, makeErrorResult } from './helpers/mock-server.js';
import type { TestSuite, TestCase, MockConfig, ExpectConfig } from '@lib/types.js';

const PROJECT_ROOT = join(import.meta.dirname, '..');
const TESTS_DIR = join(import.meta.dirname, 'tools');
const FIXTURES_DIR = join(import.meta.dirname, 'fixtures');
const DEFINITIONS_DIR = join(PROJECT_ROOT, 'src/tools/definitions');
const SCHEMAS_DIR = join(PROJECT_ROOT, 'src/tools/schemas');

const suites = loadTestSuitesFromDirectory(TESTS_DIR);

let harness: TestHarness;

beforeAll(async () => {
  harness = new TestHarness({
    definitionsDir: DEFINITIONS_DIR,
    schemasDir: SCHEMAS_DIR,
  });
  await harness.initialize();
});

for (const [suiteName, suite] of suites) {
  describe(`Tool: ${suite.tool} (${suiteName})`, () => {
    const fixtures = loadFixtures(suite.fixtures, FIXTURES_DIR);

    for (const testCase of suite.cases) {
      it(testCase.name, async () => {
        if (testCase.mock) {
          const resolvedMock = resolveMockFixtures(testCase.mock, fixtures);
          if (resolvedMock) {
            setupMockHandlers(resolvedMock as MockConfig | MockConfig[]);
          }
        }

        const needsMockHandler = testCase.mock && !testCase.expect.isError;
        if (needsMockHandler) {
          const mockData = getMockResponseData(testCase, fixtures);
          harness.setHandler(suite.tool, async () => makeTextResult(mockData));
        }

        if (testCase.expect.isError && !testCase.mock) {
          // Input validation error — no handler needed, harness validates input
        } else if (!needsMockHandler && !testCase.expect.isError) {
          // Edge case: no mock, no error expected — skip or fail
        }

        const result = await harness.callTool(suite.tool, testCase.input ?? {});

        if (testCase.expect.isError) {
          expect(result.isError).toBe(true);

          if (testCase.expect.error) {
            const parsed = JSON.parse(
              result.content.find((c) => c.type === 'text')?.text ?? '{}'
            );

            if (testCase.expect.error.code) {
              expect(parsed.error?.code).toBe(testCase.expect.error.code);
            }

            if (testCase.expect.error.message) {
              if (typeof testCase.expect.error.message === 'string') {
                expect(parsed.error?.message).toContain(testCase.expect.error.message);
              }
            }
          }
          return;
        }

        expect(result.isError).toBeFalsy();

        if (testCase.expect.schema) {
          const outputSchema = harness.getOutputSchema(suite.tool);
          if (outputSchema) {
            const validation = validateOutputSchema(result, outputSchema);
            expect(validation.valid, `Schema validation failed: ${JSON.stringify(validation.errors)}`).toBe(true);
          }
        }

        if (testCase.expect.content_type) {
          const contentItem = result.content[0];
          expect(contentItem.type).toBe(testCase.expect.content_type);
        }

        if (testCase.expect.properties) {
          const parsed = extractParsedContent(result);
          for (const [path, assertion] of Object.entries(testCase.expect.properties)) {
            const assertionObj = typeof assertion === 'object' && assertion !== null
              ? assertion as Record<string, unknown>
              : { eq: assertion };
            const propResult = assertProperty(parsed, path, assertionObj);
            expect(propResult.pass, propResult.message).toBe(true);
          }
        }
      });
    }
  });
}

function getMockResponseData(
  testCase: TestCase,
  fixtures: Map<string, unknown>
): unknown {
  const mock = Array.isArray(testCase.mock) ? testCase.mock[0] : testCase.mock;
  if (!mock) return {};

  if (mock.fixture && fixtures.has(mock.fixture)) {
    return fixtures.get(mock.fixture);
  }

  if (mock.body !== undefined) {
    return mock.body;
  }

  return {};
}
```

**CRITICAL**: The runner iterates over all YAML test suites found in `tests/tools/` at import time. Each suite becomes a `describe` block and each case becomes an `it` block. This means Vitest discovers all tests statically.

**IMPORTANT**: For input validation error cases (where `expect.isError` is true and no `mock` is defined), the test harness's built-in input validation handles the assertion. No mock handler needs to be set.

## Step 5: Update SDK Barrel Export

Add test runner exports to `src/lib/index.ts`:

```typescript
export {
  parseTestSuiteYaml,
  loadTestSuite,
  loadTestSuitesFromDirectory,
  loadFixtures,
  resolveFixtureReference,
  resolveMockFixtures,
} from './test-runner.js';
```

Append these to the existing exports.

## Step 6: Verify

```bash
# Run all tests including YAML-driven test cases
npx vitest run --reporter=verbose

# Run only tool tests
npm run test:tools

# Run only unit tests
npm run test:unit

# Verify all test suites are discovered
npx vitest run tests/runner.test.ts --reporter=verbose

# Expected output should show 3 describe blocks:
#   Tool: list_pull_requests (list-pull-requests) — 6 tests
#   Tool: get_pull_request (get-pull-request) — 4 tests
#   Tool: list_repositories (list-repositories) — 5 tests
# Total: 15 test cases

# Type check
npx tsc --noEmit -p tsconfig.test.json
```

## Files Created

| File | Purpose |
|------|---------|
| `src/lib/test-runner.ts` | YAML test suite parser + fixture resolution |
| `tests/runner.test.ts` | Vitest entry point for declarative test execution |
| `tests/tools/list-pull-requests.test.yaml` | 6 test cases for list_pull_requests |
| `tests/tools/get-pull-request.test.yaml` | 4 test cases for get_pull_request |
| `tests/tools/list-repositories.test.yaml` | 5 test cases for list_repositories |
| `tests/fixtures/pull-requests.json` | Mock Bitbucket PR list response |
| `tests/fixtures/pull-request-detail.json` | Mock Bitbucket PR detail response |
| `tests/fixtures/repositories.json` | Mock Bitbucket repository list response |

## Files Modified

| File | Changes |
|------|---------|
| `src/lib/index.ts` | Added test-runner exports |

## Commit

```
feat(test): add YAML-driven declarative test cases and test runner

- Build YAML test suite parser with meta-schema validation
- Create Vitest entry point that dynamically loads YAML test cases
- Write 15 test cases across 3 tool definitions
- Add Bitbucket API fixture data (PRs, repositories)
- Integrate test harness, schema validator, and API mocks
- Support fixture references, mock configuration, and property assertions
```
