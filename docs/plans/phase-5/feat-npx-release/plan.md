# feat-npx-release

Phase: 5  |  Status: [ ] todo
Depends on: feat-ci
Ref: `claude-ref/packages.md`, `claude-ref/security.md`

## Goal
Publish `atlassian-bitbucket-mcp` to npm with `npx -y` entry working against Claude Desktop.

## In scope
- `bin` entry in `package.json`.
- `prepublishOnly` → validate + build.
- Semantic version tagging.
- CHANGELOG.

## Out of scope
- Remote/HTTP transport release.
- Docker image.

## Design
- `bin`: `{"atlassian-bitbucket-mcp": "dist/index.js"}`.
- Shebang in entry: `#!/usr/bin/env node`.
- `files` whitelist: `dist/`, `README.md`, `LICENSE`. Never `openapi/`, `src/`, `.env*`.
- `publishConfig.access: public`.
- Release via CI on `release/*` branch merge or version tag.

## Tasks
- [ ] `bin` + shebang
- [ ] `prepublishOnly` script
- [ ] `files` whitelist audit
- [ ] manual e2e: `npx -y atlassian-bitbucket-mcp` boots with sample env
- [ ] CHANGELOG.md (keepachangelog format)
- [ ] release workflow

## Definition of done
- [ ] package installs cleanly from npm registry
- [ ] Claude Desktop config snippet in README verified working
- [ ] no secrets or dev files in published tarball (`npm pack --dry-run` audit)
- [ ] TRACK.md updated
