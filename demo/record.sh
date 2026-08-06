#!/usr/bin/env bash
# One-command recording setup for the auth-service HN cut.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Build plugin zip → ~/Downloads/claude-recovery.zip"
npm run plugin:zip --silent
PLUGIN_ZIP="${CLAUDE_RECOVERY_PLUGIN_ZIP:-$HOME/Downloads/claude-recovery.zip}"
PLUGIN_DIR="${CLAUDE_RECOVERY_PLUGIN_DIR:-$PLUGIN_ZIP}"
export CLAUDE_RECOVERY_PLUGIN_DIR="$PLUGIN_DIR"
FIXTURE="$ROOT/.demo/auth-service"
PROMPTS="$ROOT/demo/PROMPTS.md"
LAUNCH_CLAUDE=0

for arg in "$@"; do
  case "$arg" in
    --launch|--claude) LAUNCH_CLAUDE=1 ;;
    -h|--help)
      cat <<'EOF'
Usage: ./demo/record.sh [--launch]

  1. Builds ~/Downloads/claude-recovery.zip
  2. npm run demo:preflight + fixture
  3. Prints commands — see demo/PROMPTS.md

Record with Loom.
EOF
      exit 0
      ;;
  esac
done

echo "==> Preflight"
npm run demo:preflight

echo ""
echo "==> Build fixture"
npm run demo

cat <<EOF

================================================================
RECORD WITH LOOM — demo/PROMPTS.md
================================================================

export CLAUDE_RECOVERY_PLUGIN_DIR="$PLUGIN_DIR"

cd "$FIXTURE" && claude --plugin-dir "\$CLAUDE_RECOVERY_PLUGIN_DIR"

Then follow demo/PROMPTS.md (slash /claude-recovery:recover at step 4)

Plugin zip: $PLUGIN_ZIP
Teleprompter: $PROMPTS
================================================================
EOF

if [[ "$LAUNCH_CLAUDE" -eq 1 ]]; then
  if ! command -v claude >/dev/null 2>&1; then
    echo "error: claude not found on PATH" >&2
    exit 1
  fi
  echo ""
  echo "==> Starting Claude in FIXTURE"
  cd "$FIXTURE"
  exec claude --plugin-dir "$PLUGIN_DIR"
fi
