# claude-recovery

Developer-invoked recovery for untrustworthy Claude Code attempts. Preserves chosen code, decisions, and evidence in a clean Git worktree.

**Version:** 0.1.1 · **License:** MIT · **Claude Code:** 2.1.x

## Plugin structure

```
claude-recovery/
├── .claude-plugin/
│   └── plugin.json          # Plugin manifest (name → skill namespace)
├── skills/
│   └── recover/
│       └── SKILL.md         # /claude-recovery:recover
├── hooks/
│   └── hooks.json           # Evidence capture + SessionStart (plugin hooks)
├── scripts/
│   ├── recovery.mjs         # Recovery CLI
│   ├── session-hook.mjs     # Hook handler (shared by plugin + native hooks)
│   ├── setup-hooks.mjs      # One-time native hook install
│   └── run-manual-test.mjs  # Mechanical + optional Claude CLI tests
└── fixtures/                # Scenario fixtures for e2e tests
```

Component directories live at the **plugin root**, not inside `.claude-plugin/`.

## Requirements

- Claude Code CLI (tested on 2.1.x)
- Git repository with at least one commit
- Node.js 22+ (for helper scripts and tests)

## Install

Load the plugin:

```bash
git clone https://github.com/aniketh-maddipati/claude-recovery.git
claude --plugin-dir /path/to/claude-recovery
```

One-time setup for reliable contract injection (recommended):

```bash
node /path/to/claude-recovery/scripts/setup-hooks.mjs
```

Verify native hooks:

```bash
node /path/to/claude-recovery/scripts/setup-hooks.mjs --check
```

## Skill: `/claude-recovery:recover`

| | |
|---|---|
| **Invoke** | `/claude-recovery:recover` |
| **Namespace** | `claude-recovery` (from `plugin.json` → `name`) |
| **Skill folder** | `skills/recover/` |
| **Model invocation** | Disabled (`disable-model-invocation: true`) — developer must invoke explicitly |
| **Allowed tools** | Bash, Read, Write, Edit, Glob, Grep |

Use when an attempt feels untrustworthy and you want to salvage selected work in a clean Git worktree. The skill does **not** auto-detect failure or rewind sessions — you decide what to keep, reject, or change.

### Skill flow (summary)

1. **Inspect** — `capture` + `inspect` local evidence (Git diff, Bash output, prompts)
2. **Decide** — answer: *What should the next attempt keep, reject, or change?*
3. **Preview** — write `decision.json`, run `preview`, review Recovery Contract
4. **Approve** — explicit approval required before any changes
5. **Finalize** — `finalize` creates worktree, applies selected patches, seeds contract
6. **Launch** — run the printed command in the recovery worktree yourself

Full skill instructions: [`skills/recover/SKILL.md`](skills/recover/SKILL.md)

## Typical workflow

In your project (during `/recover`, or run the CLI directly):

```bash
PLUGIN=/path/to/claude-recovery

node $PLUGIN/scripts/recovery.mjs capture
node $PLUGIN/scripts/recovery.mjs inspect

# after you answer keep/reject/change and approve
node $PLUGIN/scripts/recovery.mjs finalize \
  --decision-file .claude/recovery/decision.json \
  --name recovery-$(date +%s)

node $PLUGIN/scripts/recovery.mjs verify-boundaries \
  --manifest .claude/recovery/recovery-manifest.json

node $PLUGIN/scripts/recovery.mjs launch-instructions \
  --manifest .claude/recovery/recovery-manifest.json
```

Run the **`recommendedLaunchCommand`** from `launch-instructions` (embeds `recovery-contract.md` via `-p`):

```bash
cd /path/to/recovery-worktree && claude --plugin-dir /path/to/claude-recovery \
  -p "$(cat .claude/recovery/recovery-contract.md)"
```

If you ran `setup-hooks.mjs`, you can also use **`recommendedLaunchCommandInteractive`** (no `-p`; SessionStart injects the contract).

v1 applies **whole-file patches only** — no hunk picker.

## Helper commands

| Command | Purpose |
|---------|---------|
| `capture` | Snapshot Git state and file patches |
| `inspect` | Compact labeled attempt view |
| `preview --decision-file <path>` | Build Recovery Contract without applying |
| `finalize --decision-file <path> [--name <name>]` | Approve, create worktree, apply patches, seed contract |
| `verify-boundaries --manifest <path>` | Compare boundary files to base SHA |
| `launch-instructions --manifest <path>` | Print launch commands |
| `setup-hooks.mjs [--check\|--dry-run]` | Install or verify native hooks in `~/.claude/settings.json` |

## Recovery artifacts

All files stay local under `.claude/recovery/` — nothing is sent remotely.

| File | Role |
|------|------|
| `evidence.json` | Captured Git state at inspect time |
| `decision.json` | Your keep/reject/change answer |
| `recovery-contract.md` | Human-readable Recovery Contract (Keep / Discard / Next) |
| `recovery-manifest.json` | Machine-readable handoff (patches, base SHA, worktree path) |
| `pending-contract.json` | Approved contract for SessionStart injection |
| `boundary-verification.json` | Output of `verify-boundaries` |
| `injection-audit.jsonl` | SessionStart injection events |
| `patch-application-errors.json` | Patch failures (original repo untouched) |

## Debugging

### Quick checks

```bash
# Plugin loads?
claude --plugin-dir /path/to/claude-recovery
/help   # look for claude-recovery:recover under Custom commands

# Native hooks installed?
node /path/to/claude-recovery/scripts/setup-hooks.mjs --check

# Mechanical recovery pipeline (~2s, no Claude auth)
node /path/to/claude-recovery/scripts/run-manual-test.mjs

# Inspect current attempt manually
node /path/to/claude-recovery/scripts/recovery.mjs capture
node /path/to/claude-recovery/scripts/recovery.mjs inspect | jq .
```

### Contract not visible in new session?

1. Confirm you launched from the **recovery worktree** (not the source repo):
   ```bash
   ls .claude/recovery/pending-contract.json   # should exist and "approved": true
   ```
2. Check injection ran:
   ```bash
   cat .claude/recovery/injection-audit.jsonl
   # "injectedAt" should be set on pending-contract.json after SessionStart
   ```
3. If plugin hooks silently fail ([#16538](https://github.com/anthropics/claude-code/issues/16538)):
   ```bash
   node /path/to/claude-recovery/scripts/setup-hooks.mjs
   ```
4. **Fallback:** use `recommendedLaunchCommand` (embeds contract via `-p`), or paste `recovery-contract.md` manually.

### Common failures

| Symptom | Check | Fix |
|---------|-------|-----|
| `requires a Git repository with at least one commit` | `git rev-parse HEAD` | `git init && git commit --allow-empty -m init` |
| `Worktree path already exists` | `.claude/recovery-worktrees/` | Use a new `--name` or remove the old worktree |
| `boundary verification failed` | `boundary-verification.json` | Re-run `inspect`; confirm discarded files match base SHA |
| `Patch application failed` | `patch-application-errors.json` | Source tree is safe; inspect patch files under `.claude/recovery/patches/` |
| Skill not listed | Plugin path | Restart Claude with `--plugin-dir`; confirm `skills/recover/SKILL.md` exists |
| `--claude` test fails | Auth + debug | See environment variables below |

### Scripted / headless debugging

For `run-manual-test.mjs --claude` or `--eval`:

```bash
CLAUDE_RECOVERY_DEBUG=1 node scripts/run-manual-test.mjs --claude
# verbose claude -p output; errors also written to:
#   .claude/recovery/last-<stage>-error.txt

CLAUDE_RECOVERY_PLUGIN_DIR=/path/to/claude-recovery node scripts/run-manual-test.mjs --claude
CLAUDE_RECOVERY_EVAL_SKIP=1 node --test tests/prompt-evals.test.mjs   # scorer only, no auth
CLAUDE_RECOVERY_EVAL_RECORD=1 node scripts/run-manual-test.mjs --eval  # record responses
CLAUDE_RECOVERY_EVAL_REPLAY=1 node scripts/run-manual-test.mjs --eval  # replay recordings
```

| Variable | Purpose |
|----------|---------|
| `CLAUDE_RECOVERY_DEBUG=1` | Pass `--debug` to `claude -p` |
| `CLAUDE_RECOVERY_PLUGIN_DIR` | Override plugin root path in scripts |
| `CLAUDE_RECOVERY_SETTINGS_PATH` | Override settings path for `setup-hooks` tests |
| `CLAUDE_RECOVERY_EVAL_SKIP=1` | Skip live prompt evals in CI |
| `CLAUDE_RECOVERY_EVAL_TIMEOUT_MS` | Timeout for headless Claude calls (default 180000) |

### Try the sandbox scenario

```bash
node scripts/setup-manual-sandbox.mjs --with-bad-attempt --reset
cd .sandbox/auth-service
claude --plugin-dir /path/to/claude-recovery
# invoke: /claude-recovery:recover

node scripts/run-manual-test.mjs --print-prompts   # copy-paste prompts from prompts.json
```

Golden scenario: `fixtures/auth-service/` (bad API migration; keep compat test; reject client changes).

### 30-second demo recording

```bash
./demo/run-demo.sh
```

Follow the printed `claude --plugin-dir` command and the shot list in [`demo/RECORDING.md`](demo/RECORDING.md).

## Tests

CI runs on every push:

```bash
node --test tests/recovery.test.mjs
node --test tests/setup-hooks.test.mjs
node scripts/run-manual-test.mjs
CLAUDE_RECOVERY_EVAL_SKIP=1 node --test tests/prompt-evals.test.mjs
```

Optional live skill checks (Claude CLI + auth):

```bash
node scripts/run-manual-test.mjs --eval
node scripts/run-manual-test.mjs --claude
```

Add scenarios under `fixtures/<name>/` with `scenario.json` and `decision.json`.

## Limitations

Not automatic semantic recovery. You launch Claude in the worktree yourself. Whole-file patches only. Bash-only command evidence.

Full scope: [LIMITATIONS.md](LIMITATIONS.md) · Changes: [CHANGELOG.md](CHANGELOG.md)

## License

MIT — see [LICENSE](LICENSE).
