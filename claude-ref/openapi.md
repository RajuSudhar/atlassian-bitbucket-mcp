# openapi ↔ types

## Files

- `openapi/bitbucket-cloud.yaml` — Bitbucket Cloud REST 2.0
- `openapi/bitbucket-server.yaml` — Bitbucket Server/DC REST 1.0/2.0

## Rule

Any change to `types/bitbucket.ts` MUST land in the same commit as the matching YAML schema update. CI fails otherwise.

## Generation (target state — see phase-1/feat-openapi-codegen)

- Tool: `openapi-typescript` (pinned exact version, security-checked).
- Command: `pnpm run types:gen`.
- Output: `types/generated/bitbucket-cloud.d.ts`, `types/generated/bitbucket-server.d.ts`.
- `types/bitbucket.ts` re-exports curated subset as `type` aliases (never `interface`).
- Generated files are committed (deterministic). Pre-commit hook runs `types:gen` on YAML change and fails if drift.

## Transition (until codegen is in place)

- Hand-write types in `types/bitbucket.ts`.
- Every change: update YAML in same commit. Validate with `pnpm run openapi:lint`.

## Curation rules

- Only expose types the tools consume. Don't re-export the whole generated tree.
- Replace `string` enums from YAML with TS string unions.
- Convert `number` → `number & { __brand }` only when ambiguity exists (e.g. IDs).
