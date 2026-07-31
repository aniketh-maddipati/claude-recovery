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

## Step 1 — Inspect local evidence

Run the recovery helper from the project root (must be a Git repository with at least one commit):

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/recovery.mjs inspect
```

If evidence has not been captured yet in this attempt, also run:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/recovery.mjs capture
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

Wait for their answer before proceeding.

## Step 4 — Build an editable Recovery Contract

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

Show the developer the preview output including continuation context. Mark inferred groupings as **Inferred suggestion**, never as fact.

## Step 5 — Show exact recovery plan

Display clearly (all labels preserved):

1. **Observed evidence** — source SHA (`git rev-parse HEAD` at capture time)
2. **User decision** — selected patch files to keep
3. **User decision** — discarded patch files/hunks
4. **Inferred suggestion** — continuation context text
5. Exact Git worktree command
6. Exact Claude Code launch command (from `launch-instructions`)

Example worktree command shape:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/recovery.mjs create-worktree --base <sha> --name recovery-<timestamp>
```

Get launch instructions:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/recovery.mjs launch-instructions --manifest .claude/recovery/recovery-manifest.json
```

## Step 6 — Require explicit approval

**Do not** create the worktree, apply patches, or write `pending-contract.json` until the developer explicitly approves.

When approved, run in order:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/recovery.mjs approve --decision-file .claude/recovery/decision.json
node ${CLAUDE_PLUGIN_ROOT}/scripts/recovery.mjs create-worktree --base <sha> --name <name>
node ${CLAUDE_PLUGIN_ROOT}/scripts/recovery.mjs apply-selected-patches --manifest .claude/recovery/recovery-manifest.json
node ${CLAUDE_PLUGIN_ROOT}/scripts/recovery.mjs launch-instructions --manifest .claude/recovery/recovery-manifest.json
```

Print the launch command for the developer to run manually. This plugin **cannot** invoke `/clear`, move an existing session, or silently start a new interactive Claude Code session.

## Honest limitations

- Recovery decisions are made by the developer, not inferred automatically.
- Chain-of-thought and hidden reasoning are not recoverable.
- The developer must start Claude Code in the recovery worktree themselves.
- `SessionStart` injects an approved contract via `additionalContext` when `pending-contract.json` exists and is approved.
