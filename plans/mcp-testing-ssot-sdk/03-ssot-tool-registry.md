# Phase 2: SSOT Tool Registry

## Objective

Create the YAML tool definition schema, write the first three tool definitions as exemplars, define shared schema fragments for Bitbucket domain types, and build the runtime registry that loads YAMLs and registers tools with the MCP Server.

## Scope

### In Scope
- Shared JSON Schema fragments for Bitbucket domain types
- Three exemplar tool definitions (covering PR read, PR detail, repo list)
- Runtime registry module that loads YAML and registers with MCP Server
- Basic `server.ts` that initializes the MCP Server and uses the registry

### Out of Scope
- Handler implementations (stubs only — real logic is a separate task)
- The remaining 17 tool definitions (Phase 6)
- Code generation (Phase 3)
- Test infrastructure (Phase 4)

## Step 1: Define Shared Schema Fragments

These fragments define the Bitbucket domain types referenced by `$ref` in tool definitions.

### `src/tools/schemas/common.schema.yaml`

```yaml
definitions:
  User:
    type: object
    properties:
      uuid:
        type: string
        description: "User UUID in {uuid} format"
      display_name:
        type: string
      nickname:
        type: string
      account_id:
        type: string
      links:
        type: object
        properties:
          avatar:
            type: object
            properties:
              href:
                type: string
                format: uri
    required:
      - uuid
      - display_name

  Link:
    type: object
    properties:
      href:
        type: string
        format: uri
    required:
      - href

  PaginatedResponse:
    type: object
    properties:
      size:
        type: integer
        description: "Total number of items"
      page:
        type: integer
      pagelen:
        type: integer
        description: "Items per page"
      next:
        type: string
        format: uri
        description: "URL for next page"
      previous:
        type: string
        format: uri
        description: "URL for previous page"
```

### `src/tools/schemas/pull-request.schema.yaml`

```yaml
definitions:
  PullRequest:
    type: object
    properties:
      id:
        type: integer
      title:
        type: string
      description:
        type: string
      state:
        type: string
        enum:
          - OPEN
          - MERGED
          - DECLINED
          - SUPERSEDED
      created_on:
        type: string
        format: date-time
      updated_on:
        type: string
        format: date-time
      author:
        $ref: "common.schema.yaml#/definitions/User"
      source:
        $ref: "#/definitions/PullRequestEndpoint"
      destination:
        $ref: "#/definitions/PullRequestEndpoint"
      reviewers:
        type: array
        items:
          $ref: "common.schema.yaml#/definitions/User"
      participants:
        type: array
        items:
          $ref: "#/definitions/PullRequestParticipant"
      close_source_branch:
        type: boolean
      merge_commit:
        type: object
        properties:
          hash:
            type: string
      comment_count:
        type: integer
      task_count:
        type: integer
      links:
        type: object
        properties:
          self:
            $ref: "common.schema.yaml#/definitions/Link"
          html:
            $ref: "common.schema.yaml#/definitions/Link"
          diff:
            $ref: "common.schema.yaml#/definitions/Link"
    required:
      - id
      - title
      - state
      - author

  PullRequestEndpoint:
    type: object
    properties:
      branch:
        type: object
        properties:
          name:
            type: string
      commit:
        type: object
        properties:
          hash:
            type: string
      repository:
        type: object
        properties:
          full_name:
            type: string
          name:
            type: string
          uuid:
            type: string

  PullRequestParticipant:
    type: object
    properties:
      user:
        $ref: "common.schema.yaml#/definitions/User"
      role:
        type: string
        enum:
          - PARTICIPANT
          - REVIEWER
          - AUTHOR
      approved:
        type: boolean
      state:
        type: string
        enum:
          - approved
          - changes_requested
          - null

  PullRequestComment:
    type: object
    properties:
      id:
        type: integer
      content:
        type: object
        properties:
          raw:
            type: string
          markup:
            type: string
          html:
            type: string
      user:
        $ref: "common.schema.yaml#/definitions/User"
      created_on:
        type: string
        format: date-time
      updated_on:
        type: string
        format: date-time
      inline:
        type: object
        properties:
          from:
            type: integer
          to:
            type: integer
          path:
            type: string
      parent:
        type: object
        properties:
          id:
            type: integer
    required:
      - id
      - content
      - user

  PullRequestActivity:
    type: object
    properties:
      comment:
        $ref: "#/definitions/PullRequestComment"
      approval:
        type: object
        properties:
          user:
            $ref: "common.schema.yaml#/definitions/User"
          date:
            type: string
            format: date-time
      update:
        type: object
        properties:
          state:
            type: string
          date:
            type: string
            format: date-time
          author:
            $ref: "common.schema.yaml#/definitions/User"
```

### `src/tools/schemas/repository.schema.yaml`

```yaml
definitions:
  Repository:
    type: object
    properties:
      uuid:
        type: string
      name:
        type: string
      full_name:
        type: string
        description: "workspace/repo_slug format"
      slug:
        type: string
      description:
        type: string
      is_private:
        type: boolean
      created_on:
        type: string
        format: date-time
      updated_on:
        type: string
        format: date-time
      language:
        type: string
      mainbranch:
        type: object
        properties:
          name:
            type: string
          type:
            type: string
      owner:
        $ref: "common.schema.yaml#/definitions/User"
      project:
        type: object
        properties:
          key:
            type: string
          name:
            type: string
          uuid:
            type: string
      links:
        type: object
        properties:
          self:
            $ref: "common.schema.yaml#/definitions/Link"
          html:
            $ref: "common.schema.yaml#/definitions/Link"
          clone:
            type: array
            items:
              type: object
              properties:
                href:
                  type: string
                name:
                  type: string
                  enum:
                    - https
                    - ssh
    required:
      - uuid
      - name
      - full_name

  Branch:
    type: object
    properties:
      name:
        type: string
      target:
        type: object
        properties:
          hash:
            type: string
          date:
            type: string
            format: date-time
          message:
            type: string
          author:
            $ref: "common.schema.yaml#/definitions/User"
    required:
      - name

  Commit:
    type: object
    properties:
      hash:
        type: string
      message:
        type: string
      date:
        type: string
        format: date-time
      author:
        type: object
        properties:
          raw:
            type: string
          user:
            $ref: "common.schema.yaml#/definitions/User"
      parents:
        type: array
        items:
          type: object
          properties:
            hash:
              type: string
    required:
      - hash
      - message
      - date

  FileContent:
    type: object
    properties:
      path:
        type: string
      content:
        type: string
      size:
        type: integer
      encoding:
        type: string
        enum:
          - utf-8
          - base64
    required:
      - path
      - content
```

## Step 2: Write Exemplar Tool Definitions

### `src/tools/definitions/list-pull-requests.tool.yaml`

```yaml
name: list_pull_requests
description: "List pull requests for a Bitbucket repository with optional state filtering. Returns paginated results including PR title, author, state, and branch information."
permission: read_pr
cache:
  ttl: 1800
  key: "${workspace}:${repo_slug}:prs:${state}"
annotations:
  audience:
    - user
    - assistant
  priority: 1
input:
  type: object
  required:
    - workspace
    - repo_slug
  properties:
    workspace:
      type: string
      description: "The Bitbucket workspace slug or UUID"
    repo_slug:
      type: string
      description: "The repository slug"
    state:
      type: string
      enum:
        - OPEN
        - MERGED
        - DECLINED
        - SUPERSEDED
      description: "Filter by PR state. Defaults to OPEN if not specified."
    page:
      type: integer
      minimum: 1
      description: "Page number for pagination (1-based)"
    pagelen:
      type: integer
      minimum: 1
      maximum: 50
      description: "Number of results per page (max 50)"
output:
  type: object
  properties:
    values:
      type: array
      items:
        $ref: "pull-request.schema.yaml#/definitions/PullRequest"
    size:
      type: integer
    page:
      type: integer
    pagelen:
      type: integer
    next:
      type: string
      format: uri
  required:
    - values
handler: src/handlers/pull-requests.ts#listPullRequests
```

### `src/tools/definitions/get-pull-request.tool.yaml`

```yaml
name: get_pull_request
description: "Get detailed information about a specific pull request including its description, reviewers, participants, and merge status."
permission: read_pr
cache:
  ttl: 300
  key: "${workspace}:${repo_slug}:pr:${pull_request_id}"
annotations:
  audience:
    - user
    - assistant
  priority: 1
input:
  type: object
  required:
    - workspace
    - repo_slug
    - pull_request_id
  properties:
    workspace:
      type: string
      description: "The Bitbucket workspace slug or UUID"
    repo_slug:
      type: string
      description: "The repository slug"
    pull_request_id:
      type: integer
      minimum: 1
      description: "The pull request ID number"
output:
  $ref: "pull-request.schema.yaml#/definitions/PullRequest"
handler: src/handlers/pull-requests.ts#getPullRequest
```

### `src/tools/definitions/list-repositories.tool.yaml`

```yaml
name: list_repositories
description: "List repositories in a Bitbucket workspace. Returns paginated results with repository name, language, project, and branch information."
permission: read_repo
cache:
  ttl: 3600
  key: "${workspace}:repos:${project_key}"
annotations:
  audience:
    - user
    - assistant
  priority: 1
input:
  type: object
  required:
    - workspace
  properties:
    workspace:
      type: string
      description: "The Bitbucket workspace slug or UUID"
    project_key:
      type: string
      description: "Filter repositories by project key"
    page:
      type: integer
      minimum: 1
      description: "Page number for pagination (1-based)"
    pagelen:
      type: integer
      minimum: 1
      maximum: 100
      description: "Number of results per page (max 100)"
    sort:
      type: string
      enum:
        - name
        - -name
        - created_on
        - -created_on
        - updated_on
        - -updated_on
      description: "Sort field and direction (prefix with - for descending)"
output:
  type: object
  properties:
    values:
      type: array
      items:
        $ref: "repository.schema.yaml#/definitions/Repository"
    size:
      type: integer
    page:
      type: integer
    pagelen:
      type: integer
    next:
      type: string
      format: uri
  required:
    - values
handler: src/handlers/repositories.ts#listRepositories
```

## Step 3: Create Stub Handlers

These are minimal stubs that the registry can import. Real implementation is a separate task.

### `src/handlers/pull-requests.ts`

```typescript
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export async function listPullRequests(
  args: Record<string, unknown>
): Promise<CallToolResult> {
  throw new Error('listPullRequests not implemented');
}

export async function getPullRequest(
  args: Record<string, unknown>
): Promise<CallToolResult> {
  throw new Error('getPullRequest not implemented');
}
```

### `src/handlers/repositories.ts`

```typescript
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export async function listRepositories(
  args: Record<string, unknown>
): Promise<CallToolResult> {
  throw new Error('listRepositories not implemented');
}
```

### `src/handlers/search.ts`

```typescript
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export async function searchCode(
  args: Record<string, unknown>
): Promise<CallToolResult> {
  throw new Error('searchCode not implemented');
}

export async function searchCommits(
  args: Record<string, unknown>
): Promise<CallToolResult> {
  throw new Error('searchCommits not implemented');
}
```

## Step 4: Build the Runtime Registry

The registry reads YAML definitions at startup, converts JSON Schema to Zod schemas at runtime, dynamically imports handlers, and registers each tool with the MCP Server.

Create `src/tools/registry.ts`:

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { jsonSchemaToZod } from 'json-schema-to-zod';
import { z } from 'zod';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadToolsFromDirectory,
  resolveRefs,
} from '../lib/loader.js';
import type { ToolDefinition, Permission } from '../lib/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface RegistryOptions {
  definitionsDir?: string;
  schemasDir?: string;
  allowedActions?: Permission[];
}

export interface RegistryResult {
  registeredCount: number;
  skippedCount: number;
  errors: string[];
}

function jsonSchemaToZodSchema(jsonSchema: Record<string, unknown>): z.ZodType {
  const zodSource = jsonSchemaToZod(jsonSchema, { module: 'esm' });
  const fn = new Function('z', `return ${zodSource.replace(/^import.*;\n*/gm, '').replace(/^export default /m, '')}`);
  return fn(z) as z.ZodType;
}

function parseHandlerReference(ref: string): { file: string; functionName: string } {
  const hashIndex = ref.lastIndexOf('#');
  if (hashIndex === -1) {
    throw new Error(`Invalid handler reference (missing #): ${ref}`);
  }
  return {
    file: ref.slice(0, hashIndex),
    functionName: ref.slice(hashIndex + 1),
  };
}

async function importHandler(
  handlerRef: string,
  projectRoot: string
): Promise<(args: Record<string, unknown>) => Promise<unknown>> {
  const { file, functionName } = parseHandlerReference(handlerRef);
  const absolutePath = join(projectRoot, file);

  const module = await import(absolutePath) as Record<string, unknown>;

  const handler = module[functionName];
  if (typeof handler !== 'function') {
    throw new Error(
      `Handler function '${functionName}' not found in ${file}. ` +
      `Available exports: ${Object.keys(module).join(', ')}`
    );
  }

  return handler as (args: Record<string, unknown>) => Promise<unknown>;
}

function isActionAllowed(permission: Permission, allowedActions?: Permission[]): boolean {
  if (!allowedActions || allowedActions.length === 0) {
    return true;
  }
  return allowedActions.includes(permission);
}

export async function registerToolsFromYaml(
  server: Server,
  options: RegistryOptions = {}
): Promise<RegistryResult> {
  const projectRoot = join(__dirname, '../..');
  const definitionsDir = options.definitionsDir ?? join(__dirname, 'definitions');
  const schemasDir = options.schemasDir ?? join(__dirname, 'schemas');

  const loadResult = loadToolsFromDirectory(definitionsDir, schemasDir);

  const result: RegistryResult = {
    registeredCount: 0,
    skippedCount: 0,
    errors: [...loadResult.errors.map((e) => `${e.file}: ${e.message}`)],
  };

  for (const { definition, filePath } of loadResult.tools) {
    try {
      if (!isActionAllowed(definition.permission, options.allowedActions)) {
        result.skippedCount++;
        continue;
      }

      const resolvedInput = resolveRefs(definition.input, loadResult.schemas);
      const resolvedOutput = resolveRefs(definition.output, loadResult.schemas);

      const inputZod = jsonSchemaToZodSchema(resolvedInput as Record<string, unknown>);

      let outputZod: z.ZodType | undefined;
      try {
        outputZod = jsonSchemaToZodSchema(resolvedOutput as Record<string, unknown>);
      } catch {
        outputZod = undefined;
      }

      const handler = await importHandler(definition.handler, projectRoot);

      const toolConfig: Record<string, unknown> = {
        description: definition.description,
        inputSchema: inputZod,
      };

      if (outputZod) {
        toolConfig.outputSchema = outputZod;
      }

      if (definition.annotations) {
        toolConfig.annotations = definition.annotations;
      }

      server.registerTool(
        definition.name,
        toolConfig as Parameters<typeof server.registerTool>[1],
        async (args: Record<string, unknown>) => {
          return handler(args);
        }
      );

      result.registeredCount++;
    } catch (error) {
      result.errors.push(
        `Failed to register ${definition.name} from ${filePath}: ` +
        (error instanceof Error ? error.message : String(error))
      );
    }
  }

  return result;
}
```

**CRITICAL**: The `jsonSchemaToZodSchema` function uses `json-schema-to-zod` which generates Zod source code as a string. The function evaluates this string to produce a runtime Zod schema. This is the bridge between JSON Schema in YAML and Zod validation at runtime.

**IMPORTANT**: The `new Function` approach is used intentionally here. The alternative would be to write the generated Zod code to a temp file and import it, but that adds filesystem overhead. The input to `new Function` is deterministic (generated from JSON Schema, not user input), so this is safe.

## Step 5: Create the Server Module

Create `src/server.ts`:

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { registerToolsFromYaml } from './tools/registry.js';
import type { Permission } from './lib/types.js';

export interface ServerOptions {
  name?: string;
  version?: string;
  allowedActions?: Permission[];
}

export async function createServer(options: ServerOptions = {}): Promise<Server> {
  const server = new Server({
    name: options.name ?? 'atlassian-bitbucket-mcp',
    version: options.version ?? '0.1.0',
  });

  const registryResult = await registerToolsFromYaml(server, {
    allowedActions: options.allowedActions,
  });

  if (registryResult.errors.length > 0) {
    console.error('Tool registration errors:');
    for (const error of registryResult.errors) {
      console.error(`  - ${error}`);
    }
  }

  console.error(
    `Registered ${registryResult.registeredCount} tools ` +
    `(${registryResult.skippedCount} skipped by permission filter)`
  );

  return server;
}
```

**IMPORTANT**: Log messages go to `stderr` (via `console.error`) because MCP servers using stdio transport reserve `stdout` for protocol messages.

## Step 6: Verify

```bash
# Type check everything
npx tsc --noEmit

# Verify YAML files parse correctly
node -e "
import { loadToolsFromDirectory } from './src/lib/loader.js';
const result = loadToolsFromDirectory('./src/tools/definitions', './src/tools/schemas');
console.log('Tools loaded:', result.tools.length);
console.log('Schemas loaded:', result.schemas.size);
console.log('Errors:', result.errors);
"

# Run existing tests (should still pass)
npx vitest run
```

## Files Created

| File | Purpose |
|------|---------|
| `src/tools/schemas/common.schema.yaml` | User, Link, PaginatedResponse schemas |
| `src/tools/schemas/pull-request.schema.yaml` | PullRequest and related schemas |
| `src/tools/schemas/repository.schema.yaml` | Repository, Branch, Commit, FileContent schemas |
| `src/tools/definitions/list-pull-requests.tool.yaml` | SSOT definition for list_pull_requests |
| `src/tools/definitions/get-pull-request.tool.yaml` | SSOT definition for get_pull_request |
| `src/tools/definitions/list-repositories.tool.yaml` | SSOT definition for list_repositories |
| `src/tools/registry.ts` | Runtime YAML-to-MCP tool registration |
| `src/server.ts` | MCP Server factory with tool auto-registration |
| `src/handlers/pull-requests.ts` | Stub handlers for PR tools |
| `src/handlers/repositories.ts` | Stub handlers for repo tools |
| `src/handlers/search.ts` | Stub handlers for search tools |

## Commit

```
feat(tools): add SSOT tool registry with YAML definitions and shared schemas

- Define shared Bitbucket domain schemas (User, PullRequest, Repository)
- Create first 3 tool definitions as YAML SSOT exemplars
- Build runtime registry that loads YAML and registers MCP tools
- Convert JSON Schema to Zod at runtime for input validation
- Add server.ts factory with permission-based tool filtering
- Create stub handlers for PR, repo, and search tools
```
