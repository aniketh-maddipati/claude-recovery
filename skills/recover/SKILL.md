---
name: recover
description: Recover from an untrustworthy Claude Code attempt by preserving chosen code, decisions, and evidence in a clean worktree. Use when the developer invokes /recover or asks to salvage work from a bad attempt.
disable-model-invocation: true
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

# /recover — Developer-invoked session recovery

This skill helps the developer recover from an untrustworthy Claude Code attempt.
It does **not** automatically detect failure, rewind sessions, or recover hidden reasoning.
The developer decides what to keep, reject, or change.

## Step 1 — Capture, then inspect

Always snapshot the current observable Git state **before** inspecting:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/recovery.mjs capture
node ${CLAUDE_PLUGIN_ROOT}/scripts/recovery.mjs inspect
```

Read the JSON output. Treat Git diffs, command output, exit codes, and timestamps as **Observed evidence** only — never as automatic semantic verdicts.

## Step 2 — Show a compact current-attempt view

Present a compact summary with these sections. Label every item:

| Section | Label |
|---------|-------|
| Original user request / outcome | Observed evidence |
| Pinned design boundaries (if recorded) | User decision |
| Changed files / interface diff | Observed evidence |
| Tests / verification status | Observed evidence |

Do not claim the attempt is "wrong" — report only what is observable.

## Step 3 — Ask exactly one primary question

Ask the developer:

```text
What should the next attempt keep, reject, or change?
```

**Stop and wait** for their answer before proceeding.

## Step 4 — Write the decision and preview

Turn the developer's answer into a Recovery Contract with this exact structure:

```text
Keep
- original outcome
- user-pinned design boundaries
- selected tests or research
- selected verification evidence
- selected repository base

Discard
- rejected implementation files/patches
- rejected plan or assumption
- current session context, if user chooses fresh continuation

Next
- Git worktree base
- selected patches to apply
- fresh Claude Code or explicit resume/fork choice
- verification command to run
```

Write a decision file to `.claude/recovery/decision.json` capturing:
- `userDecision` (verbatim answer)
- `originalOutcome`
- `pinnedBoundaries` (array)
- `keep` (files, findings, tests)
- `discard` (files, assumptions)
- `next` (baseSha or `"clean-base"`, contextMode, approach, verificationCommand)

Then preview without applying changes:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/recovery.mjs preview --decision-file .claude/recovery/decision.json
```

Show the developer the exact plan (selected/discarded patches, digests, continuation context).
Mark inferred groupings as **Inferred suggestion**, never as fact.

Preview does **not** approve, create a worktree, apply patches, or write an approved pending contract.

## Step 5 — Wait for explicit approval

**Do not** run `approve` or `finalize` until the developer explicitly approves.

When the developer explicitly approves, run these as **separate** commands (never collapse into one implicit operation):

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/recovery.mjs approve \
  --decision-file .claude/recovery/decision.json

node ${CLAUDE_PLUGIN_ROOT}/scripts/recovery.mjs finalize \
  --decision-file .claude/recovery/decision.json \
  --name recovery-<timestamp>
```

Then show the compact receipt:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/recovery.mjs receipt \
  --manifest .claude/recovery/recovery-manifest.json
```

## Step 6 — Manual interactive launch

Print launch instructions:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/recovery.mjs launch-instructions \
  --manifest .claude/recovery/recovery-manifest.json
```

Prefer **`recommendedLaunchCommand`** — a real interactive Claude Code session (no `-p`):

```bash
cd '<worktree>' && claude --plugin-dir '<plugin-root>'
```

The developer runs that command manually. This plugin **cannot** invoke `/clear`, move an existing session, or silently start Claude.

Handoff order:

1. **Primary:** plugin-scoped SessionStart hook injects the approved contract
2. **Optional fallback:** `node ${CLAUDE_PLUGIN_ROOT}/scripts/setup-hooks.mjs` (native `~/.claude/settings.json`)
3. **Headless / non-interactive:** `recommendedLaunchCommandHeadless` (uses `-p`)
4. **Last resort:** paste `recovery-contract.md` manually

Never describe `-p` as launching an interactive session.

## Labels

Preserve the distinction between:

- **Observed evidence** — Git diffs, command output, exit codes, timestamps
- **User decision** — keep / reject / change choices
- **Inferred suggestion** — optional grouping, never fact

## Honest limitations

- Recovery decisions are made by the developer, not inferred automatically.
- Chain-of-thought and hidden reasoning are not recoverable.
- The developer must start Claude Code in the recovery worktree themselves.
- `SessionStart` injects an approved contract via `additionalContext` when `pending-contract.json` exists and is approved.
- Finalize refuses if the decision or plan changed after approval.
