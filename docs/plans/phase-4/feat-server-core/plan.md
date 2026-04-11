# feat-server-core

Phase: 4  |  Status: [x] done
Depends on: feat-client-core, feat-cache
Ref: `claude-ref/tools.md`, `claude-ref/logger.md`

## Goal
Boot the MCP server, register tools, route requests, transform errors.

## In scope
- `src/index.ts` entry — load config, init logger, init client, init server.
- `src/server.ts` — `@modelcontextprotocol/sdk` server wiring, tool registration from `src/tools/index.ts`.
- stdio transport.
- Graceful shutdown on SIGINT/SIGTERM.

## Out of scope
- HTTP transport (future).
- Multi-user auth.

## Design
- `bootstrap(): Promise<void>` composes everything and starts the server.
- Tool registry pattern: each `*-tools.ts` exports `Tool[]` consumed by `server.ts`.
- Uncaught errors at SDK boundary → MCP error format via shared transformer.

## Tasks
- [x] wire SDK server
- [x] tool registry
- [x] lifecycle logs (start, ready, shutdown)
- [x] SIGINT/SIGTERM handlers
- [ ] tests: bootstrap runs to "ready", shutdown is clean

## Definition of done
- [x] `pnpm run build && node dist/index.js` boots against a mock client
- [x] TRACK.md updated
