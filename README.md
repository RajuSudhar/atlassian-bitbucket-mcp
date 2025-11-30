# Atlassian Bitbucket MCP

**Atlassian Bitbucket MCP** is a server for integrating with Bitbucket using the Model Context Protocol (MCP). It provides a structured, type-safe foundation for building tools that interact with Bitbucket repositories, pipelines, and APIs.

## Key Features

- **TypeScript-based**: Strict typing, ES2022 modules, and path aliases for scalable development.
- **Bitbucket API Client**: Pre-built client with retry, caching, and rate-limiting support.
- **Centralized Logging**: Consistent logging with levels and colored output.
- **Environment Configuration**: Validated settings for different deployment environments.
- **Automation & Governance**:
  - Git hooks for commit-message validation, branch naming, pre-commit, and pre-push checks.
  - Scripts to sync package lock files and enforce coding standards.
- **Documentation**: Architecture, coding standards, branch management, security, and package manager guides.

## Project Structure

```tree
src/ # Application source code
dist/ # Compiled output
scripts/ # Automation and validation scripts
docs/ # Project documentation
bin/ # Worker binaries (Go)
```

## Getting Started

1. Clone the repository
2. Install dependencies (`npm install` or `pnpm install`)
3. Run TypeScript build: `npm run build`
4. Follow scripts in `scripts/` for setup and validation

## Contributing

- Branch names must follow the defined pattern (e.g., `feature/<TICKET-ID>-description` or descriptive alternative)
- Commits must follow conventional commit standards
- All changes should be submitted via pull requests

## License

This project is licensed under the GNU General Public License v3.0.
