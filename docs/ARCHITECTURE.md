# Architecture Documentation

## Overview

This document outlines the complete architecture, design decisions, and implementation approach for the
Atlassian Bitbucket MCP server.

## Technology Stack

### Language: TypeScript

**Decision**: TypeScript was chosen as the implementation language.

**Rationale**:

- Official MCP SDK support (`@modelcontextprotocol/sdk`)
- Excellent type safety with compile-time checking
- Native JSON handling for REST APIs
- Rich ecosystem for HTTP clients and async operations
- Optimal for I/O-bound operations (Bitbucket API calls)
- Fast development iteration
- Strong community support

**Alternatives Considered**:

- **Python**: Has official MCP SDK but slower for async I/O operations
- **Go/Rust**: No official MCP SDK, would require protocol implementation from scratch
- **Multi-language**: Adds complexity without performance benefits for I/O-bound workload

## System Architecture

### High-Level Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                    MCP Client (Claude)                       │
└────────────────────────┬────────────────────────────────────┘
                         │ MCP Protocol (stdio/HTTP)
                         │
┌────────────────────────▼────────────────────────────────────┐
│              Atlassian Bitbucket MCP Server                  │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │           MCP Server Core                          │     │
│  │  - Tool registration                               │     │
│  │  - Request routing                                 │     │
│  │  - Error handling                                  │     │
│  │  - Permission checking                             │     │
│  └────────────┬───────────────────────────────────────┘     │
│               │                                              │
│  ┌────────────▼───────────────────────────────────────┐     │
│  │           Caching Layer                            │     │
│  │  - In-memory cache                                 │     │
│  │  - TTL-based expiration                            │     │
│  │  - Cache invalidation                              │     │
│  └────────────┬───────────────────────────────────────┘     │
│               │                                              │
│  ┌────────────▼───────────────────────────────────────┐     │
│  │        Bitbucket API Client                        │     │
│  │  - Authentication (Personal Access Token)          │     │
│  │  - HTTP request handling                           │     │
│  │  - Rate limiting                                   │     │
│  │  - Retry logic                                     │     │
│  │  - API version handling (Cloud vs Server)          │     │
│  └────────────┬───────────────────────────────────────┘     │
│               │                                              │
└───────────────┼──────────────────────────────────────────────┘
                │ HTTPS + Personal Access Token
                │
┌───────────────▼──────────────────────────────────────────────┐
│          Bitbucket Instance                                   │
│  - Bitbucket Cloud (bitbucket.org)                           │
│  - Bitbucket Data Center/Server (self-hosted)                │
└──────────────────────────────────────────────────────────────┘
```

## Project Structure

```text
types/                    # Shared TypeScript type definitions
├── index.ts              # Type exports (re-exports from subdirectories)
├── bitbucket.ts          # Bitbucket API types
├── mcp.ts                # MCP-specific types
├── config.ts             # Configuration types
├── cache.ts              # Cache-related types
└── common.ts             # Common/utility types

src/                      # MCP server implementation
├── index.ts              # Entry point & MCP server initialization
├── server.ts             # MCP server setup and tool registration
├── config.ts             # Environment configuration & validation
├── cache.ts              # Caching layer implementation
├── logger.ts             # Centralized logging utility
│
├── tools/                # MCP tool implementations
│   ├── index.ts          # Tool exports
│   ├── pr-tools.ts       # Pull request operations
│   ├── repo-tools.ts     # Repository operations
│   └── search-tools.ts   # Code search operations
│
└── bitbucket/            # Bitbucket API integration
    ├── client.ts         # Main API client
    ├── auth.ts           # Authentication handling
    │
    └── api/              # API endpoint implementations
        ├── pull-requests.ts  # PR API calls
        ├── repositories.ts   # Repository API calls
        └── search.ts         # Search API calls

cli/                      # CLI implementation (future)
├── index.ts              # CLI entry point
└── commands/             # CLI commands

openapi/                  # OpenAPI specifications (future type generation)
├── bitbucket-cloud.yaml  # Bitbucket Cloud API spec
└── bitbucket-server.yaml # Bitbucket Server/DC API spec
```

**Directory Rationale**:

- **types/**: Shared at root level to be accessible by both `src/` and future `cli/`
- **src/**: MCP server implementation
- **cli/**: Future CLI tool (separate from MCP server)
- **openapi/**: OpenAPI specs maintained for future automated type generation

## Core Components

### 1. MCP Server Core

**Responsibilities**:

- Initialize MCP server with SDK
- Register all available tools
- Route incoming tool requests
- Handle errors and transform them to MCP format
- Check permissions for tool executions

**Key Technologies**:

- `@modelcontextprotocol/sdk` - Official MCP SDK
- TypeScript strict mode for type safety

### 2. Logging System

**Purpose**: Centralized logging for debugging, monitoring, and future observability integration

**Implementation**:

```typescript
// src/logger.ts - Centralized logging utility
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogContext = {
  operation?: string;
  toolName?: string;
  userId?: string;
  [key: string]: unknown;
};

function log(level: LogLevel, message: string, context?: LogContext): void;
```

**Usage at Critical Paths**:

- MCP server initialization/shutdown
- Tool execution start/end
- API requests/responses
- Cache hits/misses
- Authentication attempts
- Error occurrences
- Rate limit events

**Future Enhancement**:

- Integration with OpenTelemetry for distributed tracing
- Log aggregation to external services
- Structured logging with trace IDs

### 3. Caching Layer

**Purpose**: Reduce API calls for static/rarely-changing data

**Implementation**:

```typescript
// Note: Use TYPE definitions (not interfaces)
type CacheEntry<T> = {
  data: T;
  timestamp: number;
  ttl: number;
};

type CacheStore = Map<string, CacheEntry<unknown>>;

class Cache {
  private store: CacheStore;

  get<T>(key: string): T | null;
  set<T>(key: string, data: T, ttl: number): void;
  invalidate(pattern: string): void;
  clear(): void;
}
```

**Cached Resources**:

- Repository lists (TTL: 1 hour) - New repos rarely created
- Repository metadata (TTL: 30 minutes)
- User information (TTL: 1 hour)

**Cache Keys**: `${instanceUrl}:${resource}:${identifier}`

**Configuration**:

- `BITBUCKET_CACHE_ENABLED` - Enable/disable (default: true)
- `BITBUCKET_CACHE_TTL_*` - Per-resource TTL configuration

### 4. Bitbucket API Client

**Responsibilities**:

- Authenticate requests with Personal Access Token
- Handle both Bitbucket Cloud and Server/DC APIs
- Implement retry logic with exponential backoff
- Rate limiting to avoid API throttling
- Transform API responses to internal types

**Features**:

- Automatic API version detection (Cloud vs Server)
- Configurable timeout and retry settings
- Detailed error messages for troubleshooting
- Logging at all API interaction points

### 5. MCP Tools

**Categories**:

**Pull Request Tools** (11 tools):

- Read operations: list, get, diff, commits, activities
- Write operations: comment, reply, resolve, update, approve

**Repository Tools** (7 tools):

- Projects and repository listing
- Branch and commit browsing
- File content retrieval

**Code Search Tools** (2 tools):

- Code search across repositories
- Commit message search

**Permission Model**:

- Configured via `BITBUCKET_ALLOWED_ACTIONS`
- Enforced at MCP server level before API calls
- Actions: `read_pr`, `write_pr`, `manage_pr`, `search_code`, `read_repo`, `read_project`

## Configuration & Environment

### Required Configuration

- `BITBUCKET_URL` - Instance URL (Cloud or self-hosted)
- `BITBUCKET_TOKEN` - Personal Access Token
- `BITBUCKET_DEFAULT_PROJECT` - Default project key

### Optional Configuration

**Permissions**:

- `BITBUCKET_ALLOWED_ACTIONS` - Restrict tool capabilities

**Caching**:

- `BITBUCKET_CACHE_ENABLED` - Toggle caching
- `BITBUCKET_CACHE_TTL_*` - Cache TTL per resource type

**API Settings**:

- `BITBUCKET_API_VERSION` - API version (Cloud)
- `BITBUCKET_REQUEST_TIMEOUT` - HTTP timeout
- `BITBUCKET_MAX_RETRIES` - Retry attempts
- `BITBUCKET_RATE_LIMIT_DELAY` - Inter-request delay

## Authentication

### Personal Access Token

**Rationale for PAT-only**:

- Simpler for local NPX usage
- No OAuth redirect flow needed
- Sufficient for single-user MCP server
- Works with both Cloud and Server/DC

**Security**:

- Token stored in environment variables (never in code)
- Token passed as `Authorization: Bearer <token>` header
- No token logging or exposure in error messages

## Bitbucket Instance Support

### Bitbucket Cloud (bitbucket.org)

- REST API 2.0
- OAuth 2.0 and PAT support
- Rate limiting: 1000 requests/hour (varies by endpoint)

### Bitbucket Server/Data Center (Self-hosted)

- REST API 1.0 and 2.0
- PAT authentication
- Rate limiting: Configured by administrator

### Handling Differences

**API Version Detection**:

- Cloud: Check for `api.bitbucket.org` domain
- Server: Check for version endpoint

**API Endpoint Differences**:

- Maintained in API client with conditional logic
- Type definitions shared where possible
- Server-specific features marked clearly

## Performance Considerations

### I/O-Bound Workload

- Bitbucket API calls dominate execution time
- Network latency >> computation time
- Node.js async I/O optimal for this pattern

### Caching Strategy

- Aggressive caching for static data
- Configurable TTLs based on data volatility
- Manual invalidation support for write operations

### Rate Limiting

- Respect Bitbucket API rate limits
- Configurable delay between requests
- Exponential backoff on rate limit errors

## Error Handling

### Error Categories

1. **Authentication Errors** (401/403)
   - Invalid or expired token
   - Insufficient permissions

2. **Not Found Errors** (404)
   - Project/repository/PR doesn't exist
   - User doesn't have access

3. **Rate Limit Errors** (429)
   - Too many requests
   - Retry with backoff

4. **Server Errors** (5xx)
   - Bitbucket service issues
   - Retry with backoff

5. **Network Errors**
   - Timeout
   - Connection refused
   - DNS failure

### Error Transformation

All errors transformed to MCP-compatible format:

```typescript
{
  error: {
    code: string;      // Error category
    message: string;   // Human-readable message
    details?: any;     // Additional context
  }
}
```

## Testing Strategy

### Unit Tests

- Each tool function
- Cache implementation
- API client methods
- Type transformations

### Integration Tests

- Mock Bitbucket API responses
- End-to-end tool execution
- Error scenario coverage

### Security Tests

- Dependency vulnerability scanning
- Token handling verification
- Permission enforcement

## Deployment Model

### Primary: Local NPX

```bash
npx -y atlassian-bitbucket-mcp
```

**Benefits**:

- No installation required
- Always latest version
- Environment-based configuration

### Alternative: npm install

```bash
npm install -g atlassian-bitbucket-mcp
```

### Future: Remote Server

- HTTP/HTTPS transport instead of stdio
- Multi-user support
- Token management service

## Security Architecture

### Dependency Management

- All packages verified against compromised package list
- Automated security audits (`npm audit`)
- Exact version pinning in package.json
- Regular dependency updates with review

### Token Security

- Environment variable storage only
- Never logged or exposed in errors
- HTTPS-only communication with Bitbucket
- No token transmission to MCP client

### Permission Model

- Configurable action restrictions
- Enforced before API calls
- Auditable via configuration
- Default: all actions allowed (trust local user)

## Future Enhancements

### Planned Features

1. **Webhook Support** - Build status integration
2. **Pipeline Triggers** - CI/CD automation
3. **Advanced Search** - Lucene query support
4. **Bulk Operations** - Multi-PR operations
5. **Remote Server Mode** - Multi-user support

### Performance Optimizations

1. **Persistent Cache** - Redis/file-based caching
2. **Request Batching** - Combine multiple API calls
3. **Streaming Responses** - Large diff handling
4. **Connection Pooling** - HTTP keep-alive

### Enhanced Features

1. **OAuth 2.0** - Alternative to PAT
2. **SSO Integration** - Enterprise authentication
3. **Audit Logging** - Track all operations
4. **Metrics & Monitoring** - Observability

## Design Decisions Summary

| Decision         | Choice                | Rationale                                      |
| ---------------- | --------------------- | ---------------------------------------------- |
| Language         | TypeScript            | Official MCP SDK, type safety, I/O performance |
| Authentication   | Personal Access Token | Simplicity for local use                       |
| Caching          | In-memory with TTL    | Static data optimization                       |
| API Client       | axios                 | Mature, well-tested, feature-rich              |
| Testing          | Jest                  | TypeScript support, ecosystem standard         |
| Deployment       | NPX-based             | Zero-install, always latest                    |
| Instance Support | Cloud + Server/DC     | Maximum compatibility                          |

## Coding Standards

### TypeScript Type Definitions

**CRITICAL REQUIREMENT**: Always use `type` (NOT `interface`) for structure definitions.

**Rationale**:

- Consistent codebase style
- Better composition with union and intersection types
- More flexible for future refactoring

**Examples**:

```typescript
// CORRECT - Use type
type User = {
  id: string;
  name: string;
  email: string;
};

type ApiResponse<T> = {
  data: T;
  status: number;
  timestamp: number;
};

// INCORRECT - Do not use interface
interface User {
  // ❌ NEVER USE INTERFACE
  id: string;
  name: string;
}
```

**Exception**: Only use `interface` when extending classes or for declaration merging (rare cases).

### Type Organization

**Location**: All shared types must be in `types/` directory at project root.

**Structure**:

```typescript
// types/index.ts - Re-export all types
export type * from './bitbucket';
export type * from './mcp';
export type * from './config';
export type * from './cache';
export type * from './common';

// types/bitbucket.ts - Bitbucket-specific types
export type BitbucketRepository = {
  // ...
};

export type PullRequest = {
  // ...
};
```

**Import Usage**:

```typescript
// From src/ or cli/
import type { BitbucketRepository, PullRequest } from '../types';
// or
import type { BitbucketRepository, PullRequest } from '../../types';
```

### Logging Standards

**CRITICAL REQUIREMENT**: Use centralized logger function at all critical paths.

**Implementation**:

```typescript
// src/logger.ts
import type { LogLevel, LogContext } from '../types';

export function log(level: LogLevel, message: string, context?: LogContext): void {
  // Current: Console logging with structured format
  // Future: OpenTelemetry integration with trace IDs
  const timestamp = new Date().toISOString();
  const contextStr = context ? JSON.stringify(context) : '';
  console.log(`[${timestamp}] [${level.toUpperCase()}] ${message} ${contextStr}`);
}
```

**Usage Examples**:

```typescript
import { log } from './logger';

// Tool execution
log('info', 'Executing tool', { toolName: 'bitbucket_get_pr', prId: '123' });

// API calls
log('debug', 'Calling Bitbucket API', { endpoint: '/pull-requests', method: 'GET' });

// Errors
log('error', 'API request failed', { error: err.message, statusCode: 500 });

// Cache operations
log('debug', 'Cache hit', { key: 'bitbucket:repos:PROJECT' });
```

**Critical Paths Requiring Logging**:

1. MCP server initialization/shutdown
2. Tool execution start/end
3. All Bitbucket API requests/responses
4. Authentication attempts (success/failure)
5. Cache operations (hit/miss/invalidation)
6. Error occurrences
7. Rate limit events
8. Configuration loading

### OpenAPI Specification Maintenance

**CRITICAL REQUIREMENT**: Maintain up-to-date OpenAPI YAML files for future type generation.

**Current Approach**:

- Manual type definitions in `types/` directory
- Keep `openapi/*.yaml` files updated alongside type changes
- YAML files serve as documentation and future migration path

**Future Approach**:

- Automated type generation from OpenAPI specs
- Single source of truth (YAML → TypeScript types)
- Tooling: `openapi-typescript` or similar

**Files to Maintain**:

```text
openapi/
├── bitbucket-cloud.yaml      # Bitbucket Cloud REST API 2.0 spec
└── bitbucket-server.yaml     # Bitbucket Server/DC REST API spec
```

**Update Workflow**:

1. Define types manually in `types/` directory
2. Update corresponding OpenAPI YAML with same structure
3. Validate YAML with OpenAPI validator
4. Commit both TypeScript types and YAML together

**Example OpenAPI Entry**:

```yaml
# openapi/bitbucket-cloud.yaml
components:
  schemas:
    PullRequest:
      type: object
      required:
        - id
        - title
        - state
      properties:
        id:
          type: integer
        title:
          type: string
        state:
          type: string
          enum: [OPEN, MERGED, DECLINED]
```

Corresponding TypeScript type:

```typescript
// types/bitbucket.ts
export type PullRequest = {
  id: number;
  title: string;
  state: 'OPEN' | 'MERGED' | 'DECLINED';
};
```

### Code Style Enforcement

**Automated Tools**:

- Prettier: Code formatting
- ESLint: Import ordering, unused imports, type imports
- TypeScript: Strict type checking
- Markdownlint: Documentation consistency

**Pre-commit Validation**:

- Branch name validation
- Code formatting
- Linting (code + markdown)
- Type checking
- Build verification

**Standards**:

- No emojis in any code, scripts, or output
- Single quotes for strings
- 2-space indentation
- 100-character line length (code)
- 120-character line length (markdown)
- Alphabetically sorted imports within groups

## References

- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [Bitbucket Cloud REST API](https://developer.atlassian.com/cloud/bitbucket/rest/)
- [Bitbucket Server REST API](https://docs.atlassian.com/bitbucket-server/rest/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [OpenAPI Specification](https://swagger.io/specification/)
- [OpenTelemetry](https://opentelemetry.io/)
