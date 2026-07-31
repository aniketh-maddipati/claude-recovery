#!/usr/bin/env bash
# Prepare a disposable auth-service fixture for the 30-second silent demo.
# Prints the exact claude launch command for manual recording.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec node "$ROOT/demo/setup-fixture.mjs" --print
