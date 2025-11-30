# Package Manager Support

This project supports both **npm** and **pnpm** to accommodate different developer preferences and workflows.

## Dual Lock File Strategy

We maintain both lock files to ensure cross-compatibility:

- [package-lock.json](package-lock.json) - For npm users
- [pnpm-lock.yaml](pnpm-lock.yaml) - For pnpm users (primary/recommended)

## Recommended: pnpm

While both package managers are supported, **pnpm is the primary and recommended package manager** for this project:

**Why pnpm?**

- Faster installation speeds
- Efficient disk usage (shared dependency store)
- Stricter dependency resolution
- Better monorepo support (for future expansion)
- More deterministic builds

## Using pnpm (Recommended)

### Installation

```bash
npm install -g pnpm
```

### Commands

```bash
# Install dependencies
pnpm install

# Add a package
pnpm add <package-name>

# Add a dev dependency
pnpm add -D <package-name>

# Update dependencies
pnpm update

# Run scripts
pnpm run build
pnpm run test
```

## Using npm

### Commands

```bash
# Install dependencies
npm install

# Add a package
npm install <package-name>

# Add a dev dependency
npm install --save-dev <package-name>

# Update dependencies
npm update

# Run scripts
npm run build
npm run test
```

## Keeping Lock Files in Sync

### Automatic Sync (Pre-commit)

When you modify [package.json](package.json), the pre-commit hook automatically:

1. Detects the change
2. Runs the lock file sync script
3. Updates both `package-lock.json` and `pnpm-lock.yaml`
4. Stages the updated lock files

### Manual Sync

If you need to manually sync the lock files:

```bash
pnpm run sync:locks
```

This script:

- Detects which lock file was modified most recently
- Uses that as the source of truth
- Regenerates the other lock file
- Ensures both files exist and are valid

## Workflow Guidelines

### For pnpm Users (Recommended)

1. Make changes to dependencies using pnpm
2. Commit your changes (pre-commit hook syncs automatically)
3. Both lock files are updated and committed together

### For npm Users

1. Make changes to dependencies using npm
2. Run `pnpm run sync:locks` to update `pnpm-lock.yaml`
3. Commit both lock files together

## Lock File Conflicts

### During Merges

If you encounter lock file conflicts during a merge:

#### Option 1: Use pnpm as source of truth

```bash
# Keep pnpm-lock.yaml from the merge
git checkout --theirs pnpm-lock.yaml

# Regenerate package-lock.json
rm package-lock.json
pnpm run sync:locks

# Commit the resolved files
git add package-lock.json pnpm-lock.yaml
git commit
```

#### Option 2: Use npm as source of truth

```bash
# Keep package-lock.json from the merge
git checkout --theirs package-lock.json

# Regenerate pnpm-lock.yaml
rm pnpm-lock.yaml
pnpm run sync:locks

# Commit the resolved files
git add package-lock.json pnpm-lock.yaml
git commit
```

#### Option 3: Regenerate both (safest)

```bash
# Remove both lock files
rm package-lock.json pnpm-lock.yaml

# Regenerate from package.json
pnpm install
pnpm run sync:locks

# Commit the new files
git add package-lock.json pnpm-lock.yaml
git commit
```

## Pull Request Requirements

When submitting a PR that modifies dependencies:

1. **Both lock files MUST be updated** and included in the PR
2. Lock files should be synced (use `pnpm run sync:locks`)
3. Pre-commit hooks should pass (validates lock file presence)

## Continuous Integration

Our CI/CD pipeline:

- Uses **pnpm** as the primary package manager
- Validates that both lock files exist
- Ensures dependencies can be installed with both package managers
- Runs tests with pnpm-installed dependencies

## Troubleshooting

### "Lock files out of sync" error

```bash
# Solution: Run the sync script
pnpm run sync:locks
```

### "package-lock.json missing" error

```bash
# Solution: Regenerate from pnpm
pnpm run sync:locks
```

### "pnpm-lock.yaml missing" error

```bash
# Solution: Regenerate from npm
pnpm install --lockfile-only
```

### Dependency resolution conflicts

If npm and pnpm resolve dependencies differently:

1. **Use pnpm as source of truth** (our primary package manager)
2. Run: `pnpm install` to regenerate `pnpm-lock.yaml`
3. Run: `pnpm run sync:locks` to update `package-lock.json`
4. Note: Some minor differences in lock files are expected (pnpm is more strict)

## Best Practices

1. **Use pnpm for development** - It's our primary package manager
2. **Always commit both lock files** - Never commit only one
3. **Run sync script after manual dependency changes** - Especially if using npm
4. **Don't manually edit lock files** - Let package managers handle them
5. **Use exact versions** - Avoid version ranges when possible for reproducibility

## Migration from npm-only

If you were previously using only npm:

```bash
# Install pnpm globally
npm install -g pnpm

# Generate pnpm-lock.yaml from existing package-lock.json
pnpm import

# Verify both lock files exist
ls -la package-lock.json pnpm-lock.yaml

# Test installation
pnpm install
```

## Future Considerations

As the project grows, we may:

- Transition to pnpm-only (remove package-lock.json)
- Implement workspace features for mono repo structure
- Add stricter dependency validation

For now, maintaining both lock files ensures maximum compatibility across development environments.

## References

- [pnpm Documentation](https://pnpm.io/)
- [npm Documentation](https://docs.npmjs.com/)
- [Lock File Format Comparison](https://pnpm.io/npmrc#lockfile-settings)
