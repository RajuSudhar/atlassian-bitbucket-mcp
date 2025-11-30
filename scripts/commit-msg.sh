#!/usr/bin/env sh

# Commit message validation script
# Enforces Conventional Commits format

commit_msg_file=$1
commit_msg=$(cat "$commit_msg_file")

# Pattern for conventional commits
# Format: type(optional scope): description
conventional_pattern='^(feat|fix|docs|style|refactor|test|chore|ci|build|perf|revert)(\(.+\))?: .{1,}'

# Allow merge commits
if echo "$commit_msg" | grep -qE "^Merge "; then
  exit 0
fi

# Allow revert commits
if echo "$commit_msg" | grep -qE "^Revert "; then
  exit 0
fi

# Check if commit message follows conventional format
if ! echo "$commit_msg" | grep -qE "$conventional_pattern"; then
  echo ""
  echo "ERROR: Invalid commit message format!"
  echo ""
  echo "Commit message must follow Conventional Commits format:"
  echo "  <type>(<optional-scope>): <description>"
  echo ""
  echo "Examples:"
  echo "  feat: add user authentication"
  echo "  feat(api): add new endpoint for users"
  echo "  fix: resolve login bug"
  echo "  fix(auth): fix token expiration issue"
  echo "  docs: update README"
  echo "  chore: update dependencies"
  echo ""
  echo "Allowed types:"
  echo "  feat     - New feature"
  echo "  fix      - Bug fix"
  echo "  docs     - Documentation changes"
  echo "  style    - Code style changes (formatting, etc.)"
  echo "  refactor - Code refactoring"
  echo "  test     - Adding or updating tests"
  echo "  chore    - Maintenance tasks"
  echo "  ci       - CI/CD changes"
  echo "  build    - Build system changes"
  echo "  perf     - Performance improvements"
  echo "  revert   - Revert previous commit"
  echo ""
  echo "Your commit message:"
  echo "  $commit_msg"
  echo ""
  exit 1
fi

exit 0
