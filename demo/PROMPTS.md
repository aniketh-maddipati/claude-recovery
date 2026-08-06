# Demo cold-read card

One file. Paste/type in order. No coding on camera.

## Setup (off camera)

```bash
cd ~/claude-recovery
npm run demo:reset          # if a rehearsal left commands.jsonl behind
npm run demo:preflight
npm run demo
```

## Directories

| Where | Path |
|-------|------|
| **FIXTURE** (Steps 1–4) | `~/claude-recovery/.demo/auth-service` |
| **WORKTREE** (Steps 5–6) | `~/claude-recovery/.demo/auth-service/.claude/recovery-worktrees/<name-from-receipt>` |

Check: `pwd`

---

## Launch (start Loom, then run)

```bash
cd ~/claude-recovery/.demo/auth-service && claude --plugin-dir ~/claude-recovery
```

Stay in **FIXTURE** until Step 5.

---

## Paste into Claude — FIXTURE (in order)

### 1 — Evidence

```
Run `node --test tests/auth-compat.test.mjs` and show `git diff --stat`.

Do not edit anything. Stop after reporting the observable failure and changed files.
```

### 2 — Recover

```
/claude-recovery:recover
```

### 3 — Decision

```
Keep the compatibility test and expired-token finding.

Reject the AuthProvider interface change and ApiClient migration.

Restart from the clean base, use an adapter, and require the compatibility test before completion.
```

### 4 — Approve

```
Approved. Run approve and finalize as separate steps, then show the compact receipt.
```

Copy the `cd '…' && claude --plugin-dir '…'` line from the receipt.

**Receipt fallback** (paste into Claude if needed):

```
node ~/claude-recovery/scripts/recovery.mjs receipt --manifest .claude/recovery/recovery-manifest.json
```

---

## Type in terminal — WORKTREE

```bash
cd ~/claude-recovery/.demo/auth-service/.claude/recovery-worktrees/<name-from-receipt>
git diff --name-only
```

Expect only:

```text
tests/auth-compat.test.mjs
```

---

## Launch fresh Claude — WORKTREE

Paste the launch line from the receipt (interactive, no `-p`):

```bash
cd '<worktree-from-receipt>' && claude --plugin-dir ~/claude-recovery
```

---

## Paste into Claude — WORKTREE (fresh session)

```
Before editing, summarize the implementation boundary and required verification.
```

Expect: keep `authenticate(token)`, no ApiClient migration, adapter, run compat test.

**Stop.** Do not implement.

---

## Optional say lines (cold read)

```
Mixed attempt — reject the rename, keep the test. Recovering selectively, not rewinding.

Fake mini app: login checker was renamed authenticate → verifyRequest. Useful guardrail test fails. Keeping the test.

Failing test plus diff — that’s the evidence.

Invoking recover.

Keep the test and finding. Reject the migration. Adapter on the next pass.

Contract looks right. Approving.

Only the approved test should differ from the clean base.

Fresh session — summarize the boundary, don’t implement yet.

That’s the handoff. Stopping here.
```

---

## Loom overlays (optional)

```text
The implementation direction is rejected. The test is useful.

Keep the evidence. Reject the migration.

Clean base. Only the approved test carries forward.
```

Recording notes: [`demo/RECORDING.md`](RECORDING.md)
