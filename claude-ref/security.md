# security

## Dependencies

- BEFORE `pnpm add <pkg>`: run `./scripts/check-package-security.sh <pkg>`.
- Cross-check against Shai Hulud 2.0 IoC list.
- Pin exact versions (no `^`, no `~`).
- Minimal footprint — justify every new dep in the PR.
- `pnpm audit` on every dep change. Block on high/critical.

## Tokens

- `BITBUCKET_TOKEN` read only in `src/config.ts`. No direct `process.env` elsewhere.
- Never log, never include in error messages, URLs, or MCP responses.
- HTTPS only. Reject `http://` URLs at config load.
- No token persistence to disk or cache.

## Input validation

- Validate ALL external input at API boundaries (tool entry, client response) before it reaches cache, logs, or downstream calls.
- Narrow `unknown` → concrete `type`. No `as` casts without a runtime check.

## Env

- No secrets in `.env.example`. Placeholders only.
- Never commit `.env`.
