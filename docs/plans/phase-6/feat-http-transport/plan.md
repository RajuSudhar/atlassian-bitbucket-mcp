# feat-http-transport

Phase: 6 | Status: [ ] in progress
Depends on: feat-project-repo-scoping (phase 6)
Ref: `claude-ref/typescript.md`, `claude-ref/logger.md`, `claude-ref/security.md`

## Goal

Let the MCP server run as a long-lived local service instead of a per-session
stdio child: a Streamable HTTP transport (registerable as a Claude HTTP MCP),
plus an HTTPS variant using a locally-generated certificate (e.g. mkcert) so
local clients that require TLS can connect. stdio remains the default and is
unchanged.

## In scope

- `MCP_TRANSPORT` env var (`stdio` | `http` | `https`, default `stdio`) with
  `MCP_HTTP_PORT` (default 3900) and `MCP_HTTP_HOST` (default `127.0.0.1`),
  parsed in `src/config.ts`.
- `types/config.ts` — `TransportMode`, `TransportConfig`, `TlsConfig`.
- `src/http.ts` — Streamable HTTP transport on node:http: `/mcp` endpoint,
  stateful `mcp-session-id` sessions (one MCP server instance per session),
  `/health` probe, 4 MiB request-body cap, JSON-RPC error envelopes.
- HTTPS mode: `MCP_HTTP_TLS_CERT_FILE` / `MCP_HTTP_TLS_KEY_FILE` env vars
  (paths to PEM files, both required when mode is `https`), cert/key read via
  `readFileSync` at startup (fail fast if unreadable), server created with
  node:https `createServer({ cert, key }, handler)`. Everything else —
  sessions, `/health`, body limits — identical to http mode.
- `src/index.ts` routes any non-stdio mode to `startHttpTransport`.

## Out of scope

- Any authentication on the HTTP(S) endpoint — it stays unauthenticated, so
  the bind host must stay on loopback unless the user knows what they are
  doing (the Bitbucket token lives behind it).
- Certificate generation/renewal tooling (users bring their own, e.g. mkcert).
- Non-loopback deployment hardening (reverse proxies, mTLS, rate limiting).

## Design

- Stateful sessions per the MCP Streamable HTTP spec: an `initialize` POST
  mints a session id (returned in the `mcp-session-id` header) and connects a
  fresh `createServer()` instance to a `StreamableHTTPServerTransport`; later
  POST/GET/DELETE requests route by that header. Transports are removed from
  the map on close.
- https is a distinct `TransportMode` rather than a boolean flag, so config
  validation can require the TLS file pair only in that mode; `Config` carries
  `transport.tls` only when mode is `https`.
- `loadConfig()` throws a clear error if `MCP_TRANSPORT=https` is set without
  both TLS file paths — misconfiguration fails at startup, not first request.
- `configSummary()` may include TLS file paths (not secrets); key file
  contents are never read outside `src/http.ts` and never logged.
- `/health` reports the actual transport mode (`http` or `https`) plus the
  live session count, for service supervisors and smoke tests.

## Tasks

- [x] `TransportMode`/`TransportConfig` + `MCP_TRANSPORT`, `MCP_HTTP_PORT`,
      `MCP_HTTP_HOST` in `types/config.ts` / `src/config.ts`
- [x] `src/http.ts` — streamable HTTP transport, sessions, `/health`, body cap
- [x] `src/index.ts` — transport selection at bootstrap
- [x] `TlsConfig` + `MCP_HTTP_TLS_CERT_FILE`/`_KEY_FILE` with https-mode
      validation in `src/config.ts`
- [x] https branch in `src/http.ts` (node:https, fail-fast cert/key read)
- [x] `test/config.test.mjs` — https mode without cert/key fails; with both
      set, `transport.tls` is populated; http mode ignores TLS vars
- [x] `.env.example` — transport + TLS documentation
- [ ] `README.md` / `TRACK.md` — transport documentation (later agent)

## Definition of done

- [ ] `MCP_TRANSPORT=http` and `=https` both serve `/mcp` + `/health`;
      stdio default unchanged
- [ ] typecheck + lint + tests pass
- [ ] TRACK.md updated
