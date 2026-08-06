# Demo teleprompter

Read **SAY** lines word for word. Paste/type exactly as shown. Stay silent where it says WAIT.

**Short commands** (after `source demo/demo-env.sh`):

| Type | When |
|------|------|
| `demo-go` | Step 0 — Claude in FIXTURE |
| `demo-wt` | Step 7 — worktree diff (after receipt) |
| `demo-fresh` | Step 8 — fresh Claude in WORKTREE |

Same via npm: `npm run demo:go` · `npm run demo:wt` · `npm run demo:fresh`

---

## Setup (off camera)

```bash
cd ~/claude-recovery
npm run demo:record
source demo/demo-env.sh
```

Start Loom. Open this file beside the terminal.

**Before Step 0:** `/help` → Custom commands → `claude-recovery:recover` (optional). Step 4 paste works without slash.

---

## Step 0 — Launch

**WHERE:** terminal → **FIXTURE**

**TYPE:**
```bash
demo-go
```

**SEE:** Claude Code open; `pwd` ends in `.demo/auth-service`

---

## Step 1 — Why this exists

**WHERE:** **FIXTURE**

**SAY:**
> I built claude-recovery for when a Claude Code attempt is mixed. Rewind throws away everything after a checkpoint. Here I reject the implementation, but a test or finding is still useful. This lets me choose what survives and hand the next session a Recovery Contract.

**PASTE:** —

**SEE:** You in Claude; no receipt yet

---

## Step 2 — What this repo is

**WHERE:** **FIXTURE**

**SAY:**
> Quick context. This is a fake mini app, not a real product. AuthProvider is just a login checker — you pass a token, it says valid or not. The function is called authenticate. ApiClient is the code that calls it. Claude renamed it to verifyRequest and migrated the client. That's the rejected part. It also added a test that says authenticate must still exist. That test fails, and that's what I want to keep.

**PASTE:** —

**SEE:** Same Claude session in FIXTURE

---

## Step 3 — Show evidence

**WHERE:** **FIXTURE**

**SAY:**
> Let me show the evidence — the failing test and what files changed.

**PASTE into Claude:**
```
Run `node --test tests/auth-compat.test.mjs` and show `git diff --stat`.

Do not edit anything. Stop after reporting the observable failure and changed files.
```

**WAIT** — say nothing until output appears

**SEE:** Compat test fails; diff lists `provider.mjs`, `api-client.mjs`, `auth-compat.test.mjs`

**SAY:**
> So authenticate is gone, verifyRequest is in its place, the client was migrated, and the guardrail test is failing. I want the test, not the rename.

**Overlay:** `The implementation direction is rejected. The test is useful.`

---

## Step 4 — Recover

**WHERE:** **FIXTURE**

**SAY:**
> I'm invoking recover. It captures Git state and command evidence, then asks me what to keep and reject.

**PASTE into Claude:**
```
Follow skills/recover/SKILL.md.

Run capture and inspect (scripts/recovery.mjs).

Show the compact labeled current-attempt view, then ask: What should the next attempt keep, reject, or change?

Stop before writing decision.json or running approve/finalize.
```

**Or slash:** `/claude-recovery:recover`

**WAIT**

**SEE:** Observed evidence; question: *What should the next attempt keep, reject, or change?*

---

## Step 5 — Decide

**WHERE:** **FIXTURE**

**SAY:**
> I'm keeping the compatibility test and the expired-token finding. I'm rejecting the AuthProvider change and the ApiClient migration. Next attempt starts clean, uses an adapter, and has to pass that test.

**PASTE into Claude:**
```
Keep the compatibility test and expired-token finding.

Reject the AuthProvider interface change and ApiClient migration.

Restart from the clean base, use an adapter, and require the compatibility test before completion.
```

**WAIT**

**SEE:** Contract preview — KEEP test + finding · DISCARD provider + client · NEXT adapter

**Overlay:** `Keep the evidence. Reject the migration.`

---

## Step 6 — Approve

**WHERE:** **FIXTURE**

**SAY:**
> Contract looks right — keep the test, discard the login checker and client changes, adapter on the next pass. Approving explicitly.

**PASTE into Claude:**
```
Approved. Run approve and finalize as separate steps, then show the compact receipt.
```

**WAIT**

**SEE:** Receipt — `RECOVERY READY` · Kept `tests/auth-compat.test.mjs` · Boundary `PASS` · launch line

**SAY:**
> Boundary verification passed. Rejected files match the clean base again.

**If no receipt:** `npm run demo:receipt`

---

## Step 7 — Prove worktree

**WHERE:** terminal → **WORKTREE** (leave FIXTURE)

**SAY:**
> In the recovery worktree, only the approved test file should differ. Login checker and client should be back to authenticate, not verifyRequest.

**TYPE:**
```bash
demo-wt
```

**Approve** bash if manual mode asks.

**SEE:** Only `tests/auth-compat.test.mjs`

**SAY:**
> One file. That's the selective salvage.

**Overlay:** `Clean base. Only the approved test carries forward.`

---

## Step 8 — Fresh session

**WHERE:** terminal → **WORKTREE**

**SAY:**
> Last step — a fresh Claude session in that worktree. SessionStart should inject the approved contract. I'm not asking it to implement yet; I just want it to restate the boundary.

**TYPE:**
```bash
demo-fresh
```

**WAIT** until new Claude session is ready

**SEE:** New session; `pwd` is WORKTREE

**PASTE into new Claude:**
```
Before editing, summarize the implementation boundary and required verification.
```

**WAIT**

**SEE:** Summary — keep `authenticate(token)` · no ApiClient migration · adapter · run compat test

---

## Step 9 — Close

**WHERE:** **WORKTREE**

**SAY:**
> Same boundary, clean tree, useful test kept. That's the handoff — stopping before the second implementation.

**STOP LOOM.** Do not implement.

---

## Teleprompter-only (read straight through)

Paste/type where marked. `[PASTE]` / `[TYPE]` / `[WAIT]`.

```
[SAY] I built claude-recovery for when a Claude Code attempt is mixed. Rewind throws away everything after a checkpoint. Here I reject the implementation, but a test or finding is still useful. This lets me choose what survives and hand the next session a Recovery Contract.

[SAY] Quick context. This is a fake mini app, not a real product. AuthProvider is just a login checker — you pass a token, it says valid or not. The function is called authenticate. ApiClient is the code that calls it. Claude renamed it to verifyRequest and migrated the client. That's the rejected part. It also added a test that says authenticate must still exist. That test fails, and that's what I want to keep.

[SAY] Let me show the evidence — the failing test and what files changed.

[PASTE]
Run `node --test tests/auth-compat.test.mjs` and show `git diff --stat`.

Do not edit anything. Stop after reporting the observable failure and changed files.

[WAIT — SEE failing test + diff on provider, client, test]

[SAY] So authenticate is gone, verifyRequest is in its place, the client was migrated, and the guardrail test is failing. I want the test, not the rename.

[SAY] I'm invoking recover. It captures Git state and command evidence, then asks me what to keep and reject.

[PASTE]
Follow skills/recover/SKILL.md. Run capture and inspect (scripts/recovery.mjs). Show labeled evidence and ask what to keep, reject, or change. Stop before decision or finalize.

[WAIT — SEE evidence + keep/reject question]

[SAY] I'm keeping the compatibility test and the expired-token finding. I'm rejecting the AuthProvider change and the ApiClient migration. Next attempt starts clean, uses an adapter, and has to pass that test.

[PASTE]
Keep the compatibility test and expired-token finding.

Reject the AuthProvider interface change and ApiClient migration.

Restart from the clean base, use an adapter, and require the compatibility test before completion.

[WAIT — SEE contract preview: KEEP test, DISCARD provider/client]

[SAY] Contract looks right — keep the test, discard the login checker and client changes, adapter on the next pass. Approving explicitly.

[PASTE]
Approved. Run approve and finalize as separate steps, then show the compact receipt.

[WAIT — SEE receipt: RECOVERY READY, Kept test, Boundary PASS]

[SAY] Boundary verification passed. Rejected files match the clean base again.

[SAY] In the recovery worktree, only the approved test file should differ. Login checker and client should be back to authenticate, not verifyRequest.

[TYPE] demo-wt

[SEE only tests/auth-compat.test.mjs]

[SAY] One file. That's the selective salvage.

[SAY] Last step — a fresh Claude session in that worktree. SessionStart should inject the approved contract. I'm not asking it to implement yet; I just want it to restate the boundary.

[TYPE] demo-fresh

[PASTE into new Claude]
Before editing, summarize the implementation boundary and required verification.

[WAIT — SEE summary: authenticate, no migration, adapter, run test]

[SAY] Same boundary, clean tree, useful test kept. That's the handoff — stopping before the second implementation.

STOP.
```

---

## Loom overlays

```text
The implementation direction is rejected. The test is useful.

Keep the evidence. Reject the migration.

Clean base. Only the approved test carries forward.
```

Recording notes: [`demo/RECORDING.md`](RECORDING.md)
