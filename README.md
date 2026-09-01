# Atlassian Bitbucket MCP Server

A Model Context Protocol (MCP) server that enables AI assistants to interact with Atlassian Bitbucket for
pull request reviews, code search, and repository operations.

## Features

- **Pull Request Management**: Review PRs, add/resolve comments, approve changes
- **Batched Reviews**: Queue comments and tasks as pending, then publish them in
  one review — the API equivalent of Bitbucket's _Start review_ / _Finish review_
- **Code Search**: Search code across repositories and commits
- **Repository Operations**: List repos, browse branches, view file content
- **Dual Instance Support**: Works with both Bitbucket Cloud and self-hosted Data Center/Server
- **Secure**: Built with security in mind, avoiding compromised npm packages
- **Type-Safe**: Full TypeScript implementation with strict type checking
- **Caching**: Smart caching layer for frequently accessed static data
- **Local-First**: Designed for NPX-based local usage with Personal Access Tokens
- **CI Helper**: `atlassian-bitbucket-mcp/helper` subpath export for direct
  programmatic use in CI scripts — no MCP client required

## Requirements

- Node.js >= 20.0.0
- pnpm
- Bitbucket Personal Access Token (Cloud or Server/Data Center)
- Access to a Bitbucket instance (Cloud or self-hosted)

## Quick Start

### 1. Environment Setup

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` and set the required variables:

```env
BITBUCKET_URL=https://bitbucket.juspay.net # Cloud: https://bitbucket.org
BITBUCKET_TOKEN=BBDC-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
BITBUCKET_DEFAULT_PROJECT=BZ # your default project key
```

For a self-hosted Server/DC instance, set `BITBUCKET_URL` to the base URL only
(e.g. `https://bitbucket.juspay.net`) — the server appends `/rest/api/1.0`
itself. A repo such as
`https://bitbucket.juspay.net/projects/BZ/repos/nimble` has project key `BZ`
and repo slug `nimble`.

### 2. Installation

```bash
pnpm install
```

### 3. Build

```bash
pnpm run build
```

### 4. Usage with MCP Client

Configure your MCP client (e.g., Claude Desktop) to use this server:

```json
{
  "mcpServers": {
    "bitbucket": {
      "command": "npx",
      "args": ["-y", "atlassian-bitbucket-mcp"],
      "env": {
        "BITBUCKET_URL": "https://bitbucket.juspay.net",
        "BITBUCKET_TOKEN": "BBDC-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "BITBUCKET_DEFAULT_PROJECT": "BZ",
        "BITBUCKET_ALLOWED_PROJECTS": "BZ",
        "BITBUCKET_ALLOWED_REPOS": "BZ/nimble"
      }
    }
  }
}
```

`BITBUCKET_ALLOWED_PROJECTS` and `BITBUCKET_ALLOWED_REPOS` are optional — omit
them to allow all projects/repos the token can access, or set them to restrict
the server to specific scopes.

This is the **stdio** transport: the MCP client launches the server per session.
No port is involved.

### 5. Run as an HTTP MCP (local service)

The server can instead run as a long-lived **Streamable HTTP** server and be
registered as a Claude HTTP MCP. Set `MCP_TRANSPORT=http` and it listens on
`http://127.0.0.1:3900/mcp` (configurable via `MCP_HTTP_PORT` / `MCP_HTTP_HOST`;
`GET /health` returns a readiness probe). Set `MCP_TRANSPORT=https` to serve
the same endpoint over TLS — see below.

> Security: the HTTP endpoint is unauthenticated and sits in front of your
> Bitbucket token — keep `MCP_HTTP_HOST` on loopback (`127.0.0.1`) and never
> expose it to a network interface.

On macOS, install it as an always-on login service (launchd LaunchAgent):

```bash
# Builds, installs globally, writes ~/.config/bitbucket-mcp/env (chmod 600),
# and loads a LaunchAgent bound to 127.0.0.1:3900.
./scripts/install-macos-service.sh
# then put your real BITBUCKET_TOKEN in ~/.config/bitbucket-mcp/env and:
launchctl kickstart -k gui/$(id -u)/com.juspay.bitbucket-mcp
```

Register it with Claude (available in every project):

```bash
claude mcp add --scope user --transport http bitbucket http://127.0.0.1:3900/mcp
claude mcp list # bitbucket ... ✔ Connected
```

**Serving over TLS (`MCP_TRANSPORT=https`).** The HTTP transport can serve TLS
itself: set `MCP_TRANSPORT=https` plus `MCP_HTTP_TLS_CERT_FILE` and
`MCP_HTTP_TLS_KEY_FILE` (paths to PEM files — both are required in `https` mode
and ignored otherwise). Everything else (`/mcp` endpoint, sessions, `/health`)
is identical to `http` mode. For a locally-trusted certificate, use
[mkcert](https://github.com/FiloSottile/mkcert):

```bash
mkcert -install && mkcert localhost 127.0.0.1
```

```env
MCP_TRANSPORT=https
MCP_HTTP_TLS_CERT_FILE=/absolute/path/to/localhost+1.pem
MCP_HTTP_TLS_KEY_FILE=/absolute/path/to/localhost+1-key.pem
```

> TLS adds encryption, not authentication — the endpoint is still
> unauthenticated, so keep `MCP_HTTP_HOST` on loopback in `https` mode too.

**Self-hosted TLS / internal CA.** If your Bitbucket uses an internal CA, the
outbound HTTPS calls need to trust it. Set `NODE_EXTRA_CA_CERTS=/path/to/ca.pem`
in the env-file. Avoid Node's `--use-system-ca` for the background service — it
hangs under launchd because macOS keychain access requires an interactive
session. (`--use-system-ca` is fine for a foreground/stdio run.)

## Configuration

### Environment Variables

All configuration is done through environment variables. See [`.env.example`](./.env.example) for the complete list.

#### Required

- `BITBUCKET_URL` - Your Bitbucket instance URL
- `BITBUCKET_TOKEN` - Personal Access Token
- `BITBUCKET_DEFAULT_PROJECT` - Default project key

#### Optional

- `BITBUCKET_ALLOWED_ACTIONS` - Comma-separated list of allowed tool actions
- `BITBUCKET_ALLOWED_PROJECTS` - Comma-separated allow-list of project keys the
  server may touch (empty = all). Case-insensitive.
- `BITBUCKET_ALLOWED_REPOS` - Comma-separated allow-list of repositories (empty =
  all). Each entry is `PROJECT/REPO` or a bare `REPO` slug. Case-insensitive.
- `BITBUCKET_CACHE_ENABLED` - Enable/disable caching (default: true)
- `BITBUCKET_CACHE_TTL_REPOS` - Repository cache TTL in seconds (default: 3600)
- `MCP_TRANSPORT` - `stdio` (default), `http`, or `https`
- `MCP_HTTP_PORT` / `MCP_HTTP_HOST` - HTTP transport bind (default `3900` / `127.0.0.1`)
- `MCP_HTTP_TLS_CERT_FILE` / `MCP_HTTP_TLS_KEY_FILE` - PEM certificate/key
  paths, both required when `MCP_TRANSPORT=https` (ignored otherwise)
- `NODE_EXTRA_CA_CERTS` - PEM path for a self-hosted internal CA (outbound TLS)
- `BITBUCKET_MCP_CONFIG`, `BITBUCKET_MCP_MAX_OUTPUT_TOKENS`,
  `BITBUCKET_MCP_CONFIG_DIR` — output-token-limit governor (see
  [Per-tool output-token limits](#per-tool-output-token-limits))
- See [`.env.example`](./.env.example) for all options

### Creating a Personal Access Token

#### Bitbucket Cloud

1. Go to **Personal settings** > **Personal Access Tokens**
2. Click **Create token**
3. Give it a name and select permissions:
   - **Repositories**: Read, Write
   - **Pull requests**: Read, Write
4. Click **Create** and copy the token

#### Bitbucket Server/Data Center

1. Go to **Profile** > **Manage account** > **Personal access tokens**
2. Click **Create a token**
3. Give it a name and select permissions:
   - **Project permissions**: Read
   - **Repository permissions**: Read, Write
4. Click **Create** and copy the token

## Per-tool output-token limits

The server can withhold oversize tool responses and return an actionable
guidance error instead of streaming a wall of content that blows past the
caller's context budget. When enabled (it is, by default, at 25,000
tokens), each tool's response is estimated with `gpt-tokenizer`'s
`o200k_base` encoding scaled by 1.2× (Claude runs ~15–20% higher than
GPT-4o for prose) and compared against a configurable per-tool limit.

### Discovery precedence

The governor loads config from the first available source:

1. `BITBUCKET_MCP_CONFIG` env var — absolute path. Errors at startup if
   the file does not exist.
2. `./bitbucket-mcp.config.json` — in the current working directory.
3. `$XDG_CONFIG_HOME/bitbucket-mcp/config.json` — or
   `~/.config/bitbucket-mcp/config.json` if `$XDG_CONFIG_HOME` is unset.
   `$BITBUCKET_MCP_CONFIG_DIR` overrides the directory portion of this
   lookup.
4. Built-in default (25,000 tokens across all tools).

### Environment variables

- `BITBUCKET_MCP_CONFIG` — absolute path to the config file.
- `BITBUCKET_MCP_MAX_OUTPUT_TOKENS` — integer > 0. Overrides
  `defaults.maxOutputTokens` from the file. Never overrides a
  per-tool value.
- `BITBUCKET_MCP_CONFIG_DIR` — overrides the XDG config directory used
  for the fallback config path.

### JSON config shape

`bitbucket-mcp.config.json`:

```json
{
  "$schema": "./bitbucket-mcp.config.schema.json",
  "defaults": { "maxOutputTokens": 25000 },
  "tools": {
    "bitbucket_list_pull_requests": { "maxOutputTokens": 10000 },
    "bitbucket_search_code": { "maxOutputTokens": 10000 }
  }
}
```

The schema is strict — unknown keys fail startup, so typos in the config
are caught immediately. `bitbucket-mcp.config.schema.json` is committed at
repo root and can be regenerated with `pnpm run schema:gen` after any
change to `serverConfigSchema`.

Per-tool `tools.<name>.maxOutputTokens` always wins over the default and
cannot be overridden by env.

### Scaffolding

`atlassian-bitbucket-mcp init` writes a starter config to the XDG default
location. Flags: `--config-path <path>`, `--max-output-tokens <n>`, `-y`
(overwrite existing).

`atlassian-bitbucket-mcp help` prints usage, discovery order, env vars,
and JSON shape — offline reference for the same information above.

### What the guidance error looks like

When a tool's response exceeds its limit, the caller receives an
`isError: true` result whose text names the tool, the estimated token
count, the configured limit, narrowing suggestions (reduce `limit`,
filter by `project`/`repo`, call a single-item retrieval tool), and both
ways to raise the ceiling (per-tool config entry or the env var). The
full response is withheld — nothing is truncated silently.

## Available MCP Tools

This server provides the following tools for interacting with Bitbucket:

### Pull Request Tools

- `bitbucket_list_pull_requests` - List PRs for a repository
- `bitbucket_get_pull_request` - Get detailed PR information
- `bitbucket_get_pr_diff` - Get PR changes/diff
- `bitbucket_get_pr_commits` - Get commits in a PR
- `bitbucket_get_pr_activities` - Get PR comments and activities
- `bitbucket_add_pr_comment` - Add a general comment (`pending: true` queues it
  in your review session instead of posting it)
- `bitbucket_add_pr_inline_comment` - Add a per-file, per-line inline code
  comment on any author's PR (`path` + `line` + `lineType`; `diffType` defaults
  to `EFFECTIVE` on Server/DC; supports `pending`)
- `bitbucket_reply_to_comment` - Reply to a comment (supports `pending`)
- `bitbucket_resolve_comment` - Resolve a comment thread
- `bitbucket_update_comment` - Edit a comment
- `bitbucket_update_pull_request` - Update a PR's title and/or description
  (Server/DC only, requires current `version` for optimistic locking)
- `bitbucket_approve_pr` - Approve a pull request
- `bitbucket_create_pr_task` - Create a checklist task (blocker-severity
  comment) on a PR, optionally as a reply to an existing comment (Server/DC
  only; supports `pending`)
- `bitbucket_list_pr_tasks` - List checklist tasks on a PR (Server/DC only)
- `bitbucket_resolve_pr_task` - Set a task to `OPEN` or `RESOLVED` (Server/DC
  only)
- `bitbucket_delete_pr_task` - Delete a task (Server/DC only)

### PR Review Session Tools

Server/DC 7.7+ only. See [Batched reviews](#batched-reviews-start-review--finish-review).

- `bitbucket_start_pr_review` - Begin a batched review: reports what is already
  pending in your session and how to add more
- `bitbucket_get_pr_review` - List the pending, unpublished comments in your
  session (visible only to you)
- `bitbucket_publish_pr_review` - Publish every pending comment at once, with an
  optional overview `commentText` and reviewer `participantStatus`
- `bitbucket_discard_pr_review` - Delete every pending comment without notifying
  the author

### Repository Tools

- `bitbucket_list_projects` - List accessible projects
- `bitbucket_list_repositories` - List repos in a project
- `bitbucket_get_repository` - Get repository details
- `bitbucket_get_branches` - List repository branches
- `bitbucket_get_commits` - Get commit history
- `bitbucket_get_file_content` - Get file content at ref

### Code Search Tools

- `bitbucket_search_code` - Search code across repositories
- `bitbucket_search_commits` - Search commits by message

See [docs/TOOLS.md](docs/TOOLS.md) for detailed tool documentation (coming soon).

## Batched reviews (Start review / Finish review)

Bitbucket Server/DC 7.7+ lets a reviewer queue feedback privately and release it
in one go — **Start review**, then **Publish** or **Discard review** in the web
UI. The server models this as comments in `PENDING` state, scoped to
`(pull request, authenticated user)`, so the same session is shared by the web
UI and this MCP server and survives restarts of either.

There is no "start review" endpoint: Bitbucket opens the session the moment you
create the first pending comment, and closes it on publish or discard.

```text
bitbucket_start_pr_review        # optional: shows what is already pending
  ↓
bitbucket_add_pr_inline_comment  { ..., pending: true }   # repeat as needed
bitbucket_create_pr_task         { ..., pending: true }
  ↓
bitbucket_get_pr_review          # read back everything queued, edit if needed
  ↓
bitbucket_publish_pr_review      { commentText?, participantStatus? }
   or bitbucket_discard_pr_review
```

Notes:

- `pending` defaults to `false`, so every existing call site keeps posting
  immediately. Nothing changes unless you opt in.
- Pending comments are invisible to the PR author and to other reviewers until
  published; `bitbucket_get_pr_activities` will not show them.
- Queued comments can be edited (`bitbucket_update_comment`) or deleted while
  still pending — a pending comment carries an ordinary comment `id`/`version`.
- `bitbucket_publish_pr_review` returns `{ "publishedCommentCount": N }`.
  `participantStatus` is one of `UNAPPROVED`, `NEEDS_WORK`, `APPROVED`; omit it
  to publish without changing your verdict. Supplying it requires the
  `manage_pr` action, since it changes approval state.
- `bitbucket_discard_pr_review` deletes all pending comments for the PR — it is
  not undoable, and the author is never notified.
- On Bitbucket Cloud, and on Server/DC older than 7.7, the `/review` endpoints
  do not exist and these four tools return a `404`-derived error.

## Programmatic usage (CI)

Besides running as an MCP server, the package exposes the Bitbucket API layer
directly as a library via the `atlassian-bitbucket-mcp/helper` subpath export —
useful for CI jobs that need to comment on a PR without an MCP client in the
loop. There is no permission or scope gating on this path: the script holds the
token, so it can do whatever the token can.

```js
import { createBitbucketHelper } from 'atlassian-bitbucket-mcp/helper';

// Explicit options override env; anything omitted falls back to
// BITBUCKET_URL / BITBUCKET_TOKEN / BITBUCKET_DEFAULT_PROJECT.
const helper = createBitbucketHelper({
  url: 'https://bitbucket.juspay.net',
  token: process.env.BITBUCKET_TOKEN,
  defaultProject: 'BZ',
});

const pr = await helper.pullRequests.get('BZ', 'nimble', 42);
await helper.pullRequests.addComment('BZ', 'nimble', 42, `CI passed for "${pr.title}"`);
```

Notes:

- `helper.pullRequests`, `helper.repositories` and `helper.search` group the
  API by resource — the same operations as the MCP tools (list/get PRs, diffs,
  commits, comments, tasks, review sessions, approve, branches, file content,
  code/commit search). Every method is pre-bound, so destructuring is safe
  (`const { addComment } = helper.pullRequests`).
- `helper.client` is the escape hatch for raw REST calls
  (`client.requestJson(endpoint, { method, body, queryParams })`);
  `helper.config` is the resolved effective config — it contains the token, so
  never log or serialize it.
- Error classes (`BitbucketApiError`, `NetworkError`, `TimeoutError`) and the
  relevant Bitbucket types are re-exported from the same subpath for
  `instanceof` checks and typing.
- Optional tuning: `requestTimeout`, `maxRetries`, `rateLimitDelay` options (or
  `BITBUCKET_REQUEST_TIMEOUT` / `BITBUCKET_MAX_RETRIES` /
  `BITBUCKET_RATE_LIMIT_DELAY`). Caching is always disabled in helper mode.
- The package is ESM-only (`"type": "module"`) — use `import`, not `require`.

## Development

### VSCode Setup (Recommended)

This project includes VSCode workspace settings and extension recommendations. When you open the project in VSCode,
you'll be prompted to install:

- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Markdownlint** - Markdown style checking

All formatting and linting happens automatically on save.

### Development Commands

```bash
# Install dependencies
pnpm install

# Build the project
pnpm run build

# Watch mode for development
pnpm run watch

# Run with local changes
pnpm link --global

# Code quality checks
pnpm run format:all # Format all files
pnpm run lint:all   # Lint all files (markdown + code)
pnpm run typecheck  # Type check with TypeScript
pnpm run validate   # Run all checks (format + lint + typecheck)
```

### Git Hooks

This project uses [Husky](https://typicode.github.io/husky/) for Git hooks to maintain code quality and consistency:

#### Pre-commit Hook

Automatically runs before each commit:

1. **Prettier** - Formats all code
2. **ESLint** - Lints and auto-fixes issues
3. **TypeScript** - Type checks the code
4. **Build** - Ensures project compiles

This ensures all committed code meets quality standards.

#### Commit Message Hook

- Enforces [Conventional Commits](https://www.conventionalcommits.org/) format
- Valid formats: `<type>(<optional-scope>): <description>`
- Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`, `revert`
- Examples:
  - `feat: add user authentication`
  - `fix(auth): resolve login bug`
  - `docs: update README`

#### Pre-push Hook

- Validates branch naming convention
- Allowed patterns:
  - `main`, `master`, `develop`, `dev`
  - `feature/<description>`, `feat/<description>`
  - `bugfix/<description>`, `fix/<description>`
  - `hotfix/<description>`
  - `release/<version>`
  - `chore/<description>`, `docs/<description>`
- Examples:
  - `feature/user-authentication`
  - `fix/login-bug`
  - `release/v1.0.0`

## Project Structure

```plaintext
atlassian-bitbucket-mcp/
├── .husky/              # Git hooks
│   ├── commit-msg       # Conventional commits validation
│   ├── pre-commit       # Code quality checks
│   └── pre-push         # Branch name validation
├── docs/                # Documentation
│   ├── ARCHITECTURE.md  # System architecture and design
│   ├── CODING-STANDARDS.md  # Coding standards and best practices
│   ├── BRANCH-MANAGEMENT.md  # Branch naming and management
│   └── SECURITY.md      # Security policy
├── scripts/             # Utility scripts
│   ├── check-package-security.sh
│   ├── pre-commit.sh    # Pre-commit validation script
│   ├── pre-push.sh      # Pre-push validation script
│   ├── commit-msg.sh    # Commit message validation
│   ├── validate-branch-name.sh  # Branch name validator
│   └── setup-vscode.sh  # VSCode workspace setup
├── types/               # Shared TypeScript type definitions
│   ├── index.ts         # Type re-exports
│   ├── bitbucket.ts     # Bitbucket API types
│   ├── mcp.ts           # MCP protocol types
│   ├── config.ts        # Configuration types
│   ├── cache.ts         # Cache types
│   ├── logger.ts        # Logging types
│   └── common.ts        # Common utility types
├── src/                 # MCP server implementation
│   ├── index.ts         # Entry point
│   ├── server.ts        # MCP server setup
│   ├── config.ts        # Configuration
│   ├── cache.ts         # Caching layer
│   ├── logger.ts        # Centralized logging
│   ├── tools/           # MCP tool implementations
│   └── bitbucket/       # Bitbucket API client
├── openapi/             # OpenAPI specifications (future)
│   ├── bitbucket-cloud.yaml
│   └── bitbucket-server.yaml
├── package.json
├── tsconfig.json
└── README.md
```

## Security

This project follows security best practices:

- All dependencies are checked against known compromised packages
- Minimal dependency footprint
- Regular security audits
- See [docs/SECURITY.md](docs/SECURITY.md) for detailed security policy

### Before Installing Packages

```bash
# Check if a package is safe
./scripts/check-package-security.sh <package-name>
```

## License

This project is licensed under the GNU General Public License v3.0.

## Documentation

For detailed information about this project, see:

- [Architecture Documentation](docs/ARCHITECTURE.md) - System architecture, components, and design decisions
- [Coding Standards](docs/CODING-STANDARDS.md) - TypeScript standards, logging, and best practices
- [Branch Management](docs/BRANCH-MANAGEMENT.md) - Branch naming conventions and workflow
- [Security Policy](docs/SECURITY.md) - Security guidelines and vulnerability reporting

## Contributing

Contributions are welcome! Please ensure:

1. All new dependencies are verified against compromised package lists
2. Code follows the [Coding Standards](docs/CODING-STANDARDS.md)
3. Types use `type` (not `interface`) and are placed in `types/` directory
4. Centralized logger is used at all critical paths
5. OpenAPI YAML files are updated alongside type changes
6. Tests are included for new features
7. Git hooks pass (branch naming, format, lint, typecheck, build)
