#!/usr/bin/env bash
# Short demo commands — source once, then type demo-go / demo-wt / demo-fresh
#
#   source demo/demo-env.sh
#   demo-go      # Step 0 — Claude in FIXTURE
#   demo-wt      # Step 7 — git diff in WORKTREE
#   demo-fresh   # Step 8 — fresh Claude in WORKTREE

set -euo pipefail

_DEMO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
_DEMO_CMD="node \"$_DEMO_ROOT/demo/demo-cmd.mjs\""

export CR="$_DEMO_ROOT"
export CLAUDE_RECOVERY_PLUGIN_DIR="${CLAUDE_RECOVERY_PLUGIN_DIR:-$HOME/Downloads/claude-recovery.zip}"

_eval_demo() {
  # shellcheck disable=SC2086
  eval "$_DEMO_CMD $*"
}

demo-go() {
  local fix plugin
  fix="$(_eval_demo fixture)"
  plugin="$(_eval_demo plugin)"
  cd "$fix"
  exec claude --plugin-dir "$plugin"
}

demo-wt() {
  local wt
  wt="$(_eval_demo worktree)"
  cd "$wt"
  git diff --name-only
}

demo-fresh() {
  local wt plugin
  wt="$(_eval_demo worktree)"
  plugin="$(_eval_demo plugin)"
  cd "$wt"
  exec claude --plugin-dir "$plugin"
}

demo-env() {
  cat <<EOF
source demo/demo-env.sh

  demo-go      launch Claude in FIXTURE
  demo-wt      git diff --name-only in WORKTREE (after receipt)
  demo-fresh   fresh Claude in WORKTREE (after demo-wt)
EOF
}

# When executed (not sourced): demo-env.sh go | wt | fresh | print
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  case "${1:-print}" in
    go) demo-go ;;
    wt) demo-wt ;;
    fresh) demo-fresh ;;
    print|env) demo-env ;;
    -h|--help)
      echo "Usage: source demo/demo-env.sh   # then: demo-go | demo-wt | demo-fresh"
      echo "   or: bash demo/demo-env.sh go|wt|fresh|print"
      ;;
    *)
      echo "unknown: $1 (try go, wt, fresh, print)" >&2
      exit 1
      ;;
  esac
fi
