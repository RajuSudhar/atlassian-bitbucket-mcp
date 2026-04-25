# Phase 6: Full Tool Coverage

## Objective

Define all 20 MCP tools as YAML SSOT definitions, write declarative test cases for
each, create additional shared schema fragments and fixtures as needed,
regenerate code, and verify every tool passes schema validation and test
assertions.

## Scope

### In Scope

- 17 remaining YAML tool definitions (3 already done in Phase 2)
- YAML test cases for all 17 new tools
- Additional shared schema fragments as needed
- Additional fixture JSON files as needed
- Stub handler functions for all new tools
- Re-run code generation to update `src/generated/` with all 20 tools
- Full test suite execution

### Out of Scope

- Real handler implementations (these are stubs)
- Bitbucket API client implementation
- Performance optimization
- CI pipeline setup

## Complete Tool Inventory

### Pull Request Tools (11 total)

| #   | Tool Name                     | Permission  | Status  | YAML Definition                         |
| --- | ----------------------------- | ----------- | ------- | --------------------------------------- |
| 1   | `list_pull_requests`          | `read_pr`   | Phase 2 | `list-pull-requests.tool.yaml`          |
| 2   | `get_pull_request`            | `read_pr`   | Phase 2 | `get-pull-request.tool.yaml`            |
| 3   | `get_pull_request_diff`       | `read_pr`   | NEW     | `get-pull-request-diff.tool.yaml`       |
| 4   | `get_pull_request_commits`    | `read_pr`   | NEW     | `get-pull-request-commits.tool.yaml`    |
| 5   | `get_pull_request_activities` | `read_pr`   | NEW     | `get-pull-request-activities.tool.yaml` |
| 6   | `add_pull_request_comment`    | `write_pr`  | NEW     | `add-pull-request-comment.tool.yaml`    |
| 7   | `reply_to_comment`            | `write_pr`  | NEW     | `reply-to-comment.tool.yaml`            |
| 8   | `resolve_comment`             | `write_pr`  | NEW     | `resolve-comment.tool.yaml`             |
| 9   | `update_pull_request`         | `write_pr`  | NEW     | `update-pull-request.tool.yaml`         |
| 10  | `approve_pull_request`        | `manage_pr` | NEW     | `approve-pull-request.tool.yaml`        |
| 11  | `unapprove_pull_request`      | `manage_pr` | NEW     | `unapprove-pull-request.tool.yaml`      |

### Repository Tools (7 total)

| #   | Tool Name           | Permission     | Status  | YAML Definition               |
| --- | ------------------- | -------------- | ------- | ----------------------------- |
| 12  | `list_repositories` | `read_repo`    | Phase 2 | `list-repositories.tool.yaml` |
| 13  | `get_repository`    | `read_repo`    | NEW     | `get-repository.tool.yaml`    |
| 14  | `list_branches`     | `read_repo`    | NEW     | `list-branches.tool.yaml`     |
| 15  | `list_commits`      | `read_repo`    | NEW     | `list-commits.tool.yaml`      |
| 16  | `get_file_content`  | `read_repo`    | NEW     | `get-file-content.tool.yaml`  |
| 17  | `list_projects`     | `read_project` | NEW     | `list-projects.tool.yaml`     |
| 18  | `get_project`       | `read_project` | NEW     | `get-project.tool.yaml`       |

### Search Tools (2 total)

| #   | Tool Name        | Permission    | Status | YAML Definition            |
| --- | ---------------- | ------------- | ------ | -------------------------- |
| 19  | `search_code`    | `search_code` | NEW    | `search-code.tool.yaml`    |
| 20  | `search_commits` | `search_code` | NEW    | `search-commits.tool.yaml` |

## Step 1: Additional Shared Schema Fragments

### `src/tools/schemas/search.schema.yaml`

```yml
definitions:
  CodeSearchResult:
    type: object
    properties:
      type:
        type: string
        const: 'code_search_result'
      content_match_count:
        type: integer
      content_matches:
        type: array
        items:
          type: object
          properties:
            lines:
              type: array
              items:
                type: object
                properties:
                  line:
                    type: integer
                  segments:
                    type: array
                    items:
                      type: object
                      properties:
                        text:
                          type: string
                        match:
                          type: boolean
      file:
        type: object
        properties:
          path:
            type: string
          type:
            type: string
          links:
            type: object
            properties:
              self:
                $ref: 'common.schema.yaml#/definitions/Link'
    required:
      - file
      - content_matches

  CommitSearchResult:
    type: object
    properties:
      hash:
        type: string
      message:
        type: string
      date:
        type: string
        format: date-time
      author:
        type: object
        properties:
          raw:
            type: string
          user:
            $ref: 'common.schema.yaml#/definitions/User'
      repository:
        type: object
        properties:
          full_name:
            type: string
          name:
            type: string
    required:
      - hash
      - message

  Project:
    type: object
    properties:
      key:
        type: string
      uuid:
        type: string
      name:
        type: string
      description:
        type: string
      is_private:
        type: boolean
      created_on:
        type: string
        format: date-time
      updated_on:
        type: string
        format: date-time
      owner:
        $ref: 'common.schema.yaml#/definitions/User'
      links:
        type: object
        properties:
          self:
            $ref: 'common.schema.yaml#/definitions/Link'
          html:
            $ref: 'common.schema.yaml#/definitions/Link'
    required:
      - key
      - name
```

## Step 2: Define All 17 New Tools

Each tool definition follows the same structure established in Phase 2. Below are the complete YAML definitions for every remaining tool.

### `src/tools/definitions/get-pull-request-diff.tool.yaml`

```yml
name: get_pull_request_diff
description: 'Get the diff content of a pull request showing all file changes, additions, and deletions in unified diff format.'
permission: read_pr
cache:
  ttl: 300
  key: '${workspace}:${repo_slug}:pr:${pull_request_id}:diff'
input:
  type: object
  required:
    - workspace
    - repo_slug
    - pull_request_id
  properties:
    workspace:
      type: string
      description: 'The Bitbucket workspace slug or UUID'
    repo_slug:
      type: string
      description: 'The repository slug'
    pull_request_id:
      type: integer
      minimum: 1
      description: 'The pull request ID number'
    context:
      type: integer
      minimum: 0
      maximum: 100
      description: 'Number of context lines around changes (default: 3)'
output:
  type: object
  properties:
    diff:
      type: string
      description: 'Unified diff content'
    files_changed:
      type: integer
    lines_added:
      type: integer
    lines_removed:
      type: integer
  required:
    - diff
handler: src/handlers/pull-requests.ts#getPullRequestDiff
```

### `src/tools/definitions/get-pull-request-commits.tool.yaml`

```yaml
name: get_pull_request_commits
description: 'List all commits in a pull request with their hashes, messages, authors, and timestamps.'
permission: read_pr
cache:
  ttl: 600
  key: '${workspace}:${repo_slug}:pr:${pull_request_id}:commits'
input:
  type: object
  required:
    - workspace
    - repo_slug
    - pull_request_id
  properties:
    workspace:
      type: string
      description: 'The Bitbucket workspace slug or UUID'
    repo_slug:
      type: string
      description: 'The repository slug'
    pull_request_id:
      type: integer
      minimum: 1
      description: 'The pull request ID number'
output:
  type: object
  properties:
    values:
      type: array
      items:
        $ref: 'repository.schema.yaml#/definitions/Commit'
    size:
      type: integer
  required:
    - values
handler: src/handlers/pull-requests.ts#getPullRequestCommits
```

### `src/tools/definitions/get-pull-request-activities.tool.yaml`

```yaml
name: get_pull_request_activities
description: 'Get the activity log for a pull request including comments, approvals, and status changes.'
permission: read_pr
cache:
  ttl: 300
  key: '${workspace}:${repo_slug}:pr:${pull_request_id}:activities'
input:
  type: object
  required:
    - workspace
    - repo_slug
    - pull_request_id
  properties:
    workspace:
      type: string
      description: 'The Bitbucket workspace slug or UUID'
    repo_slug:
      type: string
      description: 'The repository slug'
    pull_request_id:
      type: integer
      minimum: 1
      description: 'The pull request ID number'
output:
  type: object
  properties:
    values:
      type: array
      items:
        $ref: 'pull-request.schema.yaml#/definitions/PullRequestActivity'
    size:
      type: integer
  required:
    - values
handler: src/handlers/pull-requests.ts#getPullRequestActivities
```

### `src/tools/definitions/add-pull-request-comment.tool.yaml`

```yaml
name: add_pull_request_comment
description: 'Add a comment to a pull request. Supports general comments and inline comments on specific file lines.'
permission: write_pr
input:
  type: object
  required:
    - workspace
    - repo_slug
    - pull_request_id
    - content
  properties:
    workspace:
      type: string
      description: 'The Bitbucket workspace slug or UUID'
    repo_slug:
      type: string
      description: 'The repository slug'
    pull_request_id:
      type: integer
      minimum: 1
      description: 'The pull request ID number'
    content:
      type: string
      description: 'The comment text in Markdown format'
    inline:
      type: object
      description: 'Inline comment location (omit for general comment)'
      properties:
        path:
          type: string
          description: 'File path for inline comment'
        from:
          type: integer
          description: 'Start line (for multi-line comments)'
        to:
          type: integer
          description: 'End line for the comment'
      required:
        - path
        - to
output:
  $ref: 'pull-request.schema.yaml#/definitions/PullRequestComment'
handler: src/handlers/pull-requests.ts#addPullRequestComment
```

### `src/tools/definitions/reply-to-comment.tool.yaml`

```yaml
name: reply_to_comment
description: 'Reply to an existing comment on a pull request, creating a threaded conversation.'
permission: write_pr
input:
  type: object
  required:
    - workspace
    - repo_slug
    - pull_request_id
    - comment_id
    - content
  properties:
    workspace:
      type: string
      description: 'The Bitbucket workspace slug or UUID'
    repo_slug:
      type: string
      description: 'The repository slug'
    pull_request_id:
      type: integer
      minimum: 1
      description: 'The pull request ID number'
    comment_id:
      type: integer
      minimum: 1
      description: 'The parent comment ID to reply to'
    content:
      type: string
      description: 'The reply text in Markdown format'
output:
  $ref: 'pull-request.schema.yaml#/definitions/PullRequestComment'
handler: src/handlers/pull-requests.ts#replyToComment
```

### `src/tools/definitions/resolve-comment.tool.yaml`

```yaml
name: resolve_comment
description: 'Resolve or unresolve a comment thread on a pull request.'
permission: write_pr
input:
  type: object
  required:
    - workspace
    - repo_slug
    - pull_request_id
    - comment_id
  properties:
    workspace:
      type: string
      description: 'The Bitbucket workspace slug or UUID'
    repo_slug:
      type: string
      description: 'The repository slug'
    pull_request_id:
      type: integer
      minimum: 1
      description: 'The pull request ID number'
    comment_id:
      type: integer
      minimum: 1
      description: 'The comment ID to resolve'
    resolved:
      type: boolean
      description: 'Set to true to resolve, false to unresolve (default: true)'
output:
  type: object
  properties:
    id:
      type: integer
    resolved:
      type: boolean
    resolved_by:
      $ref: 'common.schema.yaml#/definitions/User'
    resolved_on:
      type: string
      format: date-time
  required:
    - id
    - resolved
handler: src/handlers/pull-requests.ts#resolveComment
```

### `src/tools/definitions/update-pull-request.tool.yaml`

```yaml
name: update_pull_request
description: "Update a pull request's title, description, reviewers, or close source branch setting."
permission: write_pr
input:
  type: object
  required:
    - workspace
    - repo_slug
    - pull_request_id
  properties:
    workspace:
      type: string
      description: 'The Bitbucket workspace slug or UUID'
    repo_slug:
      type: string
      description: 'The repository slug'
    pull_request_id:
      type: integer
      minimum: 1
      description: 'The pull request ID number'
    title:
      type: string
      description: 'New title for the pull request'
    description:
      type: string
      description: 'New description in Markdown format'
    close_source_branch:
      type: boolean
      description: 'Whether to close the source branch on merge'
    reviewers:
      type: array
      items:
        type: object
        properties:
          uuid:
            type: string
        required:
          - uuid
      description: 'List of reviewer UUIDs'
output:
  $ref: 'pull-request.schema.yaml#/definitions/PullRequest'
handler: src/handlers/pull-requests.ts#updatePullRequest
```

### `src/tools/definitions/approve-pull-request.tool.yaml`

```yaml
name: approve_pull_request
description: 'Approve a pull request on behalf of the authenticated user.'
permission: manage_pr
input:
  type: object
  required:
    - workspace
    - repo_slug
    - pull_request_id
  properties:
    workspace:
      type: string
      description: 'The Bitbucket workspace slug or UUID'
    repo_slug:
      type: string
      description: 'The repository slug'
    pull_request_id:
      type: integer
      minimum: 1
      description: 'The pull request ID number'
output:
  type: object
  properties:
    approved:
      type: boolean
    user:
      $ref: 'common.schema.yaml#/definitions/User'
    role:
      type: string
      enum:
        - PARTICIPANT
        - REVIEWER
        - AUTHOR
  required:
    - approved
    - user
handler: src/handlers/pull-requests.ts#approvePullRequest
```

### `src/tools/definitions/unapprove-pull-request.tool.yaml`

```yaml
name: unapprove_pull_request
description: 'Remove approval from a pull request on behalf of the authenticated user.'
permission: manage_pr
input:
  type: object
  required:
    - workspace
    - repo_slug
    - pull_request_id
  properties:
    workspace:
      type: string
      description: 'The Bitbucket workspace slug or UUID'
    repo_slug:
      type: string
      description: 'The repository slug'
    pull_request_id:
      type: integer
      minimum: 1
      description: 'The pull request ID number'
output:
  type: object
  properties:
    approved:
      type: boolean
      const: false
    user:
      $ref: 'common.schema.yaml#/definitions/User'
  required:
    - approved
    - user
handler: src/handlers/pull-requests.ts#unapprovePullRequest
```

### `src/tools/definitions/get-repository.tool.yaml`

```yaml
name: get_repository
description: 'Get detailed information about a specific Bitbucket repository including its main branch, language, and project.'
permission: read_repo
cache:
  ttl: 1800
  key: '${workspace}:${repo_slug}:info'
input:
  type: object
  required:
    - workspace
    - repo_slug
  properties:
    workspace:
      type: string
      description: 'The Bitbucket workspace slug or UUID'
    repo_slug:
      type: string
      description: 'The repository slug'
output:
  $ref: 'repository.schema.yaml#/definitions/Repository'
handler: src/handlers/repositories.ts#getRepository
```

### `src/tools/definitions/list-branches.tool.yaml`

```yaml
name: list_branches
description: 'List branches in a repository with their latest commit information.'
permission: read_repo
cache:
  ttl: 600
  key: '${workspace}:${repo_slug}:branches'
input:
  type: object
  required:
    - workspace
    - repo_slug
  properties:
    workspace:
      type: string
      description: 'The Bitbucket workspace slug or UUID'
    repo_slug:
      type: string
      description: 'The repository slug'
    q:
      type: string
      description: 'Query string to filter branches (e.g., name ~ "feature")'
    sort:
      type: string
      description: 'Sort field (e.g., -target.date for newest first)'
    page:
      type: integer
      minimum: 1
    pagelen:
      type: integer
      minimum: 1
      maximum: 100
output:
  type: object
  properties:
    values:
      type: array
      items:
        $ref: 'repository.schema.yaml#/definitions/Branch'
    size:
      type: integer
    page:
      type: integer
    pagelen:
      type: integer
    next:
      type: string
      format: uri
  required:
    - values
handler: src/handlers/repositories.ts#listBranches
```

### `src/tools/definitions/list-commits.tool.yaml`

```yaml
name: list_commits
description: 'List commits in a repository or on a specific branch with message, author, and date.'
permission: read_repo
cache:
  ttl: 600
  key: '${workspace}:${repo_slug}:commits:${branch}'
input:
  type: object
  required:
    - workspace
    - repo_slug
  properties:
    workspace:
      type: string
      description: 'The Bitbucket workspace slug or UUID'
    repo_slug:
      type: string
      description: 'The repository slug'
    branch:
      type: string
      description: 'Branch name to list commits from (default: main branch)'
    page:
      type: integer
      minimum: 1
    pagelen:
      type: integer
      minimum: 1
      maximum: 100
output:
  type: object
  properties:
    values:
      type: array
      items:
        $ref: 'repository.schema.yaml#/definitions/Commit'
    size:
      type: integer
    page:
      type: integer
    next:
      type: string
      format: uri
  required:
    - values
handler: src/handlers/repositories.ts#listCommits
```

### `src/tools/definitions/get-file-content.tool.yaml`

```yaml
name: get_file_content
description: 'Retrieve the content of a file from a repository at a specific commit or branch.'
permission: read_repo
cache:
  ttl: 1800
  key: '${workspace}:${repo_slug}:file:${path}:${ref}'
input:
  type: object
  required:
    - workspace
    - repo_slug
    - path
  properties:
    workspace:
      type: string
      description: 'The Bitbucket workspace slug or UUID'
    repo_slug:
      type: string
      description: 'The repository slug'
    path:
      type: string
      description: 'File path relative to repository root'
    ref:
      type: string
      description: 'Branch name, tag, or commit hash (default: main branch)'
output:
  $ref: 'repository.schema.yaml#/definitions/FileContent'
handler: src/handlers/repositories.ts#getFileContent
```

### `src/tools/definitions/list-projects.tool.yaml`

```yaml
name: list_projects
description: 'List all projects in a Bitbucket workspace.'
permission: read_project
cache:
  ttl: 3600
  key: '${workspace}:projects'
input:
  type: object
  required:
    - workspace
  properties:
    workspace:
      type: string
      description: 'The Bitbucket workspace slug or UUID'
    page:
      type: integer
      minimum: 1
    pagelen:
      type: integer
      minimum: 1
      maximum: 100
output:
  type: object
  properties:
    values:
      type: array
      items:
        $ref: 'search.schema.yaml#/definitions/Project'
    size:
      type: integer
    page:
      type: integer
    next:
      type: string
      format: uri
  required:
    - values
handler: src/handlers/repositories.ts#listProjects
```

### `src/tools/definitions/get-project.tool.yaml`

```yaml
name: get_project
description: 'Get detailed information about a specific project in a Bitbucket workspace.'
permission: read_project
cache:
  ttl: 1800
  key: '${workspace}:project:${project_key}'
input:
  type: object
  required:
    - workspace
    - project_key
  properties:
    workspace:
      type: string
      description: 'The Bitbucket workspace slug or UUID'
    project_key:
      type: string
      description: 'The project key (e.g., PROJ)'
output:
  $ref: 'search.schema.yaml#/definitions/Project'
handler: src/handlers/repositories.ts#getProject
```

### `src/tools/definitions/search-code.tool.yaml`

```yaml
name: search_code
description: 'Search for code across repositories in a workspace using text search queries.'
permission: search_code
cache:
  ttl: 300
  key: '${workspace}:code-search:${query}'
input:
  type: object
  required:
    - workspace
    - query
  properties:
    workspace:
      type: string
      description: 'The Bitbucket workspace slug or UUID'
    query:
      type: string
      description: 'Search query string'
    page:
      type: integer
      minimum: 1
    pagelen:
      type: integer
      minimum: 1
      maximum: 100
output:
  type: object
  properties:
    values:
      type: array
      items:
        $ref: 'search.schema.yaml#/definitions/CodeSearchResult'
    size:
      type: integer
    page:
      type: integer
    next:
      type: string
      format: uri
  required:
    - values
handler: src/handlers/search.ts#searchCode
```

### `src/tools/definitions/search-commits.tool.yaml`

```yaml
name: search_commits
description: 'Search commit messages across repositories in a workspace.'
permission: search_code
cache:
  ttl: 300
  key: '${workspace}:commit-search:${query}'
input:
  type: object
  required:
    - workspace
    - query
  properties:
    workspace:
      type: string
      description: 'The Bitbucket workspace slug or UUID'
    query:
      type: string
      description: 'Search query string for commit messages'
    page:
      type: integer
      minimum: 1
    pagelen:
      type: integer
      minimum: 1
      maximum: 100
output:
  type: object
  properties:
    values:
      type: array
      items:
        $ref: 'search.schema.yaml#/definitions/CommitSearchResult'
    size:
      type: integer
    page:
      type: integer
    next:
      type: string
      format: uri
  required:
    - values
handler: src/handlers/search.ts#searchCommits
```

## Step 3: Add Stub Handlers for All New Tools

Update `src/handlers/pull-requests.ts` to add all missing handler stubs:

```typescript
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export async function listPullRequests(args: Record<string, unknown>): Promise<CallToolResult> {
  throw new Error('listPullRequests not implemented');
}

export async function getPullRequest(args: Record<string, unknown>): Promise<CallToolResult> {
  throw new Error('getPullRequest not implemented');
}

export async function getPullRequestDiff(args: Record<string, unknown>): Promise<CallToolResult> {
  throw new Error('getPullRequestDiff not implemented');
}

export async function getPullRequestCommits(
  args: Record<string, unknown>
): Promise<CallToolResult> {
  throw new Error('getPullRequestCommits not implemented');
}

export async function getPullRequestActivities(
  args: Record<string, unknown>
): Promise<CallToolResult> {
  throw new Error('getPullRequestActivities not implemented');
}

export async function addPullRequestComment(
  args: Record<string, unknown>
): Promise<CallToolResult> {
  throw new Error('addPullRequestComment not implemented');
}

export async function replyToComment(args: Record<string, unknown>): Promise<CallToolResult> {
  throw new Error('replyToComment not implemented');
}

export async function resolveComment(args: Record<string, unknown>): Promise<CallToolResult> {
  throw new Error('resolveComment not implemented');
}

export async function updatePullRequest(args: Record<string, unknown>): Promise<CallToolResult> {
  throw new Error('updatePullRequest not implemented');
}

export async function approvePullRequest(args: Record<string, unknown>): Promise<CallToolResult> {
  throw new Error('approvePullRequest not implemented');
}

export async function unapprovePullRequest(args: Record<string, unknown>): Promise<CallToolResult> {
  throw new Error('unapprovePullRequest not implemented');
}
```

Update `src/handlers/repositories.ts` to add all missing handler stubs:

```typescript
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export async function listRepositories(args: Record<string, unknown>): Promise<CallToolResult> {
  throw new Error('listRepositories not implemented');
}

export async function getRepository(args: Record<string, unknown>): Promise<CallToolResult> {
  throw new Error('getRepository not implemented');
}

export async function listBranches(args: Record<string, unknown>): Promise<CallToolResult> {
  throw new Error('listBranches not implemented');
}

export async function listCommits(args: Record<string, unknown>): Promise<CallToolResult> {
  throw new Error('listCommits not implemented');
}

export async function getFileContent(args: Record<string, unknown>): Promise<CallToolResult> {
  throw new Error('getFileContent not implemented');
}

export async function listProjects(args: Record<string, unknown>): Promise<CallToolResult> {
  throw new Error('listProjects not implemented');
}

export async function getProject(args: Record<string, unknown>): Promise<CallToolResult> {
  throw new Error('getProject not implemented');
}
```

## Step 4: Write Test Cases for New Tools

Each new tool needs at minimum:

1. A success case with mock data and schema validation
2. An input validation error case (missing required field)
3. An API error case (404 or 401)

**IMPORTANT**: Due to the volume of 17 tool test files, the implementer should follow the exact pattern from Phase 5's exemplar test cases. Each test file follows this template:

```yaml
tool: <tool_name>
fixtures:
  - name: <fixture_name>
    file: <fixture_file.json>
cases:
  - name: '<success case description>'
    input: <all required fields>
    mock:
      endpoint: <METHOD /path>
      fixture: <fixture_name>
      status: 200
    expect:
      schema: true

  - name: 'returns error for missing <required_field>'
    input: <omit required field>
    expect:
      isError: true
      error:
        code: 'VALIDATION_ERROR'

  - name: 'handles API error'
    input: <valid input>
    mock:
      endpoint: <METHOD /path>
      status: 404
      body:
        error:
          message: 'Not found'
    expect:
      isError: true
```

### Test Files to Create

| File                                                | Tool                          | Min Cases |
| --------------------------------------------------- | ----------------------------- | --------- |
| `tests/tools/get-pull-request-diff.test.yaml`       | `get_pull_request_diff`       | 3         |
| `tests/tools/get-pull-request-commits.test.yaml`    | `get_pull_request_commits`    | 3         |
| `tests/tools/get-pull-request-activities.test.yaml` | `get_pull_request_activities` | 3         |
| `tests/tools/add-pull-request-comment.test.yaml`    | `add_pull_request_comment`    | 4         |
| `tests/tools/reply-to-comment.test.yaml`            | `reply_to_comment`            | 3         |
| `tests/tools/resolve-comment.test.yaml`             | `resolve_comment`             | 3         |
| `tests/tools/update-pull-request.test.yaml`         | `update_pull_request`         | 3         |
| `tests/tools/approve-pull-request.test.yaml`        | `approve_pull_request`        | 3         |
| `tests/tools/unapprove-pull-request.test.yaml`      | `unapprove_pull_request`      | 3         |
| `tests/tools/get-repository.test.yaml`              | `get_repository`              | 3         |
| `tests/tools/list-branches.test.yaml`               | `list_branches`               | 3         |
| `tests/tools/list-commits.test.yaml`                | `list_commits`                | 3         |
| `tests/tools/get-file-content.test.yaml`            | `get_file_content`            | 4         |
| `tests/tools/list-projects.test.yaml`               | `list_projects`               | 3         |
| `tests/tools/get-project.test.yaml`                 | `get_project`                 | 3         |
| `tests/tools/search-code.test.yaml`                 | `search_code`                 | 3         |
| `tests/tools/search-commits.test.yaml`              | `search_commits`              | 3         |

**Minimum total new test cases: 53** (plus the 15 from Phase 5 = 68 total)

### Additional Fixtures to Create

| File                                          | Contents               |
| --------------------------------------------- | ---------------------- |
| `tests/fixtures/pull-request-diff.json`       | Unified diff text      |
| `tests/fixtures/pull-request-commits.json`    | Array of commits       |
| `tests/fixtures/pull-request-activities.json` | Array of activities    |
| `tests/fixtures/pull-request-comment.json`    | Single comment object  |
| `tests/fixtures/branches.json`                | Paginated branch list  |
| `tests/fixtures/commits.json`                 | Paginated commit list  |
| `tests/fixtures/file-content.json`            | File content object    |
| `tests/fixtures/projects.json`                | Paginated project list |
| `tests/fixtures/project-detail.json`          | Single project object  |
| `tests/fixtures/code-search-results.json`     | Code search response   |
| `tests/fixtures/commit-search-results.json`   | Commit search response |
| `tests/fixtures/approval.json`                | Approval response      |

## Step 5: Regenerate Code

```bash
# Regenerate all generated files with all 20 tools
npm run generate

# Verify the output
cat src/generated/tool-list.ts | grep "TOOL_COUNT"
# Should output: export const TOOL_COUNT = 20 as const;

# Verify types generated for all tools
grep "export interface" src/generated/types.ts | wc -l
# Should be 40+ (input + output per tool + shared types)

# Type check
npx tsc --noEmit
```

## Step 6: Verify

```bash
# Run ALL tests
npx vitest run --reporter=verbose

# Expected: 68+ test cases across 20 tool suites
# All tests should pass

# Run only tool tests
npm run test:tools

# Run only unit tests
npm run test:unit

# Verify code generation is in sync
npm run generate:check

# Type check everything
npx tsc --noEmit -p tsconfig.test.json

# Verify tool count
node -e "
import { loadToolsFromDirectory } from './src/lib/loader.js';
const result = loadToolsFromDirectory('./src/tools/definitions', './src/tools/schemas');
console.log('Total tools:', result.tools.length);
console.log('Errors:', result.errors.length);
const names = result.tools.map(t => t.definition.name).sort();
names.forEach(n => console.log('  -', n));
"
```

## Files Created

| File                                    | Purpose                             |
| --------------------------------------- | ----------------------------------- |
| `src/tools/schemas/search.schema.yaml`  | Search + Project schema definitions |
| 17x `src/tools/definitions/*.tool.yaml` | Remaining tool definitions          |
| 17x `tests/tools/*.test.yaml`           | Test cases for remaining tools      |
| 12x `tests/fixtures/*.json`             | Mock API response fixtures          |

## Files Modified

| File                            | Changes                        |
| ------------------------------- | ------------------------------ |
| `src/handlers/pull-requests.ts` | Added 9 stub handler functions |
| `src/handlers/repositories.ts`  | Added 6 stub handler functions |
| `src/generated/types.ts`        | Regenerated with all 20 tools  |
| `src/generated/validators.ts`   | Regenerated with all 20 tools  |
| `src/generated/tool-list.ts`    | Regenerated with all 20 tools  |

## Commit

```text
feat(tools): define all 20 MCP tools with YAML SSOT and declarative tests

- Add 17 remaining tool definitions in YAML
- Add search and project shared schema fragments
- Write 53+ declarative test cases for new tools
- Create 12 additional fixture files for mock API responses
- Add stub handlers for all tool functions
- Regenerate types, validators, and tool list for 20 tools
- Total test coverage: 68+ declarative test cases
```
