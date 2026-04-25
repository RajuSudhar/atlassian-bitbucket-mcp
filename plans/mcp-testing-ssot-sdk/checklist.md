# MCP Tool Testing & SSOT SDK — Implementation Checklist

## Phase 0: Foundation

- [ ] Install production dependencies (`@modelcontextprotocol/sdk`, `zod`, `zod-to-json-schema`, `yaml`, `ajv`)
- [ ] Install dev dependencies (`typescript`, `vitest`, `json-schema-to-zod`, `msw`, `@types/node`)
- [ ] Create directory structure (`src/tools/definitions/`, `src/tools/schemas/`, `src/generated/`, `src/handlers/`, `src/lib/`, `src/bitbucket/`, `tests/tools/`, `tests/fixtures/`, `tests/unit/`, `tests/helpers/`, `scripts/`)
- [ ] Create `vitest.config.ts` with ESM config, aliases, coverage settings
- [ ] Update `tsconfig.json` (`moduleResolution: bundler`, add `paths`)
- [ ] Create `tsconfig.test.json`
- [ ] Update `package.json` scripts (`test`, `test:unit`, `test:tools`, `generate`, `generate:check`, `typecheck`, `typecheck:test`)
- [ ] Create `scripts/generate.ts` stub
- [ ] Verify: `npx tsc --noEmit` passes
- [ ] Verify: `npx vitest run` runs (0 tests found)

### Verification Commands
```bash
npx tsc --noEmit
npx vitest run --reporter=verbose 2>&1 | head -20
npm run generate
node -e "import('@modelcontextprotocol/sdk').then(() => console.log('OK'))"
node -e "import('zod').then(() => console.log('OK'))"
node -e "import('yaml').then(() => console.log('OK'))"
```

---

## Phase 1: SDK Core Types & Loader

- [ ] Create `src/lib/types.ts` with all type definitions (`ToolDefinition`, `TestCase`, `TestSuite`, `JSONSchema7`, etc.)
- [ ] Create `src/lib/loader.ts` with meta-schema, YAML parser, validator, directory loader, `$ref` resolver
- [ ] Create `src/lib/index.ts` barrel export
- [ ] Create `tests/unit/loader.test.ts` with tests for parse, validate, load, resolve
- [ ] Verify: `npx vitest run tests/unit/loader.test.ts` — all tests pass

### Verification Commands
```bash
npx vitest run tests/unit/loader.test.ts --reporter=verbose
npx tsc --noEmit -p tsconfig.test.json
```

---

## Phase 2: SSOT Tool Registry

- [ ] Create `src/tools/schemas/common.schema.yaml` (User, Link, PaginatedResponse)
- [ ] Create `src/tools/schemas/pull-request.schema.yaml` (PullRequest, Comment, Activity, etc.)
- [ ] Create `src/tools/schemas/repository.schema.yaml` (Repository, Branch, Commit, FileContent)
- [ ] Create `src/tools/definitions/list-pull-requests.tool.yaml`
- [ ] Create `src/tools/definitions/get-pull-request.tool.yaml`
- [ ] Create `src/tools/definitions/list-repositories.tool.yaml`
- [ ] Create `src/handlers/pull-requests.ts` (stubs)
- [ ] Create `src/handlers/repositories.ts` (stubs)
- [ ] Create `src/handlers/search.ts` (stubs)
- [ ] Create `src/tools/registry.ts` (YAML-to-MCP registration)
- [ ] Create `src/server.ts` (Server factory)
- [ ] Verify: YAML files parse and validate via loader
- [ ] Verify: `npx tsc --noEmit` passes

### Verification Commands
```bash
npx tsc --noEmit
npx vitest run tests/unit/loader.test.ts --reporter=verbose
node -e "
import { loadToolsFromDirectory } from './src/lib/loader.js';
const r = loadToolsFromDirectory('./src/tools/definitions', './src/tools/schemas');
console.log('Tools:', r.tools.length, 'Schemas:', r.schemas.size, 'Errors:', r.errors.length);
"
```

---

## Phase 3: Code Generation

- [ ] Create `src/lib/codegen.ts` (`generateTypes`, `generateValidators`, `generateToolList`, `generateAll`)
- [ ] Update `scripts/generate.ts` with full implementation and `--check` mode
- [ ] Run `npm run generate` — produces `src/generated/types.ts`, `validators.ts`, `tool-list.ts`
- [ ] Update `src/lib/index.ts` with codegen exports
- [ ] Create `tests/unit/codegen.test.ts`
- [ ] Verify: generated files compile with `npx tsc --noEmit`
- [ ] Verify: `npm run generate:check` passes
- [ ] Verify: codegen unit tests pass

### Verification Commands
```bash
npm run generate
npx tsc --noEmit
npm run generate:check
npx vitest run tests/unit/codegen.test.ts --reporter=verbose
```

---

## Phase 4: Test Infrastructure

- [ ] Create `src/lib/test-harness.ts` (`TestHarness` class)
- [ ] Create `src/lib/schema-validator.ts` (`validateOutputSchema`, `assertProperty`, etc.)
- [ ] Create `tests/helpers/api-mock.ts` (MSW setup, `setupMockHandlers`, `loadFixture`)
- [ ] Create `tests/helpers/mock-server.ts` (`createTestHarness`, `makeTextResult`, `makeErrorResult`)
- [ ] Create `tests/helpers/setup.ts` (Vitest setup for MSW lifecycle)
- [ ] Update `vitest.config.ts` with `setupFiles`
- [ ] Update `src/lib/index.ts` with test harness and validator exports
- [ ] Create `tests/unit/schema-validator.test.ts`
- [ ] Verify: all unit tests pass

### Verification Commands
```bash
npx vitest run tests/unit/ --reporter=verbose
npx vitest run tests/unit/schema-validator.test.ts --reporter=verbose
npx tsc --noEmit -p tsconfig.test.json
```

---

## Phase 5: Declarative Test Cases

- [ ] Create `src/lib/test-runner.ts` (YAML test suite parser, fixture loader, meta-schema)
- [ ] Create `tests/runner.test.ts` (Vitest entry point for YAML-driven tests)
- [ ] Create `tests/tools/list-pull-requests.test.yaml` (6 cases)
- [ ] Create `tests/tools/get-pull-request.test.yaml` (4 cases)
- [ ] Create `tests/tools/list-repositories.test.yaml` (5 cases)
- [ ] Create `tests/fixtures/pull-requests.json`
- [ ] Create `tests/fixtures/pull-request-detail.json`
- [ ] Create `tests/fixtures/repositories.json`
- [ ] Update `src/lib/index.ts` with test-runner exports
- [ ] Verify: `npm run test:tools` — 15 test cases pass

### Verification Commands
```bash
npx vitest run tests/runner.test.ts --reporter=verbose
npm run test:tools
npm run test:unit
npx vitest run --reporter=verbose
npx tsc --noEmit -p tsconfig.test.json
```

---

## Phase 6: Full Tool Coverage

- [ ] Create `src/tools/schemas/search.schema.yaml`
- [ ] Create 17 remaining tool definition YAML files
- [ ] Add stub handler functions for all new tools
- [ ] Create 17 test case YAML files (53+ test cases)
- [ ] Create 12 additional fixture JSON files
- [ ] Run `npm run generate` to regenerate with all 20 tools
- [ ] Verify: `TOOL_COUNT = 20` in generated output
- [ ] Verify: `npm run generate:check` passes
- [ ] Verify: `npm run test` — all 68+ test cases pass
- [ ] Verify: `npx tsc --noEmit` passes

### Verification Commands
```bash
npm run generate
npm run generate:check
npx vitest run --reporter=verbose
npm run test
npx tsc --noEmit
npx tsc --noEmit -p tsconfig.test.json
node -e "
import { loadToolsFromDirectory } from './src/lib/loader.js';
const r = loadToolsFromDirectory('./src/tools/definitions', './src/tools/schemas');
console.log('Total tools:', r.tools.length);
console.log('Errors:', r.errors.length);
"
```

---

## Summary Table

| Phase | Description | Key Deliverables | Est. Files |
|-------|-------------|------------------|------------|
| 0 | Foundation | Vitest config, deps, dirs, scripts | 4 created, 2 modified |
| 1 | SDK Core Types & Loader | types.ts, loader.ts, index.ts, tests | 4 created |
| 2 | SSOT Tool Registry | 3 schemas, 3 tool YAMLs, registry, server, handlers | 11 created |
| 3 | Code Generation | codegen.ts, generate script, generated output, tests | 6 created, 2 modified |
| 4 | Test Infrastructure | harness, validator, mock helpers, setup, tests | 6 created, 2 modified |
| 5 | Declarative Test Cases | runner, 3 test YAMLs, 3 fixtures | 8 created, 1 modified |
| 6 | Full Tool Coverage | 17 tool YAMLs, 17 test YAMLs, 12 fixtures, schema | 47+ created, 5 modified |
| **Total** | | | **86+ files** |

## Final Acceptance Criteria

- [ ] `npm run generate` succeeds with 20 tools
- [ ] `npm run generate:check` exits 0
- [ ] `npm run test` passes with 68+ test cases in under 30 seconds
- [ ] `npm run typecheck` passes
- [ ] `npm run typecheck:test` passes
- [ ] All 20 tools defined in YAML with complete input/output schemas
- [ ] All generated files committed and up to date
- [ ] `src/lib/` has zero imports from outside `src/lib/` (extractable SDK)
- [ ] No `any` types in source code
- [ ] No network calls during test execution
