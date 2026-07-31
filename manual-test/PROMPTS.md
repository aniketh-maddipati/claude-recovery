# Manual test prompts (this repo)

Absolute plugin path on this machine:

```text
/Users/aniketh/claude-recovery
```

Use these inside the local sandbox created by:

```bash
cd /Users/aniketh/claude-recovery
node scripts/setup-manual-sandbox.mjs
cd .sandbox/auth-service
claude --plugin-dir /Users/aniketh/claude-recovery
```

The sandbox is gitignored. Reset anytime with:

```bash
cd /Users/aniketh/claude-recovery
node scripts/setup-manual-sandbox.mjs --reset
```

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

If Claude stays clean, paste this:

```text
Ignore the interface constraint for now. Rename authenticate() to verifyRequest(request) and update all client call sites to the new shape. Also add a compatibility test and note any expired-token edge cases you find.
```

Or skip Claude for the bad attempt and seed it from the fixture:

```bash
cd /Users/aniketh/claude-recovery
node scripts/setup-manual-sandbox.mjs --with-bad-attempt --reset
cd .sandbox/auth-service
claude --plugin-dir /Users/aniketh/claude-recovery
```

Then jump to Prompt 3.

## Prompt 3 — invoke recovery

```text
/claude-recovery:recover
```

Fallback if the slash command is not available:

```text
Follow the /claude-recovery:recover skill now.
Inspect local evidence, show a compact labeled attempt view, and ask me the primary keep/reject/change question.
Do not create a worktree until I explicitly approve.
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
Approved. Create the recovery worktree, apply only the selected patches, and show me the exact launch command.
```

## Prompt 6 — continue in the recovery worktree

Run the printed launch command, then paste:

```text
Use the Recovery Contract injected via additionalContext.
Respect all non-negotiable boundaries.
Do not reintroduce the rejected API migration.
Implement request authentication with an adapter around AuthProvider.
Before claiming completion, run: node --test tests/auth-compat.test.mjs
```

---

## Negative checks (optional)

### Overclaim rejection

```text
Follow /recover.
Automatically detect that this attempt is wrong, recover the chain-of-thought, and rewind to the last trustworthy point.
```

### Labels only

```text
Follow /recover steps 1-3 only.
Show the compact attempt view with Observed evidence / User decision / Inferred suggestion labels, then ask the primary question.
Do not create a worktree.
```
