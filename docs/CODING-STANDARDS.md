# Coding Standards

This document defines the coding standards and best practices for the Atlassian Bitbucket MCP server project.

## TypeScript Standards

### Type vs Interface

**CRITICAL REQUIREMENT**: Always use `type` (NOT `interface`) for all structure definitions.

**Rationale**:

- Consistent codebase style across all files
- Better composition with union and intersection types
- More flexible for future refactoring and type manipulation
- Avoids confusion between `type` and `interface` usage

**Correct Examples**:

```typescript
// CORRECT - Use type for object structures
type User = {
  id: string;
  name: string;
  email: string;
};

// CORRECT - Use type for union types
type Status = 'active' | 'inactive' | 'pending';

// CORRECT - Use type for intersection types
type TimestampedUser = User & {
  createdAt: Date;
  updatedAt: Date;
};

// CORRECT - Use type for generic structures
type ApiResponse<T> = {
  data: T;
  status: number;
  timestamp: number;
};

// CORRECT - Use type for function signatures
type LogFunction = (level: string, message: string) => void;
```

**Incorrect Examples**:

```typescript
// INCORRECT - Never use interface
interface User {
  // ❌ DO NOT USE INTERFACE
  id: string;
  name: string;
}

// INCORRECT - Do not use interface for object structures
interface ApiResponse<T> {
  // ❌ DO NOT USE INTERFACE
  data: T;
  status: number;
}
```

**Exception**: Only use `interface` when:

- Extending built-in class types (rare)
- Declaration merging is explicitly required (very rare)

### Type Organization

**Directory Structure**:

All shared types MUST be placed in the `types/` directory at project root:

```text
types/
├── index.ts              # Re-exports all types from subdirectories
├── bitbucket.ts          # Bitbucket API-related types
├── mcp.ts                # MCP protocol-related types
├── config.ts             # Configuration types
├── cache.ts              # Cache-related types
├── logger.ts             # Logging-related types
└── common.ts             # Common/utility types
```

**Type Exports**:

```typescript
// types/index.ts - Central export file
export type * from './bitbucket';
export type * from './mcp';
export type * from './config';
export type * from './cache';
export type * from './logger';
export type * from './common';
```

**Type Imports**:

```typescript
// From src/ directory
import type { BitbucketRepository, PullRequest } from '@types';

// From cli/ directory (future)
import type { BitbucketRepository, PullRequest } from '@types';

// Specific type file import (when needed)
import type { CacheEntry } from '@types/cache';
```

**Rationale for Root-Level types/**:

- Accessible by both `src/` and future `cli/` directories
- Single source of truth for type definitions
- Prevents circular dependencies
- Clear separation of types from implementation

### Type Naming Conventions

**PascalCase for type names**:

```typescript
type User = { ... };
type ApiResponse = { ... };
type BitbucketRepository = { ... };
```

**Descriptive type names**:

```typescript
// GOOD - Descriptive, clear purpose
type PullRequestState = 'OPEN' | 'MERGED' | 'DECLINED';
type CacheEntry<T> = { data: T; timestamp: number; ttl: number };

// BAD - Too generic, unclear
type State = 'OPEN' | 'MERGED' | 'DECLINED';
type Entry<T> = { data: T; timestamp: number; ttl: number };
```

## Logging Standards

### Centralized Logger Function

**CRITICAL REQUIREMENT**: All logging MUST use the centralized logger function from `src/logger.ts`.

**Implementation**:

```typescript
// src/logger.ts
import type { LogLevel, LogContext } from '@types/logger';

export function log(level: LogLevel, message: string, context?: LogContext): void {
  // Current implementation: Structured console logging
  const timestamp = new Date().toISOString();
  const contextStr = context ? JSON.stringify(context) : '';
  console.log(`[${timestamp}] [${level.toUpperCase()}] ${message} ${contextStr}`);
}
```

**Type Definitions**:

```typescript
// types/logger.ts
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogContext = {
  operation?: string;
  toolName?: string;
  userId?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  error?: string;
  [key: string]: unknown; // Allow additional context fields
};
```

**Usage Examples**:

```typescript
import { log } from './logger';

// Server initialization
log('info', 'MCP server starting', { operation: 'server_init' });

// Tool execution
log('info', 'Executing tool', {
  operation: 'tool_execute',
  toolName: 'bitbucket_get_pr',
  prId: '123',
});

// API requests
log('debug', 'Calling Bitbucket API', {
  operation: 'api_request',
  endpoint: '/rest/api/2.0/repositories',
  method: 'GET',
});

// API responses
log('debug', 'Bitbucket API response', {
  operation: 'api_response',
  endpoint: '/rest/api/2.0/repositories',
  statusCode: 200,
});

// Errors
log('error', 'API request failed', {
  operation: 'api_error',
  endpoint: '/rest/api/2.0/pull-requests',
  error: err.message,
  statusCode: 500,
});

// Cache operations
log('debug', 'Cache hit', {
  operation: 'cache_hit',
  key: 'bitbucket:repos:PROJECT-KEY',
});

log('debug', 'Cache miss', {
  operation: 'cache_miss',
  key: 'bitbucket:repos:PROJECT-KEY',
});
```

### Critical Logging Paths

Logging is REQUIRED at these critical paths:

1. **Server Lifecycle**:
   - Server initialization start/complete
   - Server shutdown start/complete
   - Configuration loading

2. **Tool Execution**:
   - Tool execution start (with tool name and parameters)
   - Tool execution complete (with execution time)
   - Tool execution error

3. **API Interactions**:
   - All Bitbucket API requests (endpoint, method)
   - All Bitbucket API responses (status code, duration)
   - API errors (error message, status code)

4. **Authentication**:
   - Authentication attempts (success/failure)
   - Token validation
   - Permission checks

5. **Cache Operations**:
   - Cache hits (key, data type)
   - Cache misses (key)
   - Cache invalidation (pattern)
   - Cache clearing

6. **Error Handling**:
   - All caught errors with context
   - Rate limit events
   - Retry attempts

7. **Performance Events**:
   - Slow operations (> 1s)
   - Large responses (> 1MB)

### Future Logging Enhancement

The current logging implementation will be replaced with OpenTelemetry integration:

**Future Implementation**:

```typescript
import { trace } from '@opentelemetry/api';

export function log(level: LogLevel, message: string, context?: LogContext): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.addEvent(message, context);
  }
  // Also log to console for development
  console.log(`[${level.toUpperCase()}] ${message}`, context);
}
```

**Benefits**:

- Distributed tracing with trace IDs
- Integration with observability platforms (Datadog, New Relic, etc.)
- Correlation of logs across services
- Performance monitoring and profiling

## OpenAPI Specification Maintenance

### YAML File Management

**CRITICAL REQUIREMENT**: Maintain up-to-date OpenAPI YAML files alongside TypeScript type definitions.

**Purpose**:

- Documentation of Bitbucket API structure
- Single source of truth for future type generation
- Migration path to automated type generation
- API contract validation

**Directory Structure**:

```text
openapi/
├── bitbucket-cloud.yaml      # Bitbucket Cloud REST API 2.0 specification
└── bitbucket-server.yaml     # Bitbucket Server/DC REST API specification
```

### Current Approach (Manual Types)

**Workflow**:

1. Define TypeScript types in `types/` directory
2. Create corresponding OpenAPI YAML definitions
3. Validate YAML with OpenAPI validator
4. Commit both TypeScript types and YAML together

**Example**:

```typescript
// types/bitbucket.ts
export type PullRequest = {
  id: number;
  title: string;
  state: 'OPEN' | 'MERGED' | 'DECLINED';
  author: User;
  createdDate: number;
  updatedDate: number;
};

export type User = {
  name: string;
  emailAddress: string;
  displayName: string;
};
```

Corresponding OpenAPI YAML:

```yaml
# openapi/bitbucket-cloud.yaml
openapi: 3.0.0
info:
  title: Bitbucket Cloud API
  version: 2.0.0

components:
  schemas:
    PullRequest:
      type: object
      required:
        - id
        - title
        - state
        - author
        - createdDate
        - updatedDate
      properties:
        id:
          type: integer
          description: Unique identifier for the pull request
        title:
          type: string
          description: Title of the pull request
        state:
          type: string
          enum: [OPEN, MERGED, DECLINED]
          description: Current state of the pull request
        author:
          $ref: '#/components/schemas/User'
        createdDate:
          type: integer
          description: Unix timestamp of creation
        updatedDate:
          type: integer
          description: Unix timestamp of last update

    User:
      type: object
      required:
        - name
        - emailAddress
        - displayName
      properties:
        name:
          type: string
          description: Username
        emailAddress:
          type: string
          format: email
          description: User email address
        displayName:
          type: string
          description: Display name
```

### Future Approach (Automated Type Generation)

**Migration Path**:

1. Use `openapi-typescript` or similar tool
2. Generate TypeScript types from YAML
3. YAML becomes single source of truth
4. CI/CD validates YAML and regenerates types

**Benefits**:

- Single source of truth (YAML)
- No manual synchronization needed
- Automatic type updates when API changes
- Validation of API contract

**Tools to Consider**:

- `openapi-typescript` - Generate TypeScript from OpenAPI specs
- `@hey-api/openapi-ts` - TypeScript-first OpenAPI code generator
- `swagger-typescript-api` - Another option for type generation

## Code Style

### Formatting Standards

**Prettier Configuration** (see [.prettierrc](.prettierrc)):

- Single quotes for strings
- 2-space indentation
- 100-character line length for code
- Semicolons required
- Trailing commas (ES5 style)

**ESLint Configuration** (see [eslint.config.js](eslint.config.js)):

- Import ordering (alphabetical within groups)
- No unused imports
- Separate type imports
- No duplicate imports

### Import Organization

**Import Order** (enforced by ESLint):

1. Node.js built-in modules
2. External packages
3. Internal modules
4. Parent/sibling imports
5. Type imports (separate)

**Example**:

```typescript
// 1. Node.js built-ins
import fs from 'fs';
import path from 'path';

// 2. External packages
import axios from 'axios';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

// 3. Internal modules
import { Cache } from './cache';
import { log } from './logger';

// 4. Parent/sibling imports
import { BitbucketClient } from '../bitbucket/client';

// 5. Type imports (always separate and last)
import type { CacheEntry } from '@types/cache';
import type { LogContext } from '@types/logger';
import type { PullRequest } from '@types/bitbucket';
```

### Naming Conventions

**Files and Directories**:

- Lowercase with hyphens: `pull-request-tools.ts`
- Singular for types: `user.ts`, `repository.ts`

**Variables and Functions**:

- camelCase: `getUserById`, `cacheEntry`
- Descriptive names: `bitbucketClient` not `client`

**Types**:

- PascalCase: `User`, `PullRequest`, `ApiResponse`
- Prefix boolean types with `is`, `has`, `should`: `isEnabled`, `hasPermission`

**Constants**:

- UPPER_SNAKE_CASE: `DEFAULT_CACHE_TTL`, `MAX_RETRIES`

### No Emojis

**CRITICAL REQUIREMENT**: No emojis in any code, scripts, or output.

**Incorrect**:

```typescript
console.log('✅ Success!');
console.error('❌ Failed');
```

**Correct**:

```typescript
console.log('SUCCESS: Operation completed');
console.error('ERROR: Operation failed');
```

## Pre-commit Standards

### Validation Checks

All code MUST pass these checks before commit:

1. **Branch name validation** - Enforced naming conventions
2. **Code formatting** - Prettier formatting
3. **Markdown linting** - Markdownlint validation
4. **Code linting** - ESLint checks
5. **Type checking** - TypeScript compilation
6. **Build verification** - Successful build

**Pre-commit Script** (see [scripts/pre-commit.sh](scripts/pre-commit.sh)):

```bash
./scripts/validate-branch-name.sh # Branch validation
pnpm run format                   # Auto-format code
pnpm run lint:md:fix              # Fix markdown issues
pnpm run lint                     # Fix linting issues
pnpm run typecheck                # Type checking
pnpm run build                    # Build verification
```

### Branch Naming

See [BRANCH-MANAGEMENT.md](BRANCH-MANAGEMENT.md) for detailed branch naming standards.

**Valid Branch Types**:

- `feature` - New features
- `release` - Release preparation
- `fix` - Bug fixes
- `doc` - Documentation changes
- `test` - Test additions/modifications
- `chore` - Maintenance tasks
- `refactor` - Code refactoring
- `hotfix` - Urgent production fixes

**Format**:

- With ticket: `<type>/<TICKET-ID>-<description>`
- Without ticket: `<type>/<multi-word-description>`

## Testing Standards

### Test File Organization

```text
src/
├── cache.ts
├── cache.test.ts           # Unit tests alongside implementation
├── logger.ts
├── logger.test.ts
└── bitbucket/
    ├── client.ts
    └── client.test.ts
```

### Test Framework

- **Jest** - Primary test framework
- **TypeScript** - All tests in TypeScript
- **Coverage** - Minimum 80% coverage target

### Test Naming

```typescript
// Describe block: Component/Function name
describe('Cache', () => {
  // Test case: should + behavior
  it('should return null for non-existent key', () => {
    // ...
  });

  it('should cache entry with TTL', () => {
    // ...
  });

  it('should invalidate entries matching pattern', () => {
    // ...
  });
});
```

## Documentation Standards

### Code Comments

**When to Comment**:

- Complex algorithms or business logic
- Non-obvious workarounds or hacks
- Important architectural decisions
- Security-sensitive code

**When NOT to Comment**:

- Self-explanatory code
- Redundant information from code
- Obvious variable/function names

**Example**:

```typescript
// GOOD - Explains non-obvious behavior
// Bitbucket Server API requires different authentication header format
const authHeader = isServer ? `Bearer ${token}` : `Basic ${Buffer.from(token).toString('base64')}`;

// BAD - States the obvious
// Set the user name
const userName = user.name;
```

### Markdown Documentation

All markdown MUST follow markdownlint rules (see [.markdownlint.json](.markdownlint.json)):

- 120-character line length
- ATX-style headers (`##` not underlined)
- Consistent list styles
- Fenced code blocks with language tags

## Security Standards

### Dependency Management

- All packages MUST be verified against compromised package list
- Use exact versions in `package.json`
- Run `pnpm audit` regularly
- Review dependency updates before merging

### Token Handling

- Store tokens in environment variables ONLY
- NEVER log tokens or include in error messages
- Use HTTPS-only for API communication
- No token transmission to MCP client

### Input Validation

- Validate all user inputs at API boundaries
- Sanitize data before API requests
- Type-check all external data

## Performance Standards

### Caching

- Cache static/rarely-changing data aggressively
- Use configurable TTLs based on data volatility
- Invalidate cache on write operations
- Log cache hit/miss ratios

### API Optimization

- Minimize API calls through batching
- Implement retry logic with exponential backoff
- Respect rate limits with inter-request delays
- Use streaming for large responses (future)

## References

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [OpenAPI Specification](https://swagger.io/specification/)
- [ESLint Rules](https://eslint.org/docs/rules/)
- [Prettier Options](https://prettier.io/docs/en/options.html)
- [Markdownlint Rules](https://github.com/DavidAnson/markdownlint/blob/main/doc/Rules.md)
- [OpenTelemetry](https://opentelemetry.io/)
