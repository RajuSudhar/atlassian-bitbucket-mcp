# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0-beta.0] - 2026-09-01

### Added

- Batched PR reviews (Bitbucket's _Start review_ / _Finish review_) on
  Server/DC 7.7+: a `pending` flag on `bitbucket_add_pr_comment`,
  `bitbucket_add_pr_inline_comment`, `bitbucket_reply_to_comment` and
  `bitbucket_create_pr_task` queues feedback as `PENDING` instead of posting it,
  plus `bitbucket_start_pr_review`, `bitbucket_get_pr_review`,
  `bitbucket_publish_pr_review` and `bitbucket_discard_pr_review` to inspect,
  publish, or drop the session. `pending` defaults to `false`, so existing
  behaviour is unchanged.

- Streamable HTTP transport (`MCP_TRANSPORT=http`, `src/http.ts`) so the server
  can run as a long-lived local service and be registered as a Claude HTTP MCP
  at `http://127.0.0.1:3900/mcp`. Loopback bind, `GET /health` probe, stateful
  sessions. `MCP_HTTP_PORT` / `MCP_HTTP_HOST` configurable; stdio remains default.
- HTTPS transport (`MCP_TRANSPORT=https`): the HTTP transport served over TLS
  using `MCP_HTTP_TLS_CERT_FILE` / `MCP_HTTP_TLS_KEY_FILE` (paths to PEM files,
  e.g. generated with mkcert; both required in `https` mode, ignored otherwise).
  Same endpoint, sessions, body cap and `/health` probe as `http` mode. TLS adds
  encryption, not auth — keep the bind host on loopback.
- Programmatic CI helper via the `atlassian-bitbucket-mcp/helper` subpath
  export: `createBitbucketHelper()` returns the typed API layer grouped by
  resource (`pullRequests`, `repositories`, `search`, all methods pre-bound)
  plus the raw `client` and resolved `config`. Explicit options override the
  `BITBUCKET_*` env vars; caching is forced off; no permission/scope gating
  (the caller holds the token). Error classes and Bitbucket types are
  re-exported from the same subpath.
- `scripts/install-macos-service.sh` — installs a launchd LaunchAgent that runs
  the HTTP transport at login, with secrets in a chmod-600 env-file.
- Configurable project/repository allow-lists via `BITBUCKET_ALLOWED_PROJECTS`
  and `BITBUCKET_ALLOWED_REPOS`. Empty/unset means all allowed; entries are
  case-insensitive and repos may be `project/repo` or a bare `repo` slug.
- `requireScope()` enforcement wired into every project/repo-scoped tool,
  alongside the existing `requirePermission()` action gate.
- `diffType` parameter on `bitbucket_add_pr_inline_comment` (defaults to
  `EFFECTIVE`) so per-file/per-line comments anchor on the PR's overall diff on
  Bitbucket Server/DC.
- Unit test suite (Node built-in test runner) covering config parsing,
  permission + scope enforcement, cache, and logger redaction.
- GitHub Actions CI: lint, typecheck, OpenAPI→types drift, build, test on
  Node 20 and 22, plus a dependency audit job.
- `CHANGELOG.md` (this file) and npm publish metadata
  (`prepublishOnly`, `files` whitelist, `publishConfig.access: public`).

### Changed

- Removed the `postinstall` build step so consumers installing the published
  package (e.g. via `npx`) receive the prebuilt `dist/` rather than attempting
  to compile without dev dependencies.

### Notes

- Ports the per-tool output-token-limit governor from the sibling
  plane-mcp project. See `docs/plans/phase-7/feat-output-token-limits/`.

## [0.1.0] - 2026-04-25

### Added

- Initial MCP server: Bitbucket Cloud + Server/DC client with retry,
  rate-limit handling, flavor detection, and PAT auth.
- 19 MCP tools across pull requests, repositories, and search.
- In-memory TTL cache, structured redacting logger, action-based permissions.
- OpenAPI YAML as the source of truth for generated Bitbucket types.
