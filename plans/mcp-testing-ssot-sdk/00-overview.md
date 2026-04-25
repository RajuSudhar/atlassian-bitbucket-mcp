# MCP Tool Testing & SSOT SDK — Overview

## Goal

Build a complete YAML-driven Single Source of Truth (SSOT) system for defining, validating, code-generating, and testing all 20 MCP tools in the Atlassian Bitbucket MCP server. The system produces TypeScript types, Zod validators, and a declarative test runner from YAML tool definitions, and is structured as an extractable SDK from day one.

## Success Criteria

1. Every MCP tool is defined in exactly one YAML file that serves as its authoritative specification
2. TypeScript types and Zod validators are generated from YAML and committed to `src/generated/`
3. Runtime tool registration reads YAML definitions — no hand-written `server.registerTool()` calls
4. All 20 tools have declarative YAML test cases that validate input schemas, output schemas, and mock API interactions
5. The `src/lib/` directory is a self-contained, extractable SDK with zero imports from `src/` outside `lib/`
6. `npm run generate` produces types/validators; `npm test` runs all declarative + unit tests
7. CI-ready: all tests pass in under 30 seconds with no network calls

## Scope

### In Scope

- Vitest configuration with ESM support
- SDK core types (`ToolDefinition`, `TestCase`, etc.) in `src/lib/types.ts`
- YAML loader with JSON Schema validation of tool definition structure
- YAML tool definition schema and 20 tool definition files
- Runtime registry that loads YAMLs and calls `server.registerTool()`
- Code generation engine producing `types.ts`, `validators.ts`, `tool-list.ts`
- In-memory MCP test harness (no subprocess, no transport)
- Bitbucket API mock layer using `msw` (Mock Service Worker)
- YAML test case schema and test runner
- Schema validation engine for tool output verification
- Shared JSON Schema fragments for Bitbucket domain types
- npm scripts: `generate`, `generate:check`, `test`, `test:unit`, `test:tools`

### Out of Scope

- Actual Bitbucket API client implementation (Phase 6 writes stub handlers only)
- OAuth/SSO authentication flows
- MCP server transport layer (stdio/HTTP setup)
- CI/CD pipeline configuration
- Documentation generation from schemas
- MCP Inspector integration
- Performance benchmarking

## Dependencies

### npm Packages (to install in Phase 0)

| Package | Version | Purpose |
|---------|---------|---------|
| `@modelcontextprotocol/sdk` | `^1.18.1` | MCP Server, Tool types |
| `vitest` | `^3.1.x` | Test runner with native ESM |
| `zod` | `^3.24.x` | Runtime validation |
| `zod-to-json-schema` | `^3.24.x` | Zod-to-JSON-Schema for MCP |
| `json-schema-to-zod` | `^2.4.x` | JSON-Schema-to-Zod codegen |
| `yaml` | `^2.7.x` | YAML parsing |
| `ajv` | `^8.17.x` | JSON Schema validation of YAML structure |
| `msw` | `^2.7.x` | HTTP mock for Bitbucket API |
| `typescript` | `^5.8.x` | Compiler (currently missing from devDeps) |

### Existing Project Assets

- `tsconfig.json` — ES2022 target, strict mode, ESM
- `package.json` — `type: "module"`, `engines.node >= 20`
- `.husky/` — Conventional Commits enforcement
- `docs/ARCHITECTURE.md` — Permission model, cache config, tool categories
- `.env.example` — All environment variables documented

## Architecture

```
                    YAML Tool Definitions (SSOT)
                    src/tools/definitions/*.tool.yaml
                              |
              +---------------+---------------+
              |                               |
        [Build Time]                    [Runtime]
              |                               |
     scripts/generate.ts              src/tools/registry.ts
              |                               |
   +----------+----------+          loads YAML + registers
   |          |          |          with MCP Server instance
   v          v          v                    |
types.ts  validators.ts  tool-list.ts         v
(src/generated/)                    server.registerTool()
                                    per definition

        YAML Test Cases
        tests/tools/*.test.yaml
                  |
           tests/runner.test.ts
                  |
        +-------------------+
        |                   |
   src/lib/             msw mocks
   test-runner.ts       (Bitbucket API)
        |
   src/lib/
   test-harness.ts
        |
   In-memory MCP Server
   (no transport, direct call)
```

### Data Flow: Tool Registration

```
1. registry.ts reads src/tools/definitions/*.tool.yaml
2. For each YAML file:
   a. Parse YAML -> ToolDefinition object
   b. Validate structure against meta-schema (ajv)
   c. Convert inputSchema JSON Schema -> Zod schema (runtime)
   d. Resolve handler reference (file#function -> dynamic import)
   e. Call server.registerTool(name, { inputSchema: zodSchema, ... }, handler)
```

### Data Flow: Code Generation

```
1. scripts/generate.ts reads src/tools/definitions/*.tool.yaml
2. Also reads src/tools/schemas/*.schema.yaml for shared fragments
3. Resolves all $ref references
4. Generates:
   a. types.ts: interface per tool input/output + shared domain types
   b. validators.ts: Zod schema per tool input/output
   c. tool-list.ts: union type of tool names, metadata map
5. Writes to src/generated/ (committed to git)
```

### Data Flow: Test Execution

```
1. runner.test.ts globs tests/tools/*.test.yaml
2. For each test YAML:
   a. Parse -> TestSuite object
   b. For each test case:
      i.   Set up msw handlers from mock config
      ii.  Create in-memory MCP server with tool registered
      iii. Call tool with input
      iv.  Validate output against outputSchema (if schema: true)
      v.   Assert properties (values, lengths, patterns)
      vi.  Assert error conditions (isError, error codes)
      vii. Tear down msw handlers
```

## Files Created (by phase)

### Phase 0: Foundation
- `vitest.config.ts`
- `src/lib/` (directory)
- `src/tools/definitions/` (directory)
- `src/tools/schemas/` (directory)
- `src/generated/.gitkeep`
- `src/handlers/` (directory)
- `tests/tools/` (directory)
- `tests/fixtures/` (directory)
- `tests/unit/` (directory)
- `tests/helpers/` (directory)
- `scripts/generate.ts` (stub)

### Phase 1: SDK Core Types & Loader
- `src/lib/types.ts`
- `src/lib/loader.ts`
- `src/lib/index.ts`
- `tests/unit/loader.test.ts`

### Phase 2: SSOT Tool Registry
- `src/tools/schemas/pull-request.schema.yaml`
- `src/tools/schemas/repository.schema.yaml`
- `src/tools/schemas/common.schema.yaml`
- `src/tools/definitions/list-pull-requests.tool.yaml`
- `src/tools/definitions/get-pull-request.tool.yaml`
- `src/tools/definitions/list-repositories.tool.yaml`
- `src/tools/registry.ts`
- `src/server.ts`

### Phase 3: Code Generation
- `src/lib/codegen.ts`
- `scripts/generate.ts` (full implementation)
- `src/generated/types.ts`
- `src/generated/validators.ts`
- `src/generated/tool-list.ts`
- `tests/unit/codegen.test.ts`

### Phase 4: Test Infrastructure
- `src/lib/test-harness.ts`
- `src/lib/schema-validator.ts`
- `tests/helpers/mock-server.ts`
- `tests/helpers/api-mock.ts`
- `tests/unit/schema-validator.test.ts`

### Phase 5: Declarative Test Cases
- `src/lib/test-runner.ts`
- `tests/runner.test.ts`
- `tests/tools/list-pull-requests.test.yaml`
- `tests/tools/get-pull-request.test.yaml`
- `tests/tools/list-repositories.test.yaml`
- `tests/fixtures/pull-requests.json`
- `tests/fixtures/repositories.json`

### Phase 6: Full Tool Coverage
- 17 remaining `src/tools/definitions/*.tool.yaml`
- 17 remaining `tests/tools/*.test.yaml`
- `src/handlers/pull-requests.ts` (stubs)
- `src/handlers/repositories.ts` (stubs)
- `src/handlers/search.ts` (stubs)
- Additional `tests/fixtures/*.json` as needed
- Additional `src/tools/schemas/*.schema.yaml` as needed

## Files NOT Modified

| File | Reason |
|------|--------|
| `src/index.ts` | Entry point stays as-is until server implementation (separate task) |
| `docs/ARCHITECTURE.md` | Architecture doc is reference only; not updated in this plan |
| `docs/SECURITY.md` | Security concerns are out of scope |
| `.husky/*` | Git hooks already configured |
| `.env.example` | Environment config not affected by testing/SSOT system |
| `scripts/check-package-security.sh` | Security script is independent |

## Phase Dependency Graph

```
Phase 0 (Foundation)
   |
   v
Phase 1 (SDK Core Types & Loader)
   |
   v
Phase 2 (SSOT Tool Registry)  ----+
   |                               |
   v                               |
Phase 3 (Code Generation)         |
   |                               |
   v                               v
Phase 4 (Test Infrastructure) <----+
   |
   v
Phase 5 (Declarative Test Cases)
   |
   v
Phase 6 (Full Tool Coverage)
```

Phases are strictly sequential. Each phase depends on all prior phases being complete.
