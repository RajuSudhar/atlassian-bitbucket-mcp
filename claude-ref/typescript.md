# typescript

- `type` only. `interface` banned except class extend / declaration merging.
- Shared types in `types/` at repo root. Never redefine a type that exists there.
- Import: `import type { X } from '@types'` or `@types/<file>`.
- `export type * from './x'` for re-exports (type-only, zero runtime).
- No `any`. Use `unknown` + narrow. Validate external input at boundaries.
- Naming: PascalCase types, camelCase vars/fns, UPPER_SNAKE_CASE consts, kebab-case files.
- Boolean: `is*`, `has*`, `should*`.
- Descriptive names: `PullRequestState`, `CacheEntry`, `bitbucketClient` — never `State`, `Entry`, `client`.
- Import order (ESLint): node builtins → external → internal → parent/sibling → `import type` last. Alphabetical within groups.
- Prettier: single quotes, 2-space, 100-col code / 120-col md, semi, ES5 trailing commas.
- Strict mode: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
