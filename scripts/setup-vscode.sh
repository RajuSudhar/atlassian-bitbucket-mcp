#!/usr/bin/env bash

# VSCode Workspace Setup Script
# Configures VSCode settings and installs recommended extensions

echo "VSCode Workspace Setup"
echo "====================="
echo ""

# Check if VSCode is installed
if ! command -v code > /dev/null 2>&1; then
  echo "WARNING: VSCode 'code' command not found in PATH"
  echo "Please install VSCode command line tools:"
  echo "  1. Open VSCode"
  echo "  2. Press Cmd+Shift+P (Mac) or Ctrl+Shift+P (Windows/Linux)"
  echo "  3. Type 'shell command' and select 'Install code command in PATH'"
  echo ""
  exit 1
fi

# Ask for user consent
echo "This script will:"
echo "  1. Create .vscode/ directory with workspace settings"
echo "  2. Install recommended VSCode extensions:"
echo "     - ESLint (dbaeumer.vscode-eslint)"
echo "     - Prettier (esbenp.prettier-vscode)"
echo "     - Markdownlint (DavidAnson.vscode-markdownlint)"
echo ""
read -p "Do you want to proceed? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Setup cancelled."
  exit 0
fi

echo ""
echo "Setting up VSCode workspace..."
echo ""

# Create .vscode directory if it doesn't exist
mkdir -p .vscode

# Create settings.json
echo "[1/3] Creating workspace settings..."
cat > .vscode/settings.json << 'EOF'
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.fixAll.markdownlint": "explicit"
  },
  "eslint.validate": ["javascript", "javascriptreact", "typescript", "typescriptreact"],
  "eslint.format.enable": false,
  "prettier.requireConfig": true,
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "[markdown]": {
    "editor.defaultFormatter": "DavidAnson.vscode-markdownlint",
    "editor.formatOnSave": true,
    "editor.wordWrap": "on",
    "files.trimTrailingWhitespace": false
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[json]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[jsonc]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
EOF

# Create extensions.json
cat > .vscode/extensions.json << 'EOF'
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "DavidAnson.vscode-markdownlint"
  ]
}
EOF

echo "SUCCESS: Workspace settings created"
echo ""

# Install extensions
echo "[2/3] Installing VSCode extensions..."
echo ""

extensions=(
  "dbaeumer.vscode-eslint"
  "esbenp.prettier-vscode"
  "DavidAnson.vscode-markdownlint"
)

for ext in "${extensions[@]}"; do
  echo "Installing $ext..."
  code --install-extension "$ext" --force
done

echo ""
echo "SUCCESS: Extensions installed"
echo ""

# Add .vscode to .gitignore if not already there
echo "[3/3] Updating .gitignore..."
if ! grep -q "^\.vscode/$" .gitignore 2> /dev/null; then
  echo "" >> .gitignore
  echo "# VSCode workspace settings (user-specific)" >> .gitignore
  echo ".vscode/" >> .gitignore
  echo "SUCCESS: Added .vscode/ to .gitignore"
else
  echo "INFO: .vscode/ already in .gitignore"
fi

echo ""
echo "=========================================="
echo "VSCode workspace setup complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Reload VSCode window (Cmd+Shift+P > Reload Window)"
echo "  2. All formatting and linting will happen automatically on save"
echo ""
