# Phase 0: Foundation

## Objective

Install all dependencies, scaffold the directory structure, configure Vitest for ESM, and establish npm scripts that the remaining phases build upon.

## Scope

### In Scope
- Install production and dev dependencies
- Create all directories for the target structure
- Configure Vitest with TypeScript ESM support
- Update `tsconfig.json` for path aliases and generated output
- Add npm scripts: `test`, `test:unit`, `test:tools`, `generate`, `generate:check`
- Create placeholder/stub files where needed

### Out of Scope
- Any actual implementation code
- Tool definitions or test cases
- Code generation logic

## Step 1: Install Dependencies

Run from project root:

```bash
npm install @modelcontextprotocol/sdk@^1.18.1 zod zod-to-json-schema yaml ajv

npm install -D typescript@^5.8.0 vitest@^3.1.0 json-schema-to-zod@^2.4.0 msw@^2.7.0 @types/node@^20.0.0
```

**CRITICAL**: The project currently has no `typescript` devDependency. It must be added here.

After installation, verify `package.json` contains all packages:

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.18.1",
    "zod": "^3.24.0",
    "zod-to-json-schema": "^3.24.0",
    "yaml": "^2.7.0",
    "ajv": "^8.17.0"
  },
  "devDependencies": {
    "typescript": "^5.8.0",
    "vitest": "^3.1.0",
    "json-schema-to-zod": "^2.4.0",
    "msw": "^2.7.0",
    "@types/node": "^20.0.0",
    "husky": "^9.1.7"
  }
}
```

## Step 2: Create Directory Structure

```bash
mkdir -p src/tools/definitions
mkdir -p src/tools/schemas
mkdir -p src/generated
mkdir -p src/handlers
mkdir -p src/lib
mkdir -p src/bitbucket
mkdir -p tests/tools
mkdir -p tests/fixtures
mkdir -p tests/unit
mkdir -p tests/helpers
mkdir -p scripts
```

Create `.gitkeep` files for empty directories that must be tracked:

```bash
touch src/generated/.gitkeep
touch tests/fixtures/.gitkeep
```

## Step 3: Configure Vitest

Create `vitest.config.ts` at project root:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'tests/**/*.test.ts',
    ],
    exclude: [
      'node_modules',
      'dist',
    ],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      exclude: ['src/generated/**', 'src/**/*.d.ts'],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    setupFiles: [],
    alias: {
      '@/': new URL('./src/', import.meta.url).pathname,
      '@lib/': new URL('./src/lib/', import.meta.url).pathname,
      '@generated/': new URL('./src/generated/', import.meta.url).pathname,
    },
  },
});
```

**IMPORTANT**: The `globals: true` setting allows `describe`, `it`, `expect` without imports. This is a project-wide convention decision.

## Step 4: Update tsconfig.json

The existing `tsconfig.json` needs path aliases and inclusion of test files for type checking. Create a base config and a test-specific one.

Update `tsconfig.json` (the existing file):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@/*": ["./src/*"],
      "@lib/*": ["./src/lib/*"],
      "@generated/*": ["./src/generated/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Changes from existing**:
- `moduleResolution`: changed from `"node"` to `"bundler"` (required for ESM path resolution with TypeScript 5.x)
- Added `paths` for import aliases

Create `tsconfig.test.json` for test type checking:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": ".",
    "noUnusedLocals": false,
    "noUnusedParameters": false
  },
  "include": ["src/**/*", "tests/**/*", "scripts/**/*", "vitest.config.ts"]
}
```

## Step 5: Update package.json Scripts

Replace the scripts section in `package.json`:

```json
{
  "scripts": {
    "build": "tsc",
    "watch": "tsc --watch",
    "prepare": "husky",
    "generate": "npx tsx scripts/generate.ts",
    "generate:check": "npx tsx scripts/generate.ts --check",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:unit": "vitest run tests/unit/",
    "test:tools": "vitest run tests/runner.test.ts",
    "test:coverage": "vitest run --coverage",
    "typecheck": "tsc --noEmit",
    "typecheck:test": "tsc --noEmit -p tsconfig.test.json"
  }
}
```

**IMPORTANT**: `tsx` is used to run TypeScript scripts directly. It ships with modern Node.js via `npx tsx` and does not need a separate install. If issues arise, add `tsx` as a devDependency.

## Step 6: Create Stub Files

### `scripts/generate.ts`

```typescript
#!/usr/bin/env npx tsx

console.log('Code generation not yet implemented. See Phase 3.');
process.exit(0);
```

### `src/generated/.gitkeep`

Empty file. Will be replaced by generated files in Phase 3.

## Step 7: Verify Setup

Run these commands to confirm the foundation is correct:

```bash
# TypeScript compiles without errors
npx tsc --noEmit

# Vitest discovers test files (should find 0 tests)
npx vitest run --reporter=verbose 2>&1 | head -20

# Generate script runs without error
npm run generate

# All dependencies resolve
node -e "import('@modelcontextprotocol/sdk').then(() => console.log('MCP SDK OK'))"
node -e "import('zod').then(() => console.log('Zod OK'))"
node -e "import('yaml').then(() => console.log('YAML OK'))"
node -e "import('ajv').then(() => console.log('AJV OK'))"
```

## Files Created

| File | Purpose |
|------|---------|
| `vitest.config.ts` | Vitest configuration with ESM, aliases, coverage |
| `tsconfig.test.json` | Test-inclusive TypeScript config |
| `scripts/generate.ts` | Stub for code generation script |
| `src/generated/.gitkeep` | Placeholder for generated output directory |
| `src/tools/definitions/` | Directory for YAML tool definitions |
| `src/tools/schemas/` | Directory for shared schema fragments |
| `src/handlers/` | Directory for handler implementations |
| `src/lib/` | Directory for extractable SDK |
| `src/bitbucket/` | Directory for API client |
| `tests/tools/` | Directory for YAML test cases |
| `tests/fixtures/` | Directory for shared test data |
| `tests/unit/` | Directory for unit tests |
| `tests/helpers/` | Directory for test utilities |

## Files Modified

| File | Changes |
|------|---------|
| `package.json` | Added dependencies, devDependencies, scripts |
| `tsconfig.json` | Changed `moduleResolution` to `bundler`, added `paths` |

## Commit

```
feat: scaffold project foundation with vitest and dependencies

- Install MCP SDK, Zod, YAML, AJV, MSW, Vitest
- Configure Vitest for ESM with path aliases
- Add tsconfig path aliases and test config
- Create directory structure for tools, lib, generated, tests
- Add npm scripts for generate, test, typecheck
```
