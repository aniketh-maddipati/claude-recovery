# Demo script — say this / paste that

Use this while recording. Relaxed tone. Do not improvise the paste blocks.

**Before you hit record** (not in the final cut):

```bash
npm run demo:preflight
npm run demo
```

Copy the printed launch command, open one terminal (16–18 pt), start Claude:

```bash
cd /path/to/claude-recovery/.demo/auth-service && claude --plugin-dir /path/to/claude-recovery
```

Have this file open side-by-side. Trim long model waits in edit; add a small “waits trimmed” note.

---

## Beat sheet (~68s)

| Time | You say (approx.) | You paste / type |
|------|-------------------|------------------|
| 0–8s | Opening + problem | Evidence prompt |
| 8–18s | “I’m going to recover…” | `/claude-recovery:recover` |
| 18–27s | “Keep the test, reject the migration” | Decision block |
| 27–39s | “Here’s the contract…” | *(watch preview — no paste)* |
| 39–49s | “Approve that” | Approval line |
| 49–55s | “Only the test came forward” | `git diff --name-only` |
| 55–68s | “Fresh session got the boundary” | Fresh-session proof |

Overlays only (add in Loom):

1. `The implementation direction is rejected. The test is useful.`
2. `Keep the evidence. Reject the migration.`
3. `Clean base. Only the approved test carries forward.`

---

## Line-by-line

### 0–8s — show the mixed attempt

**SAY** (calm, not salesy):

> Okay — so Claude already tried something here. It changed the auth API and started migrating clients, but it also left a useful compatibility test. I’m not going to keep the migration. I do want the test.

**PASTE** into Claude:

```
Run `node --test tests/auth-compat.test.mjs` and show `git diff --stat`.

Do not edit anything. Stop after reporting the observable failure and changed files.
```

**WAIT** until the failing test and diff stat are visible.

**OVERLAY 1:** `The implementation direction is rejected. The test is useful.`

**SAY** (optional, short, while it finishes):

> Yeah — test fails, and you can see the provider and client files changed.

---

### 8–18s — start recovery

**SAY:**

> So instead of rewinding everything away, I’m going to recover — keep what I trust, drop what I don’t.

**TYPE / PASTE:**

```
/claude-recovery:recover
```

**WAIT** for observed evidence + the keep/reject/change question.

**SAY** (while evidence scrolls, soft):

> It’s just showing me what it saw — the files, the failing test. Now it asks what to keep.

---

### 18–27s — decide

**SAY:**

> Keep the compatibility test and the expired-token finding. Reject the AuthProvider change and the ApiClient migration. Restart clean, use an adapter, and make that test required.

**PASTE** exactly:

```
Keep the compatibility test and expired-token finding.

Reject the AuthProvider interface change and ApiClient migration.

Restart from the clean base, use an adapter, and require the compatibility test before completion.
```

**OVERLAY 2:** `Keep the evidence. Reject the migration.`

---

### 27–39s — contract preview

**SAY** (no paste — point at the screen):

> And this is the Recovery Contract. Keep the test. Discard the provider and client changes. Next attempt starts from the clean base with an adapter.

Pause on KEEP / DISCARD / NEXT if those labels are on screen. Prefer the readable contract over raw JSON.

**If Claude asks whether to proceed, wait — do not approve until the next beat.**

---

### 39–49s — approve + receipt

**SAY:**

> Looks right. Approving — approve and finalize as separate steps, then show the receipt.

**PASTE:**

```
Approved. Run approve and finalize as separate steps, then show the compact receipt.
```

**WAIT** for compact receipt (`RECOVERY READY`, Kept, Boundary verification PASS, Launch manually).

**SAY** (short):

> Boundary check passed. Only the approved file should carry forward.

If Claude does not print the receipt, run this in the **fixture** repo (same tab is fine if still there):

```bash
node /path/to/claude-recovery/scripts/recovery.mjs receipt \
  --manifest .claude/recovery/recovery-manifest.json
```

Copy the `cd '…' && claude --plugin-dir '…'` launch line from the receipt — you need it next.

---

### 49–55s — prove the worktree

**SAY:**

> Jumping into the recovery worktree — this should be a clean base plus just that test.

**In the recovery worktree terminal**, paste the launch command from the receipt first if you are not already there, or open a second pane in the *same* window only if you must — prefer one window:

```bash
cd '<worktree-from-receipt>'
git diff --name-only
```

Expected output:

```text
tests/auth-compat.test.mjs
```

**OVERLAY 3:** `Clean base. Only the approved test carries forward.`

**SAY:**

> Yep — just the compatibility test.

---

### 55–68s — fresh session proves the contract

**SAY:**

> Fresh Claude session in that worktree. I’m not going to let it implement yet — I just want it to restate the boundary.

**Launch** (interactive, no `-p`) if not already running:

```bash
cd '<worktree-from-receipt>' && claude --plugin-dir '/path/to/claude-recovery'
```

**PASTE:**

```
Before editing, summarize the implementation boundary and required verification.
```

**WAIT** for a summary that includes roughly:

- preserve `AuthProvider.authenticate(token)`
- no `ApiClient` migration
- use an adapter
- run `node --test tests/auth-compat.test.mjs`

**SAY** (closing — then stop):

> That’s the handoff. Same constraints, clean tree, useful test kept. I’m going to stop before the next implementation.

**STOP RECORDING.** Do not wait for it to rewrite the auth layer.

---

## Cold-read card (print / second monitor)

```text
SAY:   Mixed attempt — reject migration, keep the test.
PASTE: Run `node --test tests/auth-compat.test.mjs` and show `git diff --stat`.
       Do not edit anything. Stop after reporting the observable failure and changed files.

SAY:   Recover — keep what I trust.
PASTE: /claude-recovery:recover

SAY:   Keep test + finding. Reject AuthProvider + ApiClient. Adapter.
PASTE: Keep the compatibility test and expired-token finding.

       Reject the AuthProvider interface change and ApiClient migration.

       Restart from the clean base, use an adapter, and require the compatibility test before completion.

SAY:   Contract looks right.
PASTE: Approved. Run approve and finalize as separate steps, then show the compact receipt.

SAY:   Only the test should remain.
TYPE:  git diff --name-only   (in recovery worktree)

SAY:   Fresh session — just summarize the boundary.
PASTE: Before editing, summarize the implementation boundary and required verification.

STOP.
```

---

## If something stalls

| Symptom | What to do on camera |
|---------|----------------------|
| Model still thinking | Stay quiet; trim the wait later; “waits trimmed” note |
| Raw JSON only | Say “this is the plan output” and move on — don’t invent a prettier UI |
| Receipt missing | Run the `receipt` command above; don’t fake it |
| SessionStart didn’t inject | Stop. Say “injection didn’t fire — stopping.” Do not paste a fake contract as if it injected |
| Urge to keep talking | Don’t. Silence is fine while Claude works |

---

## What not to say

- Don’t say rewind “can’t” keep later work in every case — say *you’re not using rewind because you want selective salvage*.
- Don’t call the fixture “Claude went rogue.” It’s a mixed attempt you’re recovering from.
- Don’t promise a full second implementation in this cut.
- Don’t show install or preflight in the final Loom.
