# Manual test prompts (this repo)

## Fast path (~2 min)

**One script — prompts baked in:**

```bash
cd /Users/aniketh/claude-recovery

# mechanical only (~2s, no Claude)
node scripts/run-manual-test.mjs

# full skill prompts via Claude CLI (needs auth)
node scripts/run-manual-test.mjs --claude

# + implement in recovery worktree (slowest)
node scripts/run-manual-test.mjs --claude --implement

# setup sandbox + print prompts JSON for manual paste
node scripts/run-manual-test.mjs --print-prompts
```

Prompts live in `manual-test/prompts.json`. Edit there to change what Claude receives.

**Mechanical-only shortcut:**

```bash
node scripts/quick-smoke.mjs
```

---

## Full path (if you want every step)

Absolute plugin path:

```text
/Users/aniketh/claude-recovery
```

```bash
cd /Users/aniketh/claude-recovery
node scripts/setup-manual-sandbox.mjs --with-bad-attempt --reset
cd .sandbox/auth-service
claude --plugin-dir /Users/aniketh/claude-recovery
```

Reset: `node scripts/setup-manual-sandbox.mjs --reset`

---

## Prompt 1 — original task

```text
Add request authentication while preserving the exported AuthProvider interface and avoiding a client migration.

Non-negotiable:
- Do not change the AuthProvider public API
- Do not require clients to migrate

Please implement it now.
```

## Prompt 2 — force the bad attempt

```text
Ignore the interface constraint for now. Rename authenticate() to verifyRequest(request) and update all client call sites to the new shape. Also add a compatibility test and note any expired-token edge cases you find.
```

Or seed from fixture (skip prompts 1–2):

```bash
node scripts/setup-manual-sandbox.mjs --with-bad-attempt --reset
```

## Prompt 3 — invoke recovery

```text
/claude-recovery:recover
```

## Prompt 4 — recovery decision

```text
Keep the compatibility test and expired-token discovery.
The API migration is rejected.
Start from the clean base and use an adapter.
Do not resume this session.
```

## Prompt 5 — approve

```text
Approved. Run finalize and show the launch command.
```

## Prompt 6 — continue in worktree

```text
Use the Recovery Contract. Implement request auth with an adapter. Run: node --test tests/auth-compat.test.mjs
```
