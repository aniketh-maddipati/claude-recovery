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

## Manual test in this repo

No external project needed. Create a disposable sandbox from the auth fixture:

```bash
cd /Users/aniketh/claude-recovery

# clean base only — you drive the bad attempt with prompts
node scripts/setup-manual-sandbox.mjs

# or seed the bad attempt immediately
node scripts/setup-manual-sandbox.mjs --with-bad-attempt --reset

cd .sandbox/auth-service
claude --plugin-dir /Users/aniketh/claude-recovery
```

Copy-paste prompts: [`manual-test/PROMPTS.md`](manual-test/PROMPTS.md)

Reset the sandbox anytime:

```bash
cd /Users/aniketh/claude-recovery
node scripts/setup-manual-sandbox.mjs --reset
```

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

## End-to-end testing

Proper e2e coverage is **scenario-driven**, not hard-coded to one product example.

Each fixture under `fixtures/<name>/` declares a recovery story:

```text
fixtures/<name>/
  scenario.json          # expectations for the full pipeline
  clean/                 # committed clean base
  bad-attempt/           # overlay after the base commit
  evidence/              # prompt, boundaries, findings
  decision.json          # developer keep/discard/next choices
```

The harness in `tests/harness/scenario-e2e.mjs` runs every discovered scenario through:

`capture → inspect → preview → approve → create-worktree → apply-selected-patches → SessionStart hook → launch-instructions`

Assertions come from `scenario.json` (`keepFiles`, `discardFiles`, worktree contents, continuation fragments, hook/manual fallback checks). The original worktree must remain unchanged.

### Auth golden case

`fixtures/auth-service/` remains the product golden scenario:

- **Original request:** Add request authentication while preserving `AuthProvider` and avoiding client migration
- **Bad attempt:** Changes `AuthProvider.authenticate()` → `verifyRequest()`, migrates clients
- **Worth keeping:** `tests/auth-compat.test.mjs`, expired-token edge-case finding
- **Recovery choice:** Reject migration, start from clean base, use adapter, fresh session

A dedicated test also asserts the **exact** continuation context text for auth.

`fixtures/config-toggle/` is a second minimal scenario proving the harness is not auth-specific.

### Adding a new scenario

1. Copy an existing fixture directory.
2. Fill `clean/`, `bad-attempt/`, `evidence/`, `decision.json`.
3. Write `scenario.json` expectations.
4. Run `node --test tests/recovery.test.mjs` — the new scenario is auto-discovered.

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

## Worktree SessionStart seeding

`SessionStart` reads `.claude/recovery/pending-contract.json` from the **session cwd**. Because the launch command starts Claude inside the recovery worktree, `create-worktree` seeds the approved pending contract (plus `recovery-contract.md`) into that worktree. Leaving the contract only in the source tree causes a silent no-injection.

## Manual step (v1)

After recovery setup, **you** run the displayed launch command in the recovery worktree. The plugin cannot start a new interactive Claude Code session on your behalf.

Example shape:

```bash
cd .claude/recovery-worktrees/recovery-<name> && claude --plugin-dir /path/to/claude-recovery -p "Use the Recovery Contract injected via additionalContext..."
```

If hook injection is unavailable, paste `.claude/recovery/recovery-contract.md` manually.

## Running tests

### Quick smoke (fastest — ~2s, no Claude)

```bash
node scripts/quick-smoke.mjs
```

Runs full mechanical recovery on the auth fixture in one command.

### Deterministic Git e2e (default CI gate)

```bash
node --test tests/recovery.test.mjs
```

This runs the generalized e2e harness for every scenario fixture, plus the auth golden continuation assertion.

### Claude CLI prompt evals (optional regression)

Prompt regressions exercise the `/recover` skill through the real Claude Code CLI in headless mode (`claude -p`). They are **optional**: without the CLI or auth they skip; deterministic Git e2e remains the merge gate.

Install Claude Code and authenticate:

```bash
npm install -g @anthropic-ai/claude-code
# set ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN, or: claude auth login
```

Run:

```bash
node scripts/run-prompt-evals.mjs
node scripts/run-prompt-evals.mjs --case auth-recover-labels
node --test tests/prompt-evals.test.mjs
```

Eval cases live in `evals/cases/*.json` and reuse scenario fixtures (`auth-service` golden + `config-toggle` for generality).

Optional recording/replay for offline scorer checks:

```bash
CLAUDE_RECOVERY_EVAL_RECORD=1 node scripts/run-prompt-evals.mjs
CLAUDE_RECOVERY_EVAL_REPLAY=1 node --test tests/prompt-evals.test.mjs
```

Skip live CLI evals explicitly:

```bash
CLAUDE_RECOVERY_EVAL_SKIP=1 node --test tests/prompt-evals.test.mjs
```

## Recovery helper commands

```bash
node scripts/recovery.mjs capture
node scripts/recovery.mjs inspect
node scripts/recovery.mjs preview --decision-file .claude/recovery/decision.json
node scripts/recovery.mjs finalize --decision-file .claude/recovery/decision.json --name recovery-demo
node scripts/recovery.mjs launch-instructions --manifest .claude/recovery/recovery-manifest.json
```

## License

MIT — see [LICENSE](LICENSE).
