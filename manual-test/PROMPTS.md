# Manual test prompts (this repo)

## Fast path (~2 min)

**Skip Claude for the mechanical part** (2 seconds):

```bash
cd /Users/aniketh/claude-recovery
node scripts/quick-smoke.mjs
```

That runs capture → finalize → worktree → apply → launch command. No interactive session.

**Minimal Claude test** (2 prompts only):

```bash
node scripts/setup-manual-sandbox.mjs --with-bad-attempt --reset
cd .sandbox/auth-service
claude --plugin-dir /Users/aniketh/claude-recovery
```

Paste **once**:

```text
/claude-recovery:recover

Decision: Keep the compatibility test and expired-token discovery. Reject the API migration. Start from clean base with an adapter. Fresh session.

When I say "approved", run finalize (not four separate commands) and print the launch command only.
```

Then paste:

```text
approved
```

In the recovery worktree, paste **once**:

```text
Use the Recovery Contract. Add request auth via an adapter. Do not change AuthProvider or clients. Run: node --test tests/auth-compat.test.mjs
```

Done.

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
