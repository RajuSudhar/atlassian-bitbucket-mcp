# Atlassian Bitbucket MCP Server

A Model Context Protocol (MCP) server that enables AI assistants to interact with Atlassian Bitbucket for
pull request reviews, code search, and repository operations.

## Features

- **Pull Request Management**: Review PRs, add/resolve comments, approve changes
- **Code Search**: Search code across repositories and commits
- **Repository Operations**: List repos, browse branches, view file content
- **Dual Instance Support**: Works with both Bitbucket Cloud and self-hosted Data Center/Server
- **Secure**: Built with security in mind, avoiding compromised npm packages
- **Type-Safe**: Full TypeScript implementation with strict type checking
- **Caching**: Smart caching layer for frequently accessed static data
- **Local-First**: Designed for NPX-based local usage with Personal Access Tokens

## Requirements

- Node.js >= 20.0.0
- pnpm (recommended) or npm/yarn
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
BITBUCKET_URL=https://bitbucket.org # or your self-hosted URL
BITBUCKET_TOKEN=your_personal_access_token
BITBUCKET_DEFAULT_PROJECT=PROJ # your default project key
```

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
        "BITBUCKET_URL": "https://bitbucket.org",
        "BITBUCKET_TOKEN": "your_token_here",
        "BITBUCKET_DEFAULT_PROJECT": "PROJ"
      }
    }
  }
}
```

## Configuration

### Environment Variables

All configuration is done through environment variables. See [`.env.example`](./.env.example) for the complete list.

#### Required

- `BITBUCKET_URL` - Your Bitbucket instance URL
- `BITBUCKET_TOKEN` - Personal Access Token
- `BITBUCKET_DEFAULT_PROJECT` - Default project key

#### Optional

- `BITBUCKET_ALLOWED_ACTIONS` - Comma-separated list of allowed tool actions
- `BITBUCKET_CACHE_ENABLED` - Enable/disable caching (default: true)
- `BITBUCKET_CACHE_TTL_REPOS` - Repository cache TTL in seconds (default: 3600)
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

## Available MCP Tools

This server provides the following tools for interacting with Bitbucket:

### Pull Request Tools

- `bitbucket_list_pull_requests` - List PRs for a repository
- `bitbucket_get_pull_request` - Get detailed PR information
- `bitbucket_get_pr_diff` - Get PR changes/diff
- `bitbucket_get_pr_commits` - Get commits in a PR
- `bitbucket_get_pr_activities` - Get PR comments and activities
- `bitbucket_add_pr_comment` - Add a general comment
- `bitbucket_add_pr_inline_comment` - Add inline code comment
- `bitbucket_reply_to_comment` - Reply to a comment
- `bitbucket_resolve_comment` - Resolve a comment thread
- `bitbucket_update_comment` - Edit a comment
- `bitbucket_approve_pr` - Approve a pull request

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
