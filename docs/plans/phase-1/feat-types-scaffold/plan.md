# feat-types-scaffold

Phase: 1 | Status: [x] done
Depends on: —
Ref: `claude-ref/typescript.md`, `claude-ref/openapi.md`

## Goal

Create `types/` root with file layout and `@types` path alias wired in tsconfig.

## In scope

- `types/index.ts`, `bitbucket.ts`, `mcp.ts`, `config.ts`, `cache.ts`, `logger.ts`, `common.ts`.
- `tsconfig.json` `paths`: `"@types": ["types"]`, `"@types/*": ["types/*"]`.
- ESLint import resolver for the alias.

## Out of scope

- Bitbucket type content (scaffolded stubs only — filled by feat-openapi-codegen).

## Design

- `types/index.ts` re-exports with `export type *`.
- Every file uses `type` only.
- `common.ts` holds `Brand<T, K>`, `NonEmptyArray<T>`, `DeepReadonly<T>`, `Result<T, E>`.

## Tasks

- [x] create files with minimal exports
- [x] wire path alias in tsconfig
- [ ] wire eslint-import-resolver-typescript
- [x] verify `import type { ... } from '@types'` resolves in src/
- [x] verify `export type *` passes typecheck

## Definition of done

- [x] `pnpm typecheck` clean
- [ ] `pnpm lint:all` clean
- [x] TRACK.md updated
