#!/usr/bin/env sh

# Branch Name Validation Script
# Enforces meaningful branch names based on industry best practices

current_branch=$(git symbolic-ref --short HEAD 2> /dev/null || echo "")

if [ -z "$current_branch" ]; then
  echo "ERROR: Not on a branch (detached HEAD state)"
  exit 1
fi

# Protected branches - always allowed
if echo "$current_branch" | grep -qE "^(main|master|develop|development)$"; then
  exit 0
fi

# Pattern for valid branch names
# Format: <type>/<ticket-id>-<description>
# Examples:
#   feature/JIRA-123-user-authentication
#   fix/PROJ-456-memory-leak-fix
#   hotfix/URGENT-789-security-patch
valid_pattern='^(feature|fix|hotfix|release|chore|docs|test|refactor)/[A-Z]+-[0-9]+-[a-z0-9-]+$'

# Alternative pattern without ticket ID (less preferred)
# Format: <type>/<description>
# Must have at least 3 words (separated by hyphens)
alt_pattern='^(feature|fix|hotfix|release|chore|docs|test|refactor)/[a-z][a-z0-9-]*-[a-z0-9-]*-[a-z0-9-]+$'

# Check if branch name is valid
if echo "$current_branch" | grep -qE "$valid_pattern"; then
  # Check for vague descriptions
  description=$(echo "$current_branch" | sed 's/^[^\/]*\/[A-Z]*-[0-9]*-//')

  # List of vague/generic terms that should not be used alone
  vague_terms="^(fix|update|change|modify|refactor|improve|enhance|work|stuff|things|misc|temp|test|wip)$"

  if echo "$description" | grep -qE "$vague_terms"; then
    echo ""
    echo "ERROR: Branch name is too vague: $current_branch"
    echo ""
    echo "The description '$description' is too generic."
    echo "Please use a more descriptive branch name that explains WHAT you're fixing/updating."
    echo ""
    echo "Examples of GOOD branch names:"
    echo "  fix/JIRA-123-memory-leak-in-cache-layer"
    echo "  feature/PROJ-456-add-oauth-authentication"
    echo "  bugfix/ISSUE-789-null-pointer-in-user-service"
    echo ""
    echo "Examples of BAD branch names:"
    echo "  fix/JIRA-123-fix"
    echo "  feature/PROJ-456-update"
    echo "  bugfix/ISSUE-789-change"
    echo ""
    exit 1
  fi

  exit 0
elif echo "$current_branch" | grep -qE "$alt_pattern"; then
  # Alternative pattern matched - check for vague descriptions
  description=$(echo "$current_branch" | sed 's/^[^\/]*\///')

  # Count words (separated by hyphens)
  word_count=$(echo "$description" | tr '-' '\n' | wc -l)

  if [ "$word_count" -lt 3 ]; then
    echo ""
    echo "ERROR: Branch name is too short: $current_branch"
    echo ""
    echo "Branch names should be descriptive and contain at least 3 words."
    echo "Format: <type>/<meaningful-description-with-context>"
    echo ""
    echo "Examples:"
    echo "  feature/add-user-authentication-flow"
    echo "  fix/resolve-memory-leak-in-cache"
    echo "  refactor/extract-api-client-logic"
    echo ""
    exit 1
  fi

  # Check for vague single words
  vague_patterns="(fix|update|change|modify|refactor|improve|enhance|work|stuff|things|misc|temp|test|wip)-"

  if echo "$description" | grep -qE "^$vague_patterns"; then
    echo ""
    echo "ERROR: Branch name starts with vague term: $current_branch"
    echo ""
    echo "Avoid starting branch names with generic verbs like 'fix', 'update', 'change'."
    echo "Instead, describe WHAT you're doing."
    echo ""
    echo "Examples of GOOD branch names:"
    echo "  fix/memory-leak-in-cache-layer"
    echo "  feature/oauth-authentication-flow"
    echo "  refactor/extract-database-client"
    echo ""
    echo "Examples of BAD branch names:"
    echo "  fix/update-code"
    echo "  feature/add-feature"
    echo "  refactor/improve-performance"
    echo ""
    exit 1
  fi

  exit 0
else
  echo ""
  echo "ERROR: Invalid branch name format: $current_branch"
  echo ""
  echo "Branch names must follow one of these formats:"
  echo ""
  echo "Preferred (with ticket ID):"
  echo "  <type>/<TICKET-ID>-<description>"
  echo "  Examples:"
  echo "    feature/JIRA-123-add-user-authentication"
  echo "    fix/PROJ-456-resolve-memory-leak"
  echo "    hotfix/URGENT-789-security-patch"
  echo ""
  echo "Alternative (without ticket ID):"
  echo "  <type>/<descriptive-name-with-context>"
  echo "  Examples:"
  echo "    feature/add-oauth-authentication-flow"
  echo "    fix/resolve-memory-leak-in-cache"
  echo "    refactor/extract-api-client-logic"
  echo ""
  echo "Valid types:"
  echo "  feature, feat    - New feature"
  echo "  bugfix, fix      - Bug fix"
  echo "  hotfix           - Urgent production fix"
  echo "  release          - Release preparation"
  echo "  chore            - Maintenance tasks"
  echo "  docs             - Documentation"
  echo "  test             - Tests"
  echo "  refactor         - Code refactoring"
  echo "  perf             - Performance improvements"
  echo ""
  echo "Requirements:"
  echo "  - Use lowercase with hyphens (kebab-case)"
  echo "  - Be specific and descriptive"
  echo "  - Avoid vague terms like 'fix', 'update', 'change' without context"
  echo "  - Include ticket ID when available (UPPERCASE-NUMBER)"
  echo ""
  exit 1
fi
