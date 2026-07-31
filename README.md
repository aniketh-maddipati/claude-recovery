# claude-recovery

A Claude Code plugin with one developer-invoked action: `/recover`. When an attempt feels untrustworthy, it helps you inspect local evidence, write down what to keep or reject, and continue in a clean Git worktree.

**Requires:** Git with at least one commit.

**Status:** v0.1.1. Tested manually against Claude Code 2.1.x. Not a marketplace plugin yet.

Full scope and caveats: [LIMITATIONS.md](LIMITATIONS.md).

## What it does

1. Records local evidence (prompts, Bash output, Git state) under `.claude/recovery/`.
2. Guides you through `/claude-recovery:recover` to review that evidence and answer one question: *What should the next attempt keep, reject, or change?*
3. Writes a Recovery Contract you must approve before anything is applied.
4. Creates an isolated worktree, applies only the file patches you selected, and leaves the original tree untouched.
5. Prints the exact command for you to start Claude Code in the worktree.

Evidence is labeled **Observed evidence**, **User decision**, or **Inferred suggestion**. Only the first category is treated as factual input from the machine.

## What it does not do

- Decide that an attempt is wrong
- Recover chain-of-thought or pick the "last good" point for you
- Invoke `/clear`, move your session, or start interactive Claude Code on your behalf
- Replace Git

You make the recovery decision. The plugin handles the handoff.

SessionStart contract injection works best with **native hooks**. Plugin hooks may not surface `additionalContext` on some Claude Code builds ([#16538](https://github.com/anthropics/claude-code/issues/16538)).

**Recommended one-time setup:**

```bash
node /path/to/claude-recovery/scripts/setup-hooks.mjs
```

This installs the same hook script into `~/.claude/settings.json`, where SessionStart injection is reliable.

**Launch without paste:** `launch-instructions` prints a command that embeds `recovery-contract.md` via `-p "$(cat ...)"`. Manual paste remains the last-resort fallback.

## Install

From this repository:

```bash
claude --plugin-dir /path/to/claude-recovery
node /path/to/claude-recovery/scripts/setup-hooks.mjs   # one-time, reliable contract injection
```

Skill: `/claude-recovery:recover`

## Typical flow

```bash
# in your project (during /recover, or directly)
node /path/to/claude-recovery/scripts/recovery.mjs capture
node /path/to/claude-recovery/scripts/recovery.mjs inspect

# after you answer the keep/reject/change question and approve
node /path/to/claude-recovery/scripts/recovery.mjs finalize \
  --decision-file .claude/recovery/decision.json \
  --name recovery-$(date +%s)

node /path/to/claude-recovery/scripts/recovery.mjs verify-boundaries \
  --manifest .claude/recovery/recovery-manifest.json

node /path/to/claude-recovery/scripts/recovery.mjs launch-instructions \
  --manifest .claude/recovery/recovery-manifest.json
```

Then run the printed `cd ... && claude ...` command yourself in the recovery worktree.

v1 applies **whole-file patches only**. There is no hunk picker.

## Try it in this repo

No external project required:

```bash
node scripts/run-manual-test.mjs              # ~2s, mechanical only (ephemeral)
node scripts/run-manual-test.mjs --sandbox    # persistent .sandbox/ for cd + claude
node scripts/setup-manual-sandbox.mjs --with-bad-attempt --reset
cd .sandbox/auth-service && claude --plugin-dir ..
```

Prompts for interactive runs: `node scripts/run-manual-test.mjs --print-prompts` (source: `manual-test/prompts.json`).

Example scenario: `fixtures/auth-service/` (bad API migration; keep compat test; reject client changes).

## Tests

CI runs these on every push:

```bash
node --test tests/recovery.test.mjs
node scripts/run-manual-test.mjs
CLAUDE_RECOVERY_EVAL_SKIP=1 node --test tests/prompt-evals.test.mjs
```

Optional live skill checks (need Claude Code CLI + auth):

```bash
node scripts/run-manual-test.mjs --eval
node scripts/run-manual-test.mjs --claude
```

Add scenarios under `fixtures/<name>/` with `scenario.json` and `decision.json`. The e2e harness auto-discovers them.

## Helper commands

| Command | Purpose |
|---------|---------|
| `capture` | Snapshot Git state and patches |
| `inspect` | Compact attempt view |
| `preview` | Build contract without applying |
| `finalize` | Approve, worktree, apply, seed contract |
| `verify-boundaries` | Compare boundary files to base SHA |
| `launch-instructions` | Print manual launch command |
| `setup-hooks.mjs` | One-time native hook install for reliable SessionStart |

## Files worth knowing

| Path | Role |
|------|------|
| `.claude/recovery/evidence.json` | Captured Git state |
| `.claude/recovery/recovery-contract.md` | Human-readable contract |
| `.claude/recovery/recovery-manifest.json` | Machine-readable handoff |
| `.claude/recovery/pending-contract.json` | Approved contract for SessionStart |

All stay local. Nothing is sent remotely by this plugin.

## License

MIT. See [LICENSE](LICENSE). Changes: [CHANGELOG.md](CHANGELOG.md).
