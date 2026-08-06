# Demo cold-read card

One file. Follow **Line-by-line** while recording. No coding on camera.

---

## Setup (off camera)

```bash
cd ~/claude-recovery
npm run demo:reset          # if preflight fails on commands.jsonl
npm run demo:preflight
npm run demo
```

| Where | Path |
|-------|------|
| **FIXTURE** | `~/claude-recovery/.demo/auth-service` |
| **WORKTREE** | `~/claude-recovery/.demo/auth-service/.claude/recovery-worktrees/<name-from-receipt>` |

---

## Line-by-line (exact order)

### Step 0 — Launch

| | |
|---|---|
| **WHERE** | Terminal → **FIXTURE** |
| **TYPE** | `cd ~/claude-recovery/.demo/auth-service && claude --plugin-dir ~/claude-recovery` |
| **SEE** | Claude Code open; `pwd` ends in `.demo/auth-service` |

Start Loom before Step 0.

---

### Step 1 — Intro (optional)

| | |
|---|---|
| **WHERE** | **FIXTURE** (Claude session) |
| **SAY** | Mixed attempt — reject the rename, keep the test. Recovering selectively, not rewinding. |
| **PASTE** | — |
| **SEE** | You in Claude; no recovery receipt yet |

---

### Step 2 — Context (optional)

| | |
|---|---|
| **WHERE** | **FIXTURE** |
| **SAY** | Fake mini app: login checker was renamed authenticate to verifyRequest. Useful guardrail test fails. Keeping the test. |
| **PASTE** | — |
| **SEE** | Same session |

---

### Step 3 — Evidence intro

| | |
|---|---|
| **WHERE** | **FIXTURE** |
| **SAY** | Failing test plus diff — that's the evidence. |
| **PASTE** | — |
| **SEE** | — |

---

### Step 4 — Evidence

| | |
|---|---|
| **WHERE** | **FIXTURE** — paste into Claude |
| **SAY** | *(silent while Claude works)* |
| **PASTE** | |

```
Run `node --test tests/auth-compat.test.mjs` and show `git diff --stat`.

Do not edit anything. Stop after reporting the observable failure and changed files.
```

| **SEE** | Compat test **fails**; diff lists `src/auth/provider.mjs`, `src/clients/api-client.mjs`, `tests/auth-compat.test.mjs` |

**Overlay:** `The implementation direction is rejected. The test is useful.`

---

### Step 5 — Recover intro

| | |
|---|---|
| **WHERE** | **FIXTURE** |
| **SAY** | Invoking recover. |
| **PASTE** | — |
| **SEE** | — |

---

### Step 6 — Recover

| | |
|---|---|
| **WHERE** | **FIXTURE** — paste into Claude |
| **SAY** | *(silent)* |
| **PASTE** | |

```
/claude-recovery:recover
```

| **SEE** | Skill runs; observed evidence; question: *What should the next attempt keep, reject, or change?* |

---

### Step 7 — Decision intro

| | |
|---|---|
| **WHERE** | **FIXTURE** |
| **SAY** | Keep the test and finding. Reject the migration. Adapter on the next pass. |
| **PASTE** | — |
| **SEE** | — |

---

### Step 8 — Decision

| | |
|---|---|
| **WHERE** | **FIXTURE** — paste into Claude |
| **SAY** | *(silent)* |
| **PASTE** | |

```
Keep the compatibility test and expired-token finding.

Reject the AuthProvider interface change and ApiClient migration.

Restart from the clean base, use an adapter, and require the compatibility test before completion.
```

| **SEE** | Recovery Contract preview: **KEEP** test + finding · **DISCARD** provider + client · **NEXT** adapter + run test |

**Overlay:** `Keep the evidence. Reject the migration.`

---

### Step 9 — Approve intro

| | |
|---|---|
| **WHERE** | **FIXTURE** |
| **SAY** | Contract looks right. Approving. |
| **PASTE** | — |
| **SEE** | Contract on screen |

---

### Step 10 — Approve

| | |
|---|---|
| **WHERE** | **FIXTURE** — paste into Claude |
| **SAY** | *(silent)* |
| **PASTE** | |

```
Approved. Run approve and finalize as separate steps, then show the compact receipt.
```

| **SEE** | Receipt: `RECOVERY READY` · Kept `tests/auth-compat.test.mjs` · Boundary `PASS` · Launch line |

Copy the `cd '…' && claude --plugin-dir '…'` line from receipt.

**If no receipt, PASTE into Claude:**

```
node ~/claude-recovery/scripts/recovery.mjs receipt --manifest .claude/recovery/recovery-manifest.json
```

---

### Step 11 — Worktree check intro

| | |
|---|---|
| **WHERE** | Leave **FIXTURE** → go to **WORKTREE** |
| **SAY** | Only the approved test should differ from the clean base. |
| **PASTE** | — |
| **SEE** | — |

---

### Step 12 — Worktree check

| | |
|---|---|
| **WHERE** | Terminal → **WORKTREE** |
| **SAY** | *(silent)* |
| **TYPE** | |

```bash
cd ~/claude-recovery/.demo/auth-service/.claude/recovery-worktrees/<name-from-receipt>
git diff --name-only
```

| **SEE** | Only `tests/auth-compat.test.mjs` |

**Overlay:** `Clean base. Only the approved test carries forward.`

---

### Step 13 — Fresh session intro

| | |
|---|---|
| **WHERE** | Terminal → **WORKTREE** |
| **SAY** | Fresh session — summarize the boundary, don't implement yet. |
| **PASTE** | — |
| **SEE** | — |

---

### Step 14 — Launch fresh Claude

| | |
|---|---|
| **WHERE** | Terminal → **WORKTREE** |
| **SAY** | *(silent)* |
| **TYPE** | Launch line from receipt (no `-p`): |

```bash
cd '<worktree-from-receipt>' && claude --plugin-dir ~/claude-recovery
```

| **SEE** | New Claude session; `pwd` is **WORKTREE**, not FIXTURE |

---

### Step 15 — Fresh session proof

| | |
|---|---|
| **WHERE** | **WORKTREE** — paste into **new** Claude session |
| **SAY** | *(silent)* |
| **PASTE** | |

```
Before editing, summarize the implementation boundary and required verification.
```

| **SEE** | Summary mentions: keep `authenticate(token)` · no ApiClient migration · adapter · run compat test |

---

### Step 16 — Close

| | |
|---|---|
| **WHERE** | **WORKTREE** |
| **SAY** | That's the handoff. Stopping here. |
| **PASTE** | — |
| **SEE** | — |

**Stop Loom.** Do not implement.

---

## Quick copy blocks (paste/type only)

**FIXTURE — paste into Claude:**

```
Run `node --test tests/auth-compat.test.mjs` and show `git diff --stat`.

Do not edit anything. Stop after reporting the observable failure and changed files.
```

```
/claude-recovery:recover
```

```
Keep the compatibility test and expired-token finding.

Reject the AuthProvider interface change and ApiClient migration.

Restart from the clean base, use an adapter, and require the compatibility test before completion.
```

```
Approved. Run approve and finalize as separate steps, then show the compact receipt.
```

**WORKTREE — type in terminal:**

```bash
cd ~/claude-recovery/.demo/auth-service/.claude/recovery-worktrees/<name-from-receipt>
git diff --name-only
```

```bash
cd '<worktree-from-receipt>' && claude --plugin-dir ~/claude-recovery
```

**WORKTREE — paste into new Claude:**

```
Before editing, summarize the implementation boundary and required verification.
```

---

## Loom overlays (optional)

```text
The implementation direction is rejected. The test is useful.

Keep the evidence. Reject the migration.

Clean base. Only the approved test carries forward.
```

Recording notes: [`demo/RECORDING.md`](RECORDING.md)
