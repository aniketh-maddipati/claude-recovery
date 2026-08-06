# Limitations (v0.1.2)

Honest scope boundaries for **claude-recovery**. Read this before relying on the plugin in production workflows.

## What this plugin does not do

- Automatically decide an attempt is wrong
- Recover hidden chain-of-thought or model reasoning
- Determine the last trustworthy point without explicit developer choice
- Detect semantic truth automatically
- Invoke `/clear`, move an existing session, or silently start interactive Claude Code
- Replace Git or act as automatic semantic recovery
- Supersede Claude Code `/rewind`, `/branch`, `/fork`, or native worktrees

The developer makes the recovery decision. The distinction from Claude’s built-ins is **selective salvage** of developer-approved artifacts into a clean continuation with an explicit Recovery Contract.

## Requirements

- **Git repository with at least one commit.** Errors state this clearly when missing.
- **Developer manually launches** Claude Code in the recovery worktree using the printed interactive command.

## Approval boundary

Finalize never silently approves. The required lifecycle is:

```text
capture → inspect → write decision → preview → approve → finalize → verify → manual launch
```

Changing `decision.json` or the recovery plan after `approve` makes `finalize` refuse before creating a worktree.

## SessionStart contract injection

**Primary path:** plugin-scoped SessionStart hook (`hooks/hooks.json`) reads `.claude/recovery/pending-contract.json` from the **session cwd** and injects approved `additionalContext`.

- `finalize` / `create-worktree` seeds the approved contract into the recovery worktree for this reason.
- If Claude Code is started outside that worktree, injection will not occur — use the manual paste fallback (`recovery-contract.md`).
- Only approved contracts inject; unapproved or malformed pending contracts are ignored and must not crash Claude.
- Injection occurs once (audit record written).

**Optional compatibility fallback:** if plugin SessionStart `additionalContext` does not surface on your Claude Code build ([anthropics/claude-code#16538](https://github.com/anthropics/claude-code/issues/16538)), you may run:

```bash
node /path/to/claude-recovery/scripts/setup-hooks.mjs
```

This installs native hooks into `~/.claude/settings.json`. It is **not** required for normal use and is never run automatically.

**Headless / non-interactive fallback:** `recommendedLaunchCommandHeadless` embeds `recovery-contract.md` via `-p`. This is not an interactive session.

**Last resort:** paste `recovery-contract.md` manually.

## Evidence capture

Observed evidence is limited to local, machine-readable sources:

| Captured | Not captured |
|----------|--------------|
| Submitted prompts | Write/Edit tool args (unless reflected in Git diff at capture time) |
| Bash commands + output | MCP tool traces (unless Bash-wrapped) |
| Git SHA, status, diff | Remote or cloud session state |
| Timestamps | Chain-of-thought |

Evidence in a recovery worktree starts fresh for the continuation session. Parent attempt evidence remains in the source tree under `.claude/recovery/`.

## Demo fixture honesty

The auth-service demo fixture is a **deterministic mixed-attempt overlay**. It is suitable for rehearsal and recording setup. It is not proof that Claude independently violated an instruction. Recording fixtures do not pre-seed `decision.json` or fake `commands.jsonl`.

## Patch selection (v1)

- Selected patches are **whole files** only.
- Manifest structure supports future hunk-level selection; there is no hunk UI in v1.
- Patch apply failures leave an inspectable error file and do not modify the original worktree.
- Finalize runs boundary verification automatically after applying approved patches.

## Headless / scripted Claude (`claude -p`)

- Slash skills may not expand the same way as in interactive mode. Use `skills/recover/SKILL.md` directly in scripts.
- `node scripts/run-manual-test.mjs --claude` requires Claude Code CLI + auth.
- Mechanical tests (`run-manual-test.mjs` without `--claude`, e2e) do not require Claude auth.

## Tested Claude Code versions

- Developed against Claude Code **2.1.x** hook APIs (`hookSpecificOutput.hookEventName`, plugin `hooks/hooks.json` wrapper format).
- Re-test after Claude Code upgrades; hook behavior is not frozen by this plugin.

## Security notes

- Recovery artifacts are written locally under `.claude/recovery/`.
- Captured prompts and Bash output may contain sensitive data — review before sharing.
- Only **approved** contracts are injected; unapproved `pending-contract.json` is ignored.
- Original worktree is not modified during recovery setup (worktree + selected patches only).
- Remove artifacts with `rm -rf .claude/recovery .claude/recovery-worktrees` when finished.
