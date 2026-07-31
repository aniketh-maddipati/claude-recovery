# Limitations (v0.1.0)

Honest scope boundaries for **claude-recovery**. Read this before relying on the plugin in production workflows.

## What this plugin does not do

- Automatically decide an attempt is wrong
- Recover hidden chain-of-thought or model reasoning
- Determine the last trustworthy point without explicit developer choice
- Detect semantic truth automatically
- Invoke `/clear`, move an existing session, or silently start interactive Claude Code
- Replace Git or act as automatic semantic recovery

The developer makes the recovery decision.

## Requirements

- **Git repository with at least one commit.** Errors state this clearly when missing.
- **Developer manually launches** Claude Code in the recovery worktree using the printed command.

## SessionStart contract injection

`SessionStart` reads `.claude/recovery/pending-contract.json` from the **session cwd**.

- `create-worktree` seeds the approved contract into the recovery worktree for this reason.
- If Claude Code is started outside that worktree, injection will not occur — use the manual paste fallback (`recovery-contract.md`).

**Plugin hook caveat:** [anthropics/claude-code#16538](https://github.com/anthropics/claude-code/issues/16538) reports that plugin `SessionStart` hooks may execute successfully but not surface `hookSpecificOutput.additionalContext` to the model on some Claude Code versions.

**Reliable path (recommended):** run once:

```bash
node /path/to/claude-recovery/scripts/setup-hooks.mjs
```

This mirrors the plugin hooks into native `~/.claude/settings.json`, where SessionStart injection is reported to work.

**Launch without paste:** `launch-instructions` prints a command embedding `recovery-contract.md` via `-p "$(cat .claude/recovery/recovery-contract.md)"`. Manual paste remains the last-resort fallback.

## Evidence capture

Observed evidence is limited to local, machine-readable sources:

| Captured | Not captured |
|----------|--------------|
| Submitted prompts | Write/Edit tool args (unless reflected in Git diff at capture time) |
| Bash commands + output | MCP tool traces (unless Bash-wrapped) |
| Git SHA, status, diff | Remote or cloud session state |
| Timestamps | Chain-of-thought |

Evidence in a recovery worktree starts fresh for the continuation session. Parent attempt evidence remains in the source tree under `.claude/recovery/`.

## Patch selection (v1)

- Selected patches are **whole files** only.
- Manifest structure supports future hunk-level selection; there is no hunk UI in v1.
- Patch apply failures leave an inspectable error file and do not modify the original worktree.

## Headless / scripted Claude (`claude -p`)

- Slash skills may not expand the same way as in interactive mode. Use `skills/recover/SKILL.md` directly in scripts.
- `node scripts/run-manual-test.mjs --claude` requires Claude Code CLI + auth.
- Mechanical tests (`run-manual-test.mjs` without `--claude`, e2e) do not require Claude auth.

## Tested Claude Code versions

- Developed against Claude Code **2.1.x** hook APIs (`hookSpecificOutput.hookEventName`, plugin `hooks/hooks.json` wrapper format).
- Re-test after Claude Code upgrades; hook behavior is not frozen by this plugin.

## Security notes

- Recovery data stays under `.claude/recovery/` locally; nothing is sent remotely by this plugin.
- Only **approved** contracts are injected; unapproved `pending-contract.json` is ignored.
- Original worktree is not modified during recovery setup (worktree + selected patches only).
