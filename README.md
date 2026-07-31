# claude-recovery

A Claude Code plugin that helps developers recover from untrustworthy attempts by preserving chosen code, decisions, and evidence in a clean Git worktree continuation.

**Requires Git with at least one commit.**

## What this is

When a Claude Code attempt becomes untrustworthy, `/recover` helps you:

1. Inspect **observable local evidence** (Git state, commands, test output, timestamps)
2. Decide what to **keep, reject, or change**
3. Review an editable **Recovery Contract**
4. Create an isolated recovery worktree with only selected patches applied
5. Start a fresh Claude Code session with approved continuation context

## What this is not

This plugin does **not**:

- Automatically decide an attempt is wrong
- Recover hidden chain-of-thought
- Determine the last trustworthy point
- Detect semantic truth automatically
- Invoke `/clear`, move sessions, or silently launch interactive Claude Code
- Replace Git or act as automatic semantic recovery

The developer makes the recovery decision.

## Installation (local development)

From this repository root:

```bash
claude --plugin-dir .
```

The recover skill is exposed as `/claude-recovery:recover` (plugin namespace + skill folder name).

## How `/recover` works

1. **Capture & inspect** — hooks record submitted prompts and Bash command evidence under `.claude/recovery/`. Run:

   ```bash
   node scripts/recovery.mjs capture
   node scripts/recovery.mjs inspect
   ```

2. **Review** — Claude shows a compact attempt view labeled as *Observed evidence*, *User decision*, or *Inferred suggestion*.

3. **Decide** — You answer: *What should the next attempt keep, reject, or change?*

4. **Contract** — A Recovery Contract is written to:
   - `.claude/recovery/recovery-contract.md`
   - `.claude/recovery/recovery-manifest.json`

5. **Approve & apply** — After explicit approval:
   - Recovery worktree is created (`git worktree add`)
   - Only selected patches are applied (`git apply` or full-file copy for new files)
   - Original worktree is never modified

6. **Launch manually** — The plugin prints an exact command for you to run:

   ```bash
   node scripts/recovery.mjs launch-instructions --manifest .claude/recovery/recovery-manifest.json
   ```

   When `pending-contract.json` is approved, the `SessionStart` hook injects the contract via `additionalContext`.

## Auth migration scenario (fixture)

The `fixtures/auth-service/` directory demonstrates a bad API migration attempt:

- **Original request:** Add request authentication while preserving `AuthProvider` and avoiding client migration
- **Bad attempt:** Changes `AuthProvider.authenticate()` → `verifyRequest()`, migrates clients
- **Worth keeping:** `tests/auth-compat.test.mjs`, expired-token edge-case finding
- **Recovery choice:** Reject migration, start from clean base, use adapter, fresh session

Run tests to see the full flow exercised against a temporary Git repo.

## What is captured locally

Under `.claude/recovery/` (never sent remotely):

| File | Content |
|------|---------|
| `prompts.jsonl` | Submitted task prompts |
| `commands.jsonl` | Bash commands and output |
| `evidence.json` | Git SHA, status, diff, timestamps |
| `findings.json` | Recorded research/edge-case notes |
| `recovery-manifest.json` | Selected/discarded patches, contract metadata |
| `pending-contract.json` | Approved contract for SessionStart injection |

## What the plugin does not know

- Whether code is semantically correct
- What Claude was "thinking"
- Which commit was "last good" without your explicit base SHA choice
- How to resume or fork your current interactive session programmatically

## Manual step (v1)

After recovery setup, **you** run the displayed launch command in the recovery worktree. The plugin cannot start a new interactive Claude Code session on your behalf.

Example shape:

```bash
cd .claude/recovery-worktrees/recovery-<name> && claude --plugin-dir /path/to/claude-recovery -p "Use the Recovery Contract injected via additionalContext..."
```

If hook injection is unavailable, paste `.claude/recovery/recovery-contract.md` manually.

## Running tests

```bash
node --test tests/recovery.test.mjs
```

## Recovery helper commands

```bash
node scripts/recovery.mjs capture
node scripts/recovery.mjs inspect
node scripts/recovery.mjs preview --decision-file .claude/recovery/decision.json
node scripts/recovery.mjs approve --decision-file .claude/recovery/decision.json
node scripts/recovery.mjs create-worktree --base <sha> --name <name>
node scripts/recovery.mjs apply-selected-patches --manifest .claude/recovery/recovery-manifest.json
node scripts/recovery.mjs launch-instructions --manifest .claude/recovery/recovery-manifest.json
```

## License

MIT — see [LICENSE](LICENSE).
