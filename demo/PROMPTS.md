# Demo prompts (copy-paste)

Primary HN scenario: **auth-service**. Paste these blocks in order during a Loom recording.

For word-for-word narration with scenario context and viewer cues (45–75s teleprompter), use [`demo/SCRIPT.md`](SCRIPT.md).

**Setup:**

```bash
npm run demo:preflight
npm run demo
```

Then run the printed interactive `cd ... && claude --plugin-dir ...` command.

`npm run demo` prints this full sequence. The fixture is a **deterministic mixed-attempt overlay**. It is not live proof of independent instruction violation. `decision.json` and `commands.jsonl` start absent.

---

## Primary scenario — auth-service

### Evidence prompt

```
Run `node --test tests/auth-compat.test.mjs` and show `git diff --stat`.

Do not edit anything. Stop after reporting the observable failure and changed files.
```

### Recovery

```
/claude-recovery:recover
```

### Decision

```
Keep the compatibility test and expired-token finding.

Reject the AuthProvider interface change and ApiClient migration.

Restart from the clean base, use an adapter, and require the compatibility test before completion.
```

### Approval

```
Approved. Run approve and finalize as separate steps, then show the compact receipt.
```

### Fresh-session proof

```
Before editing, summarize the implementation boundary and required verification.
```

Expected themes in the reply:

- preserve `AuthProvider.authenticate(token)`
- no `ApiClient` migration
- use an adapter
- run `node --test tests/auth-compat.test.mjs`

### After finalize (optional receipt / worktree check)

```bash
node /path/to/claude-recovery/scripts/recovery.mjs receipt \
  --manifest .claude/recovery/recovery-manifest.json

# in the recovery worktree
git diff --name-only
```

Interactive launch (you start this manually — no `-p`):

```bash
cd '<worktree>' && claude --plugin-dir '<plugin-root>'
```

---

## Secondary — config-toggle and live simulation

Not part of the primary HN cut.

### config-toggle

```bash
npm run demo:config
```

Decision:

```
Keep the smoke test and default-false finding. Reject the getConfig rename. Fresh session from clean base.
```

Approval and fresh-session prompts match the primary scenario wording above (approve/finalize as separate steps; summarize boundary before editing).

### Live simulation

Use only when you want to create the rejected attempt on camera. Prefer the deterministic fixture for the primary cut.

```bash
npm run demo:live -- auth-service
```

Paste the initial task from the printed instructions. If you need the rejected overlay shape for rehearsal, the printed nudge is **explicit demo setup** — do not imply it happened without instruction. Then run the evidence prompt through Bash, invoke `/claude-recovery:recover`, and continue with the primary recovery prompts.

---

## Recording guardrails

- **You** start the fresh interactive session after finalize.
- Plugin SessionStart is the primary handoff. Native `setup-hooks` is optional.
- Never describe `-p` as interactive.
- If SessionStart is unavailable, stop and report the blocker — do not fake injection.
- Do not pre-seed or describe fake `commands.jsonl` as hook-captured evidence.
