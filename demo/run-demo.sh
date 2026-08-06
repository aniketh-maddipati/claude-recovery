#!/usr/bin/env bash
# Prepare a disposable auth-service fixture for the HN demo recording.
# Deterministic mixed-attempt overlay — no seeded decision/commands.
# Prints the exact interactive claude launch command for manual recording.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec node "$ROOT/demo/setup-fixture.mjs" --print
