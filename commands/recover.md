---
name: recover
description: Recover from an untrustworthy Claude Code attempt by preserving chosen code, decisions, and evidence in a clean worktree. Use when the developer invokes /recover or asks to salvage work from a bad attempt.
disable-model-invocation: true
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

Read and follow `${CLAUDE_PLUGIN_ROOT}/skills/recover/SKILL.md` exactly. Execute every step in that file.
