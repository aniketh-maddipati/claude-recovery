# Demo teleprompter

Read **SAY** lines word for word. **TYPE** the short prompts below (no paste needed). Stay silent on **WAIT**.

## Type this (cheat sheet)

| Step | Type into Claude |
|------|------------------|
| 3 Evidence | `Run compat test and git diff --stat. No edits.` |
| 4 Recover | `/claude-recovery:recover` |
| 5 Decide | `Keep compat test and expired-token finding. Reject AuthProvider and ApiClient migration. Adapter next pass, require compat test.` |
| 6 Approve | `Approved. Approve and finalize separately, show receipt.` |
| 8 Fresh | `Summarize boundary and verification before editing.` |

**Terminal** (after `source demo/demo-env.sh`): `demo-go` · `demo-wt` · `demo-fresh`

---

## Setup (off camera)

```bash
cd ~/claude-recovery
npm run demo:record
source demo/demo-env.sh
```

Start Loom. Open this file beside the terminal.

---

## Step 0 — Launch

**TYPE:** `demo-go`

**SEE:** Claude in `.demo/auth-service`

---

## Step 1 — Why this exists

**SAY:**
> I built claude-recovery for when a Claude Code attempt is mixed. Rewind throws away everything after a checkpoint. Here I reject the implementation, but a test or finding is still useful. This lets me choose what survives and hand the next session a Recovery Contract.

---

## Step 2 — What this repo is

**SAY:**
> Quick context. This is a fake mini app, not a real product. AuthProvider is just a login checker — you pass a token, it says valid or not. The function is called authenticate. ApiClient is the code that calls it. Claude renamed it to verifyRequest and migrated the client. That's the rejected part. It also added a test that says authenticate must still exist. That test fails, and that's what I want to keep.

---

## Step 3 — Show evidence

**SAY:**
> Let me show the evidence — the failing test and what files changed.

**TYPE:**
```
Run compat test and git diff --stat. No edits.
```

**WAIT**

**SEE:** Compat test fails; diff on provider, client, test

**SAY:**
> So authenticate is gone, verifyRequest is in its place, the client was migrated, and the guardrail test is failing. I want the test, not the rename.

**Overlay:** `The implementation direction is rejected. The test is useful.`

---

## Step 4 — Recover

**SAY:**
> I'm invoking recover. It captures Git state and command evidence, then asks me what to keep and reject.

**TYPE:**
```
/claude-recovery:recover
```

**WAIT**

**SEE:** *What should the next attempt keep, reject, or change?*

---

## Step 5 — Decide

**SAY:**
> I'm keeping the compatibility test and the expired-token finding. I'm rejecting the AuthProvider change and the ApiClient migration. Next attempt starts clean, uses an adapter, and has to pass that test.

**TYPE:**
```
Keep compat test and expired-token finding. Reject AuthProvider and ApiClient migration. Adapter next pass, require compat test.
```

**WAIT**

**SEE:** Contract preview — KEEP test · DISCARD provider/client · NEXT adapter

**Overlay:** `Keep the evidence. Reject the migration.`

---

## Step 6 — Approve

**SAY:**
> Contract looks right. Approving explicitly.

**TYPE:**
```
Approved. Approve and finalize separately, show receipt.
```

**WAIT**

**SEE:** `RECOVERY READY` · Kept test · Boundary `PASS`

**SAY:**
> Boundary verification passed. Rejected files match the clean base again.

---

## Step 7 — Prove worktree

**SAY:**
> In the recovery worktree, only the approved test file should differ.

**TYPE:** `demo-wt`

**SEE:** Only `tests/auth-compat.test.mjs`

**SAY:**
> One file. That's the selective salvage.

**Overlay:** `Clean base. Only the approved test carries forward.`

---

## Step 8 — Fresh session

**SAY:**
> Fresh Claude session — SessionStart should inject the contract. I just want it to restate the boundary.

**TYPE:** `demo-fresh`

**WAIT**

**TYPE into new Claude:**
```
Summarize boundary and verification before editing.
```

**WAIT**

**SEE:** Summary — authenticate, no migration, adapter, run test

---

## Step 9 — Close

**SAY:**
> Same boundary, clean tree, useful test kept. That's the handoff — stopping before the second implementation.

**STOP LOOM.**

---

## Teleprompter-only

```
[SAY] I built claude-recovery for when a Claude Code attempt is mixed. Rewind throws away everything after a checkpoint. Here I reject the implementation, but a test or finding is still useful. This lets me choose what survives and hand the next session a Recovery Contract.

[SAY] Quick context. Fake mini app. Login checker authenticate was renamed verifyRequest. Useful guardrail test fails. Keeping the test.

[SAY] Let me show the evidence.

[TYPE] Run compat test and git diff --stat. No edits.

[WAIT — failing test + diff]

[SAY] authenticate gone, verifyRequest in place, client migrated, test failing. Want the test, not the rename.

[SAY] Invoking recover.

[TYPE] /claude-recovery:recover

[WAIT — keep/reject question]

[SAY] Keeping test and finding, rejecting migration, adapter next pass.

[TYPE] Keep compat test and expired-token finding. Reject AuthProvider and ApiClient migration. Adapter next pass, require compat test.

[WAIT — contract preview]

[SAY] Looks right. Approving.

[TYPE] Approved. Approve and finalize separately, show receipt.

[WAIT — receipt, Boundary PASS]

[SAY] Only the approved test should differ in the worktree.

[TYPE] demo-wt

[SAY] One file. Selective salvage.

[SAY] Fresh session — restate the boundary.

[TYPE] demo-fresh

[TYPE] Summarize boundary and verification before editing.

[WAIT — boundary summary]

[SAY] Same boundary, clean tree, test kept. Stopping here.

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
