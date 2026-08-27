#!/usr/bin/env bash
#
# Install the Bitbucket MCP server as a macOS launchd LaunchAgent that runs the
# Streamable HTTP transport on a loopback port and starts at login.
#
# Idempotent: safe to re-run after a rebuild. Secrets live in a dedicated
# env-file (chmod 600), never in the plist.
#
# Overridable via env:
#   BBMCP_PORT   (default 3900)
#   BBMCP_HOST   (default 127.0.0.1)
#   BBMCP_LABEL  (default com.juspay.bitbucket-mcp)
#   BBMCP_NODE   (path to node; default: newest nvm node >= 22, else `node`)
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${BBMCP_PORT:-3900}"
HOST="${BBMCP_HOST:-127.0.0.1}"
LABEL="${BBMCP_LABEL:-com.juspay.bitbucket-mcp}"
CONFIG_DIR="$HOME/.config/bitbucket-mcp"
ENV_FILE="$CONFIG_DIR/env"
LOG_DIR="$CONFIG_DIR/logs"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

log() { printf '  %s\n' "$*"; }

pick_node() {
  if [ -n "${BBMCP_NODE:-}" ]; then
    echo "$BBMCP_NODE"
    return
  fi
  local nvm_dir="$HOME/.nvm/versions/node" best=""
  if [ -d "$nvm_dir" ]; then
    # prefer a newer Node (>= 22) if one is installed via nvm
    best="$(ls -1 "$nvm_dir" 2> /dev/null \
      | sed -E 's/^v//' \
      | awk -F. '$1>=22' \
      | sort -t. -k1,1n -k2,2n -k3,3n \
      | tail -1)"
    if [ -n "$best" ]; then
      echo "$nvm_dir/v$best/bin/node"
      return
    fi
  fi
  command -v node
}

echo "==> Building + installing globally"
(cd "$REPO" && npm run build > /dev/null && npm i -g . --ignore-scripts > /dev/null)
GROOT="$(npm root -g)"
ENTRY="$GROOT/atlassian-bitbucket-mcp/dist/src/index.js"
[ -f "$ENTRY" ] || {
  echo "entry not found: $ENTRY" >&2
  exit 1
}
log "entry: $ENTRY"

NODE_BIN="$(pick_node)"
[ -x "$NODE_BIN" ] || {
  echo "node not found: $NODE_BIN" >&2
  exit 1
}
log "node:  $NODE_BIN (v$("$NODE_BIN" -v | sed 's/^v//'))"

# NOTE: we deliberately do NOT pass --use-system-ca here. In a background
# launchd context that flag blocks forever on macOS keychain/Security access
# (it only works from an interactive session). For a self-hosted Bitbucket that
# uses an internal CA, set NODE_EXTRA_CA_CERTS in the env-file to a PEM path
# instead — that is a plain file read and works fine under launchd.

echo "==> Preparing config + secrets"
mkdir -p "$CONFIG_DIR" "$LOG_DIR"
if [ ! -f "$ENV_FILE" ]; then
  umask 177
  {
    echo "# Bitbucket MCP service env (loaded via node --env-file). chmod 600."
    echo "MCP_TRANSPORT=http"
    echo "MCP_HTTP_PORT=$PORT"
    echo "MCP_HTTP_HOST=$HOST"
    # Carry over any BITBUCKET_* the repo .env already holds (token included),
    # without printing them to the terminal.
    if [ -f "$REPO/.env" ]; then
      grep -E '^BITBUCKET_[A-Z_]+=' "$REPO/.env" || true
    fi
  } > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  grep -q '^BITBUCKET_URL=' "$ENV_FILE" || echo "BITBUCKET_URL=https://bitbucket.juspay.net" >> "$ENV_FILE"
  grep -q '^BITBUCKET_DEFAULT_PROJECT=' "$ENV_FILE" || echo "BITBUCKET_DEFAULT_PROJECT=BZ" >> "$ENV_FILE"
  grep -q '^BITBUCKET_TOKEN=' "$ENV_FILE" || echo "BITBUCKET_TOKEN=REPLACE_WITH_BBDC_TOKEN" >> "$ENV_FILE"
  {
    echo "# For a self-hosted Bitbucket with an internal CA, point Node at the"
    echo "# CA bundle (a file read; works under launchd, unlike --use-system-ca):"
    echo "# NODE_EXTRA_CA_CERTS=/Users/$(id -un)/.config/bitbucket-mcp/juspay-ca.pem"
  } >> "$ENV_FILE"
  log "created $ENV_FILE (edit it to set BITBUCKET_TOKEN if needed)"
else
  log "kept existing $ENV_FILE"
fi

echo "==> Writing LaunchAgent: $PLIST"
mkdir -p "$(dirname "$PLIST")"
PROG_ARGS="    <string>$NODE_BIN</string>
    <string>--env-file=$ENV_FILE</string>
    <string>$ENTRY</string>"

cat > "$PLIST" << PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
$PROG_ARGS
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ProcessType</key>
  <string>Background</string>
  <key>StandardOutPath</key>
  <string>$LOG_DIR/stdout.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_DIR/stderr.log</string>
</dict>
</plist>
PLIST_EOF

echo "==> (Re)loading launchd job"
launchctl bootout "gui/$(id -u)/$LABEL" 2> /dev/null || true
# RunAtLoad starts it; no kickstart -k (that races the initial spawn).
launchctl bootstrap "gui/$(id -u)" "$PLIST"

echo "==> Verifying"
sleep 2
for _ in $(seq 1 20); do
  if curl -fsS "http://$HOST:$PORT/health" > /dev/null 2>&1; then break; fi
  sleep 0.3
done
if curl -fsS "http://$HOST:$PORT/health"; then
  echo
  echo "OK  MCP HTTP endpoint: http://$HOST:$PORT/mcp"
else
  echo "Service did not answer on http://$HOST:$PORT/health — check $LOG_DIR/stderr.log" >&2
  exit 1
fi
