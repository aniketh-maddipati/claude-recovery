#!/usr/bin/env bash
# One-command recording setup for the auth-service HN cut.
# Use Loom (not asciinema). Follow demo/SCRIPT.md word for word.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PLUGIN_DIR="${CLAUDE_RECOVERY_PLUGIN_DIR:-$ROOT}"
FIXTURE="$ROOT/.demo/auth-service"
SCRIPT_MD="$ROOT/demo/SCRIPT.md"
LAUNCH_CLAUDE=0

for arg in "$@"; do
  case "$arg" in
    --launch|--claude) LAUNCH_CLAUDE=1 ;;
    -h|--help)
      cat <<'EOF'
Usage: ./demo/record.sh [--launch]

  1. Runs npm run demo:preflight
  2. Builds the auth-service fixture (npm run demo)
  3. Prints Loom steps + the exact Claude launch command
  4. With --launch, starts Claude in the fixture (you still start Loom)

Record with Loom, not asciinema. Open demo/SCRIPT.md as the teleprompter.
EOF
      exit 0
      ;;
  esac
done

echo "==> Preflight"
npm run demo:preflight

echo ""
echo "==> Build auth-service fixture + print paste sequence"
npm run demo

LAUNCH="cd '$FIXTURE' && claude --plugin-dir '$PLUGIN_DIR'"

cat <<EOF

================================================================
RECORD WITH LOOM (not asciinema)
================================================================

Why Loom: you need mic + screen + three short overlays, and Claude Code
is an interactive TUI. asciinema is terminal-only (no voice/overlays) and
is a poor fit for this cut.

Checklist before you hit Record:
  [ ] One terminal window, font 16–18 pt
  [ ] Teleprompter open: $SCRIPT_MD
  [ ] Loom ready (mic on, crop to that terminal)
  [ ] Claude authenticated

1) Start Loom recording (crop to the single terminal).
2) In that terminal, launch Claude:

  $LAUNCH

3) Follow demo/SCRIPT.md top to bottom — say only the quoted lines,
   paste only the marked blocks, stay silent during waits.
4) After "That's the handoff. Stopping here." — stop Loom.
5) Trim model waits; add a small "waits trimmed" note.
6) Overlays (only these three), in order:
     The implementation direction is rejected. The test is useful.
     Keep the evidence. Reject the migration.
     Clean base. Only the approved test carries forward.

Do NOT record: install, preflight, or this setup script.

Teleprompter:  $SCRIPT_MD
Prompts only:  $ROOT/demo/PROMPTS.md
Shot list:     $ROOT/demo/RECORDING.md
================================================================
EOF

if [[ "$LAUNCH_CLAUDE" -eq 1 ]]; then
  if ! command -v claude >/dev/null 2>&1; then
    echo "error: claude not found on PATH" >&2
    exit 1
  fi
  echo ""
  echo "==> Starting Claude in the fixture (start Loom first if you have not)"
  echo "    $LAUNCH"
  cd "$FIXTURE"
  exec claude --plugin-dir "$PLUGIN_DIR"
fi
