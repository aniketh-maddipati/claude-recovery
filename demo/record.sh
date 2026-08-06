#!/usr/bin/env bash
# One-command recording setup for the auth-service HN cut.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PLUGIN_DIR="${CLAUDE_RECOVERY_PLUGIN_DIR:-$ROOT}"
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
  2. Builds fixture + prints paste/type sequence
  3. Open demo/PROMPTS.md for the teleprompter

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

LAUNCH="cd '$FIXTURE' && claude --plugin-dir '$PLUGIN_DIR'"

cat <<EOF

================================================================
RECORD WITH LOOM — use demo/PROMPTS.md
================================================================

1) Start Loom (single terminal, 16–18 pt)
2) Launch FIXTURE:

  $LAUNCH

3) Follow demo/PROMPTS.md — read SAY lines, paste/type in order
4) Stop after fresh session summarizes the boundary

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
  cd "$FIXTURE"
  exec claude --plugin-dir "$PLUGIN_DIR"
fi
