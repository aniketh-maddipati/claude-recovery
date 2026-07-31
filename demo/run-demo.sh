#!/usr/bin/env bash
# Prepare a disposable auth-service fixture for the 30-second silent demo.
# Prints the exact claude launch command for manual recording.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN_DIR="${CLAUDE_RECOVERY_PLUGIN_DIR:-$ROOT}"

result="$(node "$ROOT/demo/setup-fixture.mjs")"
fixture="$(printf '%s' "$result" | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync(0,'utf8')).fixture)")"
launch="$(printf '%s' "$result" | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync(0,'utf8')).launchCommand)")"
paste="$(printf '%s' "$result" | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync(0,'utf8')).decisionPaste)")"

cat <<EOF

Demo fixture ready: $fixture

Run this in a terminal with authenticated Claude Code (120% zoom, crop to active pane):

  $launch

Then invoke: /claude-recovery:recover

When asked what to keep/reject/change, paste:

  $paste

Approve the contract preview when shown.

After finalize, run the printed freshClaudeCommand (recommendedLaunchCommandInteractive)
yourself in a new terminal — the plugin cannot start the fresh session for you.

Shot list: demo/RECORDING.md

EOF
