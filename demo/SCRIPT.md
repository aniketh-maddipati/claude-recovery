# Demo teleprompter — word for word

**Record with Loom, not asciinema.**  
Loom = mic + screen + overlays. asciinema = terminal-only, no voice — wrong tool for this cut.

## Run recording setup (one script)

Off camera:

```bash
./demo/record.sh
# or: npm run demo:record
# optional: ./demo/record.sh --launch   # starts Claude after setup
```

Open this file beside Loom. Follow **top → bottom**. Say **only** the quoted lines. Paste **only** the marked blocks. Stay silent while Claude works. Trim model waits in Loom; add “waits trimmed”.

**Published cut target: 45–75 seconds** (spoken lines ~75s; trim waits to fit).

---

## READ THIS FIRST — what is AuthProvider? (plain English)

**You are not demoing a real auth product.** This is a **fake 3-file mini app** used only to show recovery.

Think of it like this:

```text
AuthProvider     = “login checker” — one function: is this token valid?
                   Clean version:  authenticate("some-token")  →  { ok: true/false }

ApiClient        = “app code that uses the login checker”
                   Clean version:  calls provider.authenticate(token)

auth-compat.test = “guardrail test Claude wrote”
                   Checks: authenticate() still exists (don’t break callers)
```

**What went wrong in the mixed attempt (on screen now):**

```text
BEFORE (clean — what we want back):
  provider.authenticate(token)

AFTER (rejected — what Claude tried):
  provider.verifyRequest({ headers: ... })   ← renamed + different shape
  api-client.mjs updated to match            ← forced migration
```

The compat test still looks for `authenticate`. **It fails** — that's the point. The test is useful; the rename is not.

**Expired-token finding:** in the clean code, tokens starting with `expired` are rejected. Worth remembering for the next attempt. Not a file — a note from the attempt.

**Recovery in one sentence:** keep the test + finding, undo the rename/migration on provider + client, start fresh with an adapter approach.

**File map (only 3 matter):**

| File | Plain name | Role in demo |
|------|------------|--------------|
| `src/auth/provider.mjs` | login checker | REJECT changes (restore `authenticate`) |
| `src/clients/api-client.mjs` | caller | REJECT changes (restore old call) |
| `tests/auth-compat.test.mjs` | guardrail test | KEEP |

---

## Sequence (what viewers watch, in order)

```text
1. Why claude-recovery exists (rewind vs selective salvage)
2. Set up the auth-service scenario in one sentence
3. Show failing test + git diff — proof of the mixed attempt
4. Invoke /claude-recovery:recover — capture + evidence
5. Say what to keep and what to reject
6. Read Recovery Contract preview → approve → receipt
7. Prove worktree = clean base + only the approved test
8. Fresh session restates boundary → stop (no second implementation)
```

---

## Teleprompter

### 1 — Why this skill exists (~12s)

**YOU SAY:**

> I built claude-recovery for a recovery case rewind doesn’t cover. Rewind rolls back everything after a checkpoint. Here the later work is mixed — I reject the implementation direction, but a test or finding is still useful. This skill lets me choose what survives, preview that as a Recovery Contract, and start a clean Git worktree with only the approved files.

**VIEWERS SHOULD SEE:** You in Claude Code, about to work in the auth-service fixture. No recovery artifacts yet.

---

### 2 — Explain the fake repo in plain English (~14s)

**YOU SAY:**

> Quick context — this is a fake mini app, not a real product. AuthProvider is just a login checker: you pass a token string, it says valid or not. The function is called authenticate. ApiClient is the code that calls it. Claude renamed authenticate to verifyRequest and rewrote the client to match. That's the rejected migration. It also added a test that says authenticate must still exist — that test fails right now, and that's the useful part I want to keep.

**VIEWERS SHOULD SEE:** Terminal cwd is `.demo/auth-service`. You have not run recovery yet.

---

### 3 — Show the mixed attempt (~8s spoken + on-screen wait)

**YOU SAY:**

> Let me show the evidence first — the failing test and what files changed.

**YOU PASTE:**

```
Run `node --test tests/auth-compat.test.mjs` and show `git diff --stat`.

Do not edit anything. Stop after reporting the observable failure and changed files.
```

**SILENT** while Claude runs the test and diff.

**VIEWERS SHOULD SEE:**

- Test failure — something like `provider.authenticate is not a function` or the compat test failing
- `git diff --stat` listing at least:
  - `src/auth/provider.mjs`
  - `src/clients/api-client.mjs`
  - `tests/auth-compat.test.mjs`

**YOU SAY** (once output is visible — short pointer):

> So authenticate is gone, verifyRequest is in its place, the client was migrated, and the guardrail test is failing. I want to keep that test — not the rename.

**OVERLAY:** `The implementation direction is rejected. The test is useful.`

---

### 4 — Start recovery (~6s spoken + wait)

**YOU SAY:**

> I’m invoking the recover skill. It captures Git state and command evidence, then asks me what to keep and reject.

**YOU PASTE:**

```
/claude-recovery:recover
```

**SILENT** until capture finishes and the keep/reject/change question appears.

**VIEWERS SHOULD SEE:**

- Skill invoked: `/claude-recovery:recover`
- Observed evidence (changed files, failing test output)
- A clear question like: *What should the next attempt keep, reject, or change?*

---

### 5 — Decide what survives (~10s spoken + wait)

**YOU SAY:**

> I'm keeping the guardrail test and the expired-token finding. I'm rejecting the rename on the login checker and the client migration. Next attempt starts clean, uses an adapter instead of renaming authenticate, and has to pass that test.

**YOU PASTE:**

```
Keep the compatibility test and expired-token finding.

Reject the AuthProvider interface change and ApiClient migration.

Restart from the clean base, use an adapter, and require the compatibility test before completion.
```

**OVERLAY:** `Keep the evidence. Reject the migration.`

**SILENT** until the Recovery Contract preview is readable.

**VIEWERS SHOULD SEE** in the contract preview:

- **KEEP:** `tests/auth-compat.test.mjs` + expired-token finding
- **DISCARD:** `src/auth/provider.mjs`, `src/clients/api-client.mjs` (restored to clean base)
- **NEXT:** clean base, adapter approach, run compat test

---

### 6 — Approve and finalize (~8s spoken + wait)

**YOU SAY:**

> Contract matches what I want — keep the test, discard the provider and client changes, adapter on the next pass. I’m approving explicitly; approve and finalize run as separate steps.

**YOU PASTE:**

```
Approved. Run approve and finalize as separate steps, then show the compact receipt.
```

**SILENT** until the compact receipt appears.

**VIEWERS SHOULD SEE** on the receipt:

```text
RECOVERY READY
Kept
tests/auth-compat.test.mjs
Boundary verification
PASS
Launch manually
cd '<worktree>' && claude --plugin-dir '<plugin-root>'
```

Copy the launch line from the receipt.

**YOU SAY** (optional, while receipt is on screen):

> Boundary verification passed — rejected source files match the clean base again.

---

### 7 — Prove the worktree (~6s spoken)

**YOU SAY:**

> In the recovery worktree, only the test file should differ. Login checker and client should be back to authenticate — not verifyRequest.

**YOU TYPE** (in the recovery worktree, or after `cd` there):

```bash
git diff --name-only
```

**VIEWERS SHOULD SEE** exactly:

```text
tests/auth-compat.test.mjs
```

**OVERLAY:** `Clean base. Only the approved test carries forward.`

**YOU SAY:**

> One file. That’s the selective salvage.

---

### 8 — Fresh session proves the contract (~8s spoken + wait)

**YOU SAY:**

> Last step — a fresh Claude session in that worktree. SessionStart should inject the approved contract. I’m not asking it to implement yet; I just want it to restate the boundary so viewers can see the handoff worked.

**YOU RUN** (interactive, no `-p`):

```bash
cd '<worktree-from-receipt>' && claude --plugin-dir '<plugin-root>'
```

**YOU PASTE:**

```
Before editing, summarize the implementation boundary and required verification.
```

**SILENT** until the summary appears.

**VIEWERS SHOULD SEE** the fresh session mention roughly:

- keep the login checker as `authenticate(token)` — do **not** rename to `verifyRequest`
- do **not** rewrite `ApiClient` to the new call shape
- use an **adapter** for the next implementation
- run `node --test tests/auth-compat.test.mjs` before completion

**YOU SAY:**

> Same boundary, clean tree, useful test kept. That’s the handoff — stopping before the second implementation.

**STOP LOOM.**

---

## Cold-read card (print this)

```text
SAY:  I built claude-recovery for a recovery case rewind doesn’t cover. Rewind rolls
      back everything after a checkpoint. Here the later work is mixed — I reject the
      implementation direction, but a test or finding is still useful. This skill lets
      me choose what survives, preview that as a Recovery Contract, and start a clean
      Git worktree with only the approved files.

SAY:  Quick context — this is a fake mini app, not a real product. AuthProvider is
      just a login checker: you pass a token string, it says valid or not. The
      function is called authenticate. ApiClient is the code that calls it.
      Claude renamed authenticate to verifyRequest and rewrote the client to
      match. That's the rejected migration. It also added a test that says
      authenticate must still exist — that test fails right now, and that's
      the useful part I want to keep.

SAY:  Let me show the evidence first — the failing test and what files changed.
PASTE:
Run `node --test tests/auth-compat.test.mjs` and show `git diff --stat`.

Do not edit anything. Stop after reporting the observable failure and changed files.

SAY:  So authenticate is gone, verifyRequest is in its place, the client was
      migrated, and the guardrail test is failing. I want to keep that test —
      not the rename.

SAY:  I’m invoking the recover skill. It captures Git state and command evidence,
      then asks me what to keep and reject.
PASTE:
/claude-recovery:recover

SAY:  I’m keeping the guardrail test and the expired-token finding. I’m rejecting
      the rename on the login checker and the client migration. Next attempt
      starts clean, uses an adapter instead of renaming authenticate, and has
      to pass that test.
PASTE:
Keep the compatibility test and expired-token finding.

Reject the AuthProvider interface change and ApiClient migration.

Restart from the clean base, use an adapter, and require the compatibility test before completion.

SAY:  Contract matches what I want — keep the test, discard the login checker
      and client changes, adapter on the next pass. I’m approving explicitly;
      approve and finalize run as separate steps.
PASTE:
Approved. Run approve and finalize as separate steps, then show the compact receipt.

SAY:  Boundary verification passed — rejected files match the clean base again.

SAY:  In the recovery worktree, only the test file should differ. Login checker
      and client should be back to authenticate — not verifyRequest.
TYPE: git diff --name-only

SAY:  One file. That’s the selective salvage.

SAY:  Last step — a fresh Claude session in that worktree. SessionStart should inject
      the approved contract. I’m not asking it to implement yet; I just want it to
      restate the boundary so viewers can see the handoff worked.
PASTE:
Before editing, summarize the implementation boundary and required verification.

SAY:  Same boundary, clean tree, useful test kept. That’s the handoff — stopping
      before the second implementation.
STOP.
```

---

## Viewer checklist (quick scan)

| Step | Viewers should see |
|------|-------------------|
| Intro | Fake mini app explained: login checker + caller + guardrail test |
| Evidence | Failing test + diff on provider, client, test |
| Recover | Skill invoked, evidence shown, keep/reject question |
| Decision | Contract preview: KEEP test + finding; DISCARD login checker + client |
| Approve | Receipt: RECOVERY READY, Kept test, Boundary PASS |
| Worktree | `git diff --name-only` → only `tests/auth-compat.test.mjs` |
| Fresh session | Summary: keep authenticate, no client rewrite, adapter, run test |

---

## Timing

| Beat | ~spoken |
|------|---------|
| Why the skill | 12s |
| Scenario setup | 14s |
| Evidence + pointer | 8s |
| Invoke recover | 6s |
| Decision | 10s |
| Approve + boundary | 8s |
| Worktree proof | 6s |
| Fresh session + close | 8s |
| **Total spoken** | **~72s** |

Trim model waits in Loom so the published cut lands in **45–75s**.

---

## Stalls

| Symptom | Say exactly |
|---------|-------------|
| Long wait | *(silence — trim later)* |
| Only JSON | `This is the plan output — the readable contract is what matters.` |
| No receipt | *(run receipt CLI; don’t invent output)* |
| No SessionStart | `Injection didn’t fire. Stopping.` |
| Urge to improvise | *(don’t)* |
