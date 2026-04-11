# Branch Management System

This document describes the branch management system planned for this repository, including interactive
branch creation, Git aliases, and validation rules.

## Overview

The branch management system provides:

- **Validated branch names** following industry best practices
- **Interactive branch creation** with guided prompts
- **Git alias integration** for convenient workflow
- **Optional ticket ID support** for issue tracking integration

## Branch Naming Convention

### Format

Branches must follow one of these formats:

- `<type>/<description>` - Simple descriptive name
- `<type>/<TICKET-ID>-<description>` - With ticket/issue ID

### Valid Branch Types

| Type       | Description                  | Example                           |
| ---------- | ---------------------------- | --------------------------------- |
| `feature`  | New features                 | `feature/add-user-authentication` |
| `release`  | Release preparation          | `release/v1.0.0`                  |
| `fix`      | Bug fixes                    | `fix/memory-leak-in-cache`        |
| `doc`      | Documentation changes        | `doc/update-api-guide`            |
| `test`     | Test additions/modifications | `test/add-integration-tests`      |
| `chore`    | Maintenance tasks            | `chore/update-dependencies`       |
| `refactor` | Code refactoring             | `refactor/extract-api-client`     |
| `hotfix`   | Urgent production fixes      | `hotfix/security-patch`           |

### Removed Types

The following type aliases are **not allowed** and will be rejected with helpful error messages:

- `feat` → use `feature`
- `bugfix` → use `fix`
- `perf` → use `refactor` or `feature`

### Examples

**Good branch names:**

- `feature/JIRA-123-add-oauth-support`
- `fix/PROJ-456-memory-leak-in-cache`
- `doc/update-api-documentation`
- `refactor/extract-database-client`
- `hotfix/URGENT-789-security-patch`

**Bad branch names (will be rejected):**

- `feat/new-feature` - Use `feature` instead
- `fix/update` - Too vague, needs specific description
- `feature/change` - Too vague
- `bugfix/login-bug` - Use `fix` instead

## Interactive Branch Creation

### Using the Script

Run the interactive branch creator:

```bash
pnpm run branch:create
```

### User Flow

```text
Branch Creation Helper
======================

Select branch type:
  1. feature - New features
  2. release - Release preparation
  3. fix - Bug fixes
  4. doc - Documentation changes
  5. test - Test additions/modifications
  6. chore - Maintenance tasks
  7. refactor - Code refactoring
  8. hotfix - Urgent production fixes

Enter number (1-8): 1

Include issue/ticket ID? (y/N): y
Enter ticket ID (e.g., JIRA-123): PROJ-456

Enter branch description (kebab-case): add-user-authentication

Creating branch: feature/PROJ-456-add-user-authentication
Branch created and checked out successfully!
```

### Configuration

Control ticket ID prompts via environment variable:

```bash
# .env or shell environment
ENABLE_ISSUE_ID_PROMPT=false # Default: false (skip ticket ID prompt)
```

Set to `true` to always prompt for ticket IDs.

## Git Aliases

### Setup

Configure Git aliases once:

```bash
pnpm run setup:git-aliases
```

This creates two aliases:

- `git new-branch` - Launch interactive branch creator
- `git nb` - Shorthand version

### Usage

After setup, create branches using:

```bash
git new-branch
# or
git nb
```

### Note on Overriding Built-in Commands

We cannot override `git branch` or `git checkout -b` directly as Git doesn't allow alias overrides for
built-in commands. The `new-branch` and `nb` aliases provide convenient alternatives.

## Validation Rules

### Automatic Validation

Branch names are automatically validated:

- **Before commits** (via pre-commit hook)
- **Before pushes** (via pre-push hook)
- **During interactive creation** (validates before creating branch)

### Validation Checks

1. **Type validation** - Only 8 allowed types
2. **Format validation** - Proper `<type>/<description>` structure
3. **Vague term detection** - Rejects generic descriptions without context
4. **Minimum word count** - Descriptions must have sufficient detail
5. **Case validation** - Descriptions must be lowercase with hyphens (kebab-case)

### Protected Branches

These branches bypass validation:

- `main`
- `master`
- `develop`
- `development`

## Implementation Details

### Scripts

| Script                    | Purpose                          | Location                          |
| ------------------------- | -------------------------------- | --------------------------------- |
| `create-branch.sh`        | Interactive branch creation      | `scripts/create-branch.sh`        |
| `setup-git-aliases.sh`    | One-time Git alias configuration | `scripts/setup-git-aliases.sh`    |
| `validate-branch-name.sh` | Branch name validation logic     | `scripts/validate-branch-name.sh` |

### npm Scripts

| Command                      | Description                           |
| ---------------------------- | ------------------------------------- |
| `pnpm run branch:create`     | Launch interactive branch creator     |
| `pnpm run setup:git-aliases` | Configure Git aliases                 |
| `pnpm run validate:branch`   | Manually validate current branch name |

### Validation Script Features

- Detects old type aliases and suggests correct alternatives
- Provides clear error messages with examples
- Checks for vague terms like "fix", "update", "change" without context
- Validates ticket ID format when present
- Ensures descriptions are descriptive (minimum 3 words when no ticket ID)

## Industry Best Practices

This system enforces branch naming conventions based on industry best practices:

1. **Semantic Types** - Clear categorization of work type
2. **Ticket Traceability** - Optional issue tracking integration
3. **Descriptive Names** - Meaningful descriptions that explain WHAT, not just generic verbs
4. **Consistency** - Standardized format across team
5. **Automation** - Validation prevents mistakes before they reach remote

## Future Enhancements

Potential future improvements:

- Branch lifecycle management (auto-delete merged branches)
- Integration with project management tools (JIRA, GitHub Issues)
- Branch naming suggestions based on commit messages
- Team-specific customization of allowed types
- Branch template generation for common workflows

## Troubleshooting

### Common Issues

#### Error: "Invalid branch name format"

- Ensure you're using one of the 8 allowed types
- Check that description is lowercase with hyphens
- Avoid vague terms without specific context

#### Error: "Use 'feature' instead of 'feat'"

- The alias `feat` is not allowed, use the full word `feature`
- Same applies to `bugfix` (use `fix`) and `docs` (use `doc`)

#### Branch validation fails during commit

- Run `pnpm run validate:branch` to see specific error
- Use `pnpm run branch:create` to create a properly formatted branch
- Rename current branch with: `git branch -m <old-name> <new-name>`

## References

- [Conventional Commits](https://www.conventionalcommits.org/) - Similar convention for commit messages
- [Git Flow](https://nvie.com/posts/a-successful-git-branching-model/) - Branch management workflow
- [GitHub Flow](https://guides.github.com/introduction/flow/) - Simplified branching strategy
