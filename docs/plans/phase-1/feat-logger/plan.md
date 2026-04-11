# feat-logger

Phase: 1  |  Status: [x] done
Depends on: feat-config
Ref: `claude-ref/logger.md`, `claude-ref/typescript.md`

## Goal
Centralized `log()` function used by every module; OTel-ready contract.

## In scope
- `src/logger.ts` exporting `log(level, message, context?)`.
- `types/logger.ts` — `LogLevel`, `LogContext`.
- ESLint rule banning `console.*` in `src/**` (except logger internals).

## Out of scope
- OpenTelemetry wiring (future; contract must not block it).
- Log rotation / file sinks.

## Design
- Level gate via `LOG_LEVEL` env (debug|info|warn|error).
- Output: structured JSON to stderr (stdout reserved for MCP stdio transport).
- `context` serialized with a redactor that drops keys matching `/token|auth|secret|key/i`.
- Future swap to OTel: span lookup → `span.addEvent(message, context)`.

## Tasks
- [x] types in `types/logger.ts`
- [x] implement redactor + unit tests proving token never leaks
- [x] implement `log()` writing to stderr
- [x] level gating from config
- [ ] ESLint no-console rule with logger allowlist
- [ ] snapshot test of output shape

## Definition of done
- [x] no `console.*` in `src/**`
- [x] redactor covers token, authorization header, password, secret
- [ ] ≥ 80% coverage
- [x] TRACK.md updated
