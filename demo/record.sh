#!/usr/bin/env bash
# One-command recording setup for the auth-service HN cut.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Build plugin zip"
npm run plugin:zip --silent
PLUGIN_ZIP="$ROOT/dist/claude-recovery.zip"
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

  1. npm run demo:preflight
  2. Builds plugin zip + fixture + prints paste/type sequence
  3. Open demo/PROMPTS.md for the teleprompter

Uses dist/claude-recovery.zip for --plugin-dir (Claude Code 2.1.128+).
Export CLAUDE_RECOVERY_PLUGIN_DIR is set for receipt launch lines.

Record with Loom. Open demo/PROMPTS.md beside the terminal.
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

LAUNCH="demo-go   # after: source demo/demo-env.sh"

cat <<EOF

================================================================
RECORD WITH LOOM — use demo/PROMPTS.md
================================================================

1) Start Loom (single terminal, 16–18 pt)
2) source demo/demo-env.sh
3) demo-go          (Step 0 — Claude in FIXTURE)
4) Follow demo/PROMPTS.md — SAY lines + paste prompts
5) demo-wt            (Step 7 — after receipt)
6) demo-fresh         (Step 8 — boundary summary, then stop)

Teleprompter: $PROMPTS
================================================================
EOF

if [[ "$LAUNCH_CLAUDE" -eq 1 ]]; then
  if ! command -v claude >/dev/null 2>&1; then
    echo "error: claude not found on PATH" >&2
    exit 1
  fi
  echo ""
  echo "==> Starting Claude in FIXTURE (start Loom first if you have not)"
  # shellcheck source=demo/demo-env.sh
  source "$ROOT/demo/demo-env.sh"
  demo-go
fi
