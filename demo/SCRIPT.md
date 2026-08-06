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

**Published cut target: 45–75 seconds** (spoken lines ~55s; trim waits to fit).

---

## Scenario primer (read this once — helps you narrate)

This is a tiny auth-service repo. The **original task** was: add request authentication **without** changing the public `AuthProvider` API and **without** forcing a client migration.

The **mixed attempt** on screen did three things:

| What happened | File | Viewer should notice |
|---------------|------|----------------------|
| Rejected API rewrite | `src/auth/provider.mjs` | `authenticate(token)` → `verifyRequest(request)` |
| Rejected client migration | `src/clients/api-client.mjs` | client now calls `verifyRequest` with headers |
| Useful artifact to keep | `tests/auth-compat.test.mjs` | test still expects `provider.authenticate` to exist |
| Useful finding to keep | expired-token edge case | tokens starting with `expired` fail auth |

The compat test **fails on purpose** because the provider no longer exposes `authenticate`. That failure is the proof the migration is wrong — and the test itself is worth keeping for the next attempt.

**What recovery does for viewers:** keep the test + finding, restore rejected source files to the clean base, hand the next session an explicit Recovery Contract.

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

### 2 — Set up the scenario (~10s)

**YOU SAY:**

> This is a small auth-service demo. The task was add authentication without changing the public AuthProvider interface and without migrating ApiClient. The attempt on screen rewrote AuthProvider to verifyRequest, migrated the client, and also added a compatibility test that still expects authenticate. That test fails — and that failure is exactly why I want to recover instead of rewinding.

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

> So the migration broke the public API, the client moved with it, and the compat test is catching that. I want to keep that test, not the migration.

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

> I’m keeping the compatibility test and the expired-token finding. I’m rejecting the AuthProvider interface change and the ApiClient migration. Next attempt starts from the clean base, uses an adapter instead of rewriting the API, and has to pass that compat test before we’re done.

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

> In the recovery worktree, only the approved test file should differ from the clean base. Provider and client should be back to authenticate, not verifyRequest.

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

- preserve `AuthProvider.authenticate(token)` — do **not** use `verifyRequest`
- do **not** migrate `ApiClient` to a new call shape
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

SAY:  This is a small auth-service demo. The task was add authentication without
      changing the public AuthProvider interface and without migrating ApiClient.
      The attempt on screen rewrote AuthProvider to verifyRequest, migrated the
      client, and also added a compatibility test that still expects authenticate.
      That test fails — and that failure is exactly why I want to recover instead
      of rewinding.

SAY:  Let me show the evidence first — the failing test and what files changed.
PASTE:
Run `node --test tests/auth-compat.test.mjs` and show `git diff --stat`.

Do not edit anything. Stop after reporting the observable failure and changed files.

SAY:  So the migration broke the public API, the client moved with it, and the
      compat test is catching that. I want to keep that test, not the migration.

SAY:  I’m invoking the recover skill. It captures Git state and command evidence,
      then asks me what to keep and reject.
PASTE:
/claude-recovery:recover

SAY:  I’m keeping the compatibility test and the expired-token finding. I’m
      rejecting the AuthProvider interface change and the ApiClient migration.
      Next attempt starts from the clean base, uses an adapter instead of rewriting
      the API, and has to pass that compat test before we’re done.
PASTE:
Keep the compatibility test and expired-token finding.

Reject the AuthProvider interface change and ApiClient migration.

Restart from the clean base, use an adapter, and require the compatibility test before completion.

SAY:  Contract matches what I want — keep the test, discard the provider and client
      changes, adapter on the next pass. I’m approving explicitly; approve and
      finalize run as separate steps.
PASTE:
Approved. Run approve and finalize as separate steps, then show the compact receipt.

SAY:  Boundary verification passed — rejected source files match the clean base again.

SAY:  In the recovery worktree, only the approved test file should differ from the
      clean base. Provider and client should be back to authenticate, not verifyRequest.
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
| Evidence | Failing compat test + diff on provider, client, test |
| Recover | Skill invoked, evidence shown, keep/reject question |
| Decision | Contract preview: KEEP test, DISCARD provider + client |
| Approve | Receipt: RECOVERY READY, Kept test, Boundary PASS |
| Worktree | `git diff --name-only` → only `tests/auth-compat.test.mjs` |
| Fresh session | Summary: authenticate, no migration, adapter, run test |

---

## Timing

| Beat | ~spoken |
|------|---------|
| Why the skill | 12s |
| Scenario setup | 10s |
| Evidence + pointer | 8s |
| Invoke recover | 6s |
| Decision | 10s |
| Approve + boundary | 8s |
| Worktree proof | 6s |
| Fresh session + close | 8s |
| **Total spoken** | **~68s** |

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
