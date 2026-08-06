# claude-recovery

**Status: Beta**

Selective salvage for mixed Claude Code attempts.

Native rewind handles chronological rollback. `claude-recovery` handles
a different case: later work contains both useful and rejected artifacts.

Example: an attempt changes a public API and migrates its clients, but
also produces a useful compatibility test. `/recover` carries the test
into a clean Git worktree, restores the rejected source files, and gives
a fresh session an explicit Recovery Contract.

**Version:** 0.1.2 · **License:** MIT · **Claude Code:** 2.1.x

## When to use it

Use `/rewind` when everything after a checkpoint is disposable.
Use `/branch` or `/fork` when the current work is valid and you want an alternative.
Use `claude-recovery` when the current attempt contains both trusted and rejected work.

| Mechanism | Role |
| --------- | ---- |
| `/rewind` | Chronological rollback to an earlier checkpoint |
| `/branch` / `/fork` | Continue from a conversation branch |
| native worktree | Filesystem isolation |
| `claude-recovery` | Developer-selected whole-file salvage + Recovery Contract |

This is **not** general session recovery. It does not detect that an attempt is wrong, recover hidden reasoning, invoke `/clear`, or launch Claude for you.

## 60-second demo

```text
Failing compat test + git diff
→ /claude-recovery:recover
→ keep test / reject migration
→ approve Recovery Contract
→ clean worktree + fresh session with boundary
```

Record with **Loom** (not asciinema). Cut (30–60s): [`demo/RECORDING.md`](demo/RECORDING.md) · Teleprompter: [`demo/SCRIPT.md`](demo/SCRIPT.md)

## Try the fixture

```bash
npm run demo:preflight
npm run demo
npm run demo:record      # one-script Loom setup (prints launch + checklist)
```

`npm run demo` builds the deterministic `auth-service` mixed-attempt fixture and prints the full interactive prompt sequence. The fixture is a clean base plus rejected overlay plus useful compatibility test — not proof that Claude independently violated an instruction. `decision.json` and `commands.jsonl` stay absent until the real session captures them.

```bash
npm run demo:receipt     # compact receipt after finalize
```

## Install

```bash
git clone https://github.com/aniketh-maddipati/claude-recovery.git
claude --plugin-dir /path/to/claude-recovery
```

1. In a repo with a mixed attempt, run `/claude-recovery:recover`
2. Answer keep / reject / change, review the preview, then explicitly approve
3. Manually launch the printed interactive command in the new worktree

```bash
cd '<worktree>' && claude --plugin-dir '/path/to/claude-recovery'
```

Plugin-scoped SessionStart injects the approved contract. You do not need to install native hooks for the normal path.

### Marketplace install (optional)

```text
/plugin marketplace add aniketh-maddipati/claude-recovery
/plugin install claude-recovery@claude-recovery
```

If marketplace install fails validation in your Claude Code build, use the local `--plugin-dir` path. Do not assume marketplace install works until your CLI accepts the manifest.

## How it works

1. You invoke `/claude-recovery:recover`
2. You explicitly choose what to keep and discard
3. You review a Recovery Contract and approve it
4. The plugin creates a clean Git worktree with only the selected whole-file changes
5. A fresh Claude Code session receives the approved contract via SessionStart

Lifecycle (mechanically enforced):

```text
capture → inspect → write decision → preview → approve → finalize → verify → manual interactive launch
```

Finalize refuses if `decision.json` or the recovery plan changed after approval.

| Field | Meaning |
|-------|---------|
| `recommendedLaunchCommand` | **Interactive** (primary). No `-p`. Developer runs manually. |
| `recommendedLaunchCommandHeadless` | **Headless / non-interactive** fallback using `-p` |

```bash
# interactive (primary)
cd '<worktree>' && claude --plugin-dir '<plugin-root>'

# headless / non-interactive fallback
cd '<worktree>' && claude --plugin-dir '<plugin-root>' \
  -p "$(cat .claude/recovery/recovery-contract.md)"
```

SessionStart handoff:

1. **Primary:** plugin-scoped SessionStart hook (`hooks/hooks.json`)
2. **Optional fallback:** `npm run setup-hooks` → native `~/.claude/settings.json`
3. **Headless `-p`:** deterministic non-interactive fallback
4. **Manual paste:** last resort

Do not automatically modify `~/.claude/settings.json` unless you explicitly run the optional installer.

## Limitations

- Decisions are yours — the plugin does not judge semantic correctness
- No chain-of-thought / hidden reasoning recovery
- Whole-file patches only (v1)
- Bash-only command evidence
- You launch Claude in the recovery worktree yourself
- Does not supersede `/rewind`, `/branch`, `/fork`, or native worktrees

Full scope: [LIMITATIONS.md](LIMITATIONS.md)

## Security

Recovery artifacts are written **locally** under `.claude/recovery/`.

| Artifact | Contents |
|----------|----------|
| `prompts.jsonl` | Submitted prompts |
| `commands.jsonl` | Bash commands + stdout/stderr |
| `evidence.json` | Git SHA, status, diff |
| `decision.json` | Your keep/reject/change answer |
| `recovery-contract.md` / `pending-contract.json` | Approved handoff text |

**Warning:** prompts and Bash output may contain secrets, tokens, or personal data. Review before sharing a worktree or screen recording.

```bash
rm -rf .claude/recovery .claude/recovery-worktrees
```

Only **approved** contracts are injected at SessionStart. Unapproved or malformed pending contracts are ignored and must not crash Claude.

## Beta feedback

This is a public beta. File feedback with the [beta feedback issue template](https://github.com/aniketh-maddipati/claude-recovery/issues/new?template=beta-feedback.yml). Sanitize prompts, command output, source code, and tokens before attaching logs. No telemetry is collected.

Show HN draft: [`docs/SHOW_HN.md`](docs/SHOW_HN.md)

## Technical reference

### Requirements

- Claude Code CLI (tested on 2.1.x)
- Git
- Node.js 22+

No `npm install` is required. Zero runtime/development npm dependencies; Node built-ins only.

### Typical CLI workflow

```bash
PLUGIN=/path/to/claude-recovery

node $PLUGIN/scripts/recovery.mjs capture
node $PLUGIN/scripts/recovery.mjs inspect

# after you answer keep/reject/change
node $PLUGIN/scripts/recovery.mjs preview --decision-file .claude/recovery/decision.json
# explicit approval required
node $PLUGIN/scripts/recovery.mjs approve --decision-file .claude/recovery/decision.json
node $PLUGIN/scripts/recovery.mjs finalize \
  --decision-file .claude/recovery/decision.json \
  --name recovery-$(date +%s)

node $PLUGIN/scripts/recovery.mjs receipt \
  --manifest .claude/recovery/recovery-manifest.json
```

### Local commands

```bash
npm run check:node
npm test
npm run demo
npm run demo:preflight
npm run demo:receipt
npm run sandbox
npm run setup-hooks          # optional native-hook fallback
npm run setup-hooks:check
```

| Script | Purpose |
|--------|---------|
| `npm test` | Unit, demo, mechanical e2e, prompt-eval harness |
| `npm run demo` | Build `.demo/auth-service` and print the full demo sequence |
| `npm run demo:record` | One-script Loom recording setup (`demo/record.sh`) |
| `npm run demo:preflight` | Machine checks before recording |
| `npm run demo:receipt` | Compact human-readable finalize receipt |
| `npm run sandbox` | Reset `.sandbox/auth-service` for manual `/recover` |
| `npm run setup-hooks` | Optional native SessionStart fallback |

### Skill: `/claude-recovery:recover`

| | |
|---|---|
| **Invoke** | `/claude-recovery:recover` |
| **Namespace** | `claude-recovery` |
| **Model invocation** | Disabled — developer must invoke explicitly |

Flow: capture → inspect → one keep/reject/change question → decision → preview → explicit approve → finalize → compact receipt → manual interactive launch.

Full instructions: [`skills/recover/SKILL.md`](skills/recover/SKILL.md)

### Helper commands

| Command | Purpose |
|---------|---------|
| `capture` | Snapshot Git state and file patches |
| `inspect` | Compact labeled attempt view |
| `preview --decision-file <path>` | Unapproved plan + digests (no worktree) |
| `approve --decision-file <path>` | Mark exact decision/plan approved |
| `finalize --decision-file <path> [--name <name>]` | Create worktree, apply frozen patches, verify boundaries |
| `receipt --manifest <path>` | Compact human-readable receipt |
| `verify-boundaries --manifest <path>` | Compare boundary files to base SHA |
| `launch-instructions --manifest <path>` | Print interactive + headless launch commands |
| `setup-hooks.mjs` | Optional native-hook fallback |

### Recovery artifacts

All files stay local under `.claude/recovery/`.

| File | Role |
|------|------|
| `evidence.json` | Captured Git state |
| `decision.json` | Your keep/reject/change answer |
| `recovery-contract.md` | Human-readable Recovery Contract |
| `recovery-manifest.json` | Machine-readable handoff + digests |
| `pending-contract.json` | Approved contract for SessionStart |
| `boundary-verification.json` | Finalize boundary report |
| `injection-audit.jsonl` | SessionStart injection events |
| `patch-application-errors.json` | Patch failures (source tree untouched) |

### Plugin structure

```
claude-recovery/
├── package.json
├── .claude-plugin/
│   ├── plugin.json
│   └── marketplace.json
├── skills/recover/SKILL.md
├── hooks/hooks.json
├── scripts/recovery.mjs
├── scripts/session-hook.mjs
├── scripts/setup-hooks.mjs      # optional native fallback
├── demo/
└── fixtures/
```

Component directories live at the **plugin root**, not inside `.claude-plugin/`.

### Debugging

```bash
claude --plugin-dir /path/to/claude-recovery
/help   # look for claude-recovery:recover

node /path/to/claude-recovery/scripts/run-manual-test.mjs
node /path/to/claude-recovery/scripts/recovery.mjs capture
node /path/to/claude-recovery/scripts/recovery.mjs inspect | jq .
```

#### Contract not visible in new session?

1. Confirm you launched from the **recovery worktree**
2. Check `.claude/recovery/pending-contract.json` has `"approved": true`
3. Check `injection-audit.jsonl` for a SessionStart entry
4. Optional: `node scripts/setup-hooks.mjs` (native fallback)
5. Headless fallback: `recommendedLaunchCommandHeadless` (uses `-p`)
6. Last resort: paste `recovery-contract.md`

#### Environment variables

| Variable | Purpose |
|----------|---------|
| `CLAUDE_RECOVERY_DEBUG=1` | Pass `--debug` to `claude -p` in scripted tests |
| `CLAUDE_RECOVERY_PLUGIN_DIR` | Override plugin root path |
| `CLAUDE_RECOVERY_SETTINGS_PATH` | Override settings path for setup-hooks tests |
| `CLAUDE_RECOVERY_EVAL_SKIP=1` | Skip live prompt evals in CI |

### Tests

```bash
npm test
```

```bash
node --test tests/recovery.test.mjs
node --test tests/setup-hooks.test.mjs
node --test tests/demo.test.mjs
node scripts/run-manual-test.mjs
CLAUDE_RECOVERY_EVAL_SKIP=1 node --test tests/prompt-evals.test.mjs
```

## License

MIT — see [LICENSE](LICENSE). · Changes: [CHANGELOG.md](CHANGELOG.md)
