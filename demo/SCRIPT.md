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

**While recording, follow [Micro-steps](#micro-steps--exact-order-use-this-while-recording) below — one numbered action at a time.**

---

## Micro-steps — exact order (use this while recording)

Legend: **SAY** = speak aloud · **PASTE** = paste into Claude · **TYPE** = type in terminal · **WAIT** = say nothing · **WHERE** = directory you must be in · **CODE?** = do you edit source files?

### Directory map (memorize this)

Use your real home path. Example repo: `~/claude-recovery`.

| Label | Path | When |
|-------|------|------|
| **REPO** | `~/claude-recovery` | Off camera only (`npm run demo:record`, `npm run demo:reset`) |
| **FIXTURE** | `~/claude-recovery/.demo/auth-service` | Steps 1–17 — first Claude session (mixed attempt) |
| **WORKTREE** | `~/claude-recovery/.demo/auth-service/.claude/recovery-worktrees/<name>` | Steps 19–25 — after finalize (clean base + kept test only) |

**Rule:** Stay in **FIXTURE** for the whole first Claude session. Only `cd` to **WORKTREE** after the receipt (Step 19 onward). Never run the demo from **REPO** root on camera.

Check where you are:

```bash
pwd
# FIXTURE  → …/claude-recovery/.demo/auth-service
# WORKTREE → …/claude-recovery/.demo/auth-service/.claude/recovery-worktrees/…
```

The receipt’s `Launch manually` line is the exact `cd … && claude …` for **WORKTREE**.

### Off camera (before Loom)

**WHERE:** start in **REPO** (`~/claude-recovery`)

| Step | Action | WHERE | CODE? |
|------|--------|-------|-------|
| 0.1 | TYPE: `npm run demo:record` | **REPO** | No |
| 0.2 | Read the printed launch command | **REPO** | No |
| 0.3 | Open Loom, mic on, one terminal 16–18 pt | — | No |
| 0.4 | Open this file (`demo/SCRIPT.md`) beside Loom | — | No |
| 0.5 | **Start Loom recording** | — | No |
| 0.6 | TYPE the launch command (see below) | → **FIXTURE** | No |
| 0.7 | WAIT until Claude Code is ready | **FIXTURE** | No |

**Step 0.6 — TYPE exactly** (replace with your paths):

```bash
cd ~/claude-recovery/.demo/auth-service && claude --plugin-dir ~/claude-recovery
```

After this, **stay in FIXTURE** until Step 19.

---

### On camera — step by step

#### Step 1 — SAY (skill intro)

**WHERE:** **FIXTURE** — Claude Code open, terminal cwd = `.demo/auth-service`

**SAY exactly:**

> I built claude-recovery for a recovery case rewind doesn't cover. Rewind rolls back everything after a checkpoint. Here the later work is mixed — I reject the implementation direction, but a test or finding is still useful. This skill lets me choose what survives, preview that as a Recovery Contract, and start a clean Git worktree with only the approved files.

**CODE?** No · **PASTE?** No · **WAIT?** No

---

#### Step 2 — SAY (explain fake repo)

**WHERE:** **FIXTURE** (same Claude session)

**SAY exactly:**

> Quick context — this is a fake mini app, not a real product. AuthProvider is just a login checker: you pass a token string, it says valid or not. The function is called authenticate. ApiClient is the code that calls it. Claude renamed authenticate to verifyRequest and rewrote the client to match. That's the rejected migration. It also added a test that says authenticate must still exist — that test fails right now, and that's the useful part I want to keep.

**CODE?** No · **PASTE?** No · **WAIT?** No

---

#### Step 3 — SAY (intro evidence)

**WHERE:** **FIXTURE**

**SAY exactly:**

> Let me show the evidence first — the failing test and what files changed.

**CODE?** No · **PASTE?** Not yet

---

#### Step 4 — PASTE (evidence prompt)

**WHERE:** **FIXTURE** — paste into this Claude session (not the terminal)

**PASTE into Claude exactly:**

```
Run `node --test tests/auth-compat.test.mjs` and show `git diff --stat`.

Do not edit anything. Stop after reporting the observable failure and changed files.
```

**CODE?** No · **SAY?** No — press Enter and stop talking

---

#### Step 5 — WAIT (evidence output)

**WHERE:** **FIXTURE**

**WAIT** until Claude finishes. Do not speak.

**Screen must show:**

- compat test failing
- `git diff --stat` with `provider.mjs`, `api-client.mjs`, `auth-compat.test.mjs`

**CODE?** No

---

#### Step 6 — SAY (point at evidence)

**WHERE:** **FIXTURE**

**SAY exactly:**

> So authenticate is gone, verifyRequest is in its place, the client was migrated, and the guardrail test is failing. I want to keep that test — not the rename.

**CODE?** No · **PASTE?** No

**Add Loom overlay:** `The implementation direction is rejected. The test is useful.`

---

#### Step 7 — SAY (intro recover)

**WHERE:** **FIXTURE**

**SAY exactly:**

> I'm invoking the recover skill. It captures Git state and command evidence, then asks me what to keep and reject.

**CODE?** No

---

#### Step 8 — PASTE (recover skill)

**WHERE:** **FIXTURE** — paste into Claude

**PASTE into Claude exactly:**

```
/claude-recovery:recover
```

**CODE?** No · Press Enter · stop talking

---

#### Step 9 — WAIT (recover capture)

**WHERE:** **FIXTURE**

**WAIT** until Claude shows observed evidence and asks what to keep/reject/change.

**CODE?** No

---

#### Step 10 — SAY (intro decision)

**WHERE:** **FIXTURE**

**SAY exactly:**

> I'm keeping the guardrail test and the expired-token finding. I'm rejecting the rename on the login checker and the client migration. Next attempt starts clean, uses an adapter instead of renaming authenticate, and has to pass that test.

**CODE?** No

---

#### Step 11 — PASTE (decision)

**WHERE:** **FIXTURE** — paste into Claude

**PASTE into Claude exactly:**

```
Keep the compatibility test and expired-token finding.

Reject the AuthProvider interface change and ApiClient migration.

Restart from the clean base, use an adapter, and require the compatibility test before completion.
```

**CODE?** No · Press Enter · stop talking

**Add Loom overlay:** `Keep the evidence. Reject the migration.`

---

#### Step 12 — WAIT (contract preview)

**WHERE:** **FIXTURE**

**WAIT** until Recovery Contract preview is readable (KEEP / DISCARD / NEXT).

**CODE?** No

---

#### Step 13 — SAY (intro approve)

**WHERE:** **FIXTURE**

**SAY exactly:**

> Contract matches what I want — keep the test, discard the login checker and client changes, adapter on the next pass. I'm approving explicitly; approve and finalize run as separate steps.

**CODE?** No

---

#### Step 14 — PASTE (approve)

**WHERE:** **FIXTURE** — paste into Claude

**PASTE into Claude exactly:**

```
Approved. Run approve and finalize as separate steps, then show the compact receipt.
```

**CODE?** No · Press Enter · stop talking

---

#### Step 15 — WAIT (receipt)

**WHERE:** **FIXTURE** (still the first Claude session)

**WAIT** until compact receipt appears:

```text
RECOVERY READY
Kept
tests/auth-compat.test.mjs
Boundary verification
PASS
Launch manually
cd '…' && claude --plugin-dir '…'
```

**CODE?** No — Claude runs approve + finalize, not you

---

#### Step 16 — SAY (optional, boundary)

**WHERE:** **FIXTURE**

**SAY exactly:**

> Boundary verification passed — rejected files match the clean base again.

**CODE?** No · Skip if receipt is still loading

---

#### Step 17 — COPY (launch line)

**WHERE:** **FIXTURE** (read receipt on screen)

**COPY** the `cd '…' && claude --plugin-dir '…'` line from the receipt. Do not paste yet.

**CODE?** No

**If no receipt appeared, PASTE into Claude while still in FIXTURE (fallback):**

```
node ~/claude-recovery/scripts/recovery.mjs receipt --manifest .claude/recovery/recovery-manifest.json
```

Paths are relative to **FIXTURE**. Then WAIT and COPY the launch line.

---

#### Step 18 — SAY (intro worktree check)

**WHERE:** about to leave **FIXTURE** → go to **WORKTREE**

**SAY exactly:**

> In the recovery worktree, only the test file should differ. Login checker and client should be back to authenticate — not verifyRequest.

**CODE?** No

---

#### Step 19 — TYPE (go to worktree + diff)

**WHERE:** **WORKTREE** — exit or pause Claude if needed; use the terminal shell

**TYPE in terminal** (path comes from the receipt — under `.demo/auth-service/.claude/recovery-worktrees/`):

```bash
cd ~/claude-recovery/.demo/auth-service/.claude/recovery-worktrees/<name-from-receipt>
git diff --name-only
```

Or paste the full `cd '…'` line from the receipt, then run `git diff --name-only`.

**Confirm:** `pwd` ends with `recovery-worktrees/<name>`, not `.demo/auth-service`.

**CODE?** No — two shell commands, no file edits

**Screen must show only:**

```text
tests/auth-compat.test.mjs
```

---

#### Step 20 — SAY (worktree result)

**WHERE:** **WORKTREE** (terminal still here)

**SAY exactly:**

> One file. That's the selective salvage.

**Add Loom overlay:** `Clean base. Only the approved test carries forward.`

**CODE?** No

---

#### Step 21 — SAY (intro fresh session)

**WHERE:** **WORKTREE** (terminal)

**SAY exactly:**

> Last step — a fresh Claude session in that worktree. SessionStart should inject the approved contract. I'm not asking it to implement yet; I just want it to restate the boundary so viewers can see the handoff worked.

**CODE?** No

---

#### Step 22 — TYPE (launch fresh Claude)

**WHERE:** **WORKTREE** — launch second Claude session from this directory

**TYPE/PASTE in terminal** the launch line you copied in Step 17:

```bash
cd ~/claude-recovery/.demo/auth-service/.claude/recovery-worktrees/<name-from-receipt> && claude --plugin-dir ~/claude-recovery
```

**Important:** interactive launch, **no** `-p` flag. Claude’s cwd must be **WORKTREE**, not FIXTURE.

**CODE?** No · **WAIT** until new Claude session is ready

---

#### Step 23 — PASTE (fresh session proof)

**WHERE:** **WORKTREE** — paste into the **new** Claude session (not FIXTURE)

**PASTE into the NEW Claude session exactly:**

```
Before editing, summarize the implementation boundary and required verification.
```

**CODE?** No · Press Enter · stop talking

---

#### Step 24 — WAIT (boundary summary)

**WHERE:** **WORKTREE** (second Claude session)

**WAIT** until Claude summarizes. It should mention:

- keep `authenticate(token)` — not `verifyRequest`
- no ApiClient rewrite
- use an adapter
- run `node --test tests/auth-compat.test.mjs`

**CODE?** No · **Do not** ask it to implement anything

---

#### Step 25 — SAY (close)

**WHERE:** **WORKTREE**

**SAY exactly:**

> Same boundary, clean tree, useful test kept. That's the handoff — stopping before the second implementation.

**CODE?** No

---

#### Step 26 — STOP

**Stop Loom recording.**

**Do not:** write code, fix auth, implement adapter, or start a second attempt.

---

### Quick tally

| Phase | WHERE |
|-------|-------|
| Off camera setup | **REPO** |
| Steps 1–17 | **FIXTURE** (`.demo/auth-service`) |
| Steps 19–25 | **WORKTREE** (`.demo/auth-service/.claude/recovery-worktrees/…`) |

| You do on camera | How many times |
|------------------|----------------|
| **SAY** (spoken lines) | 12 lines |
| **PASTE** into Claude | 5 pastes |
| **TYPE** in terminal | 2 moments (worktree `cd` + diff; fresh launch) |
| **WAIT** (silent) | 5 waits |
| **Write/edit code** | **0** |

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
DIRS:  REPO=~/claude-recovery (off camera)
       FIXTURE=~/claude-recovery/.demo/auth-service (Steps 1-17)
       WORKTREE=…/recovery-worktrees/<name> (Steps 19-25)

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
