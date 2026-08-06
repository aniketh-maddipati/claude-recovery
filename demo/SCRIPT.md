# Demo teleprompter — word for word (30–60s)

**Record with Loom, not asciinema.**  
Loom = mic + screen + overlays. asciinema = terminal-only, no voice — wrong tool for this cut.

## Run recording setup (one script)

Off camera:

```bash
./demo/record.sh
```

Or start Claude for you after setup (start Loom first):

```bash
./demo/record.sh --launch
```

Same via npm:

```bash
npm run demo:record
npm run demo:record -- --launch
```

Then open this file beside Loom and follow **top → bottom**.

---

## Fixture (what’s on screen)

Repo: `.demo/auth-service`

| File | Role |
|------|------|
| `src/auth/provider.mjs` | Rejected — `authenticate(token)` became `verifyRequest(request)` |
| `src/clients/api-client.mjs` | Rejected — client migrated to `verifyRequest` |
| `tests/auth-compat.test.mjs` | Keep — still requires `authenticate(token)` |
| expired-token finding | Keep — `expired…` tokens fail auth |

---

## Sequence (easy viewing order)

```text
1. Why this skill exists
2. Show the mixed attempt (failing test + diff)
3. Invoke /claude-recovery:recover
4. Keep / reject decision
5. Read the Recovery Contract → approve
6. Prove only the test carried forward
7. Fresh session restates the boundary → stop
```

Say **only** the quoted lines. Paste **only** the marked blocks. Stay silent while Claude works. Trim waits in Loom; note “waits trimmed”.

---

## Teleprompter

### 1 — Introduce the skill

**YOU SAY:**

> I built claude-recovery for a case rewind doesn’t cover. Sometimes a Claude Code attempt is mixed — I reject the implementation, but a test or finding is still useful. This skill lets me keep only what I approve, then hand a clean worktree a Recovery Contract.

---

### 2 — Show this attempt

**YOU SAY:**

> Here’s that case. AuthProvider was rewritten to verifyRequest, ApiClient was migrated, but we also got a useful compat test and an expired-token finding. I want the test. I don’t want the migration.

**YOU PASTE:**

```
Run `node --test tests/auth-compat.test.mjs` and show `git diff --stat`.

Do not edit anything. Stop after reporting the observable failure and changed files.
```

**SILENT** until the test fails and the diff shows the changed files.

**OVERLAY:** `The implementation direction is rejected. The test is useful.`

---

### 3 — Start recovery

**YOU SAY:**

> So I’m invoking recover.

**YOU PASTE:**

```
/claude-recovery:recover
```

**SILENT** until evidence and the keep/reject question appear.

---

### 4 — Decide

**YOU SAY:**

> Keep the compat test and the expired-token finding. Reject the AuthProvider interface change and the ApiClient migration. Restart from the clean base, use an adapter, and require that test.

**YOU PASTE:**

```
Keep the compatibility test and expired-token finding.

Reject the AuthProvider interface change and ApiClient migration.

Restart from the clean base, use an adapter, and require the compatibility test before completion.
```

**OVERLAY:** `Keep the evidence. Reject the migration.`

**SILENT** until the Recovery Contract preview is readable.

---

### 5 — Contract → approve

**YOU SAY:**

> Contract looks right — keep tests/auth-compat.test.mjs, discard provider and api-client, next attempt uses an adapter. Approving.

**YOU PASTE:**

```
Approved. Run approve and finalize as separate steps, then show the compact receipt.
```

**SILENT** until the compact receipt shows `RECOVERY READY`, Kept `tests/auth-compat.test.mjs`, Boundary verification `PASS`.

Copy the launch line from the receipt (`cd '…' && claude --plugin-dir '…'`).

---

### 6 — Prove the worktree

**YOU SAY:**

> Clean worktree. Only the approved test should differ.

**YOU TYPE** (in the recovery worktree):

```bash
git diff --name-only
```

**Expect:**

```text
tests/auth-compat.test.mjs
```

**OVERLAY:** `Clean base. Only the approved test carries forward.`

---

### 7 — Fresh session → stop

**YOU SAY:**

> Fresh session with the contract. Just summarize the boundary — don’t implement yet.

**YOU RUN** (interactive, no `-p`):

```bash
cd '<worktree-from-receipt>' && claude --plugin-dir '<plugin-root>'
```

**YOU PASTE:**

```
Before editing, summarize the implementation boundary and required verification.
```

**SILENT** until it covers:

- preserve `AuthProvider.authenticate(token)`
- no `ApiClient` migration
- use an adapter
- run `node --test tests/auth-compat.test.mjs`

**YOU SAY:**

> That’s the handoff. Stopping here.

**STOP LOOM.** Do not wait for a second implementation.

---

## Cold-read card

```text
SAY:  I built claude-recovery for a case rewind doesn’t cover.
      Sometimes a Claude Code attempt is mixed — I reject the implementation,
      but a test or finding is still useful. This skill lets me keep only what
      I approve, then hand a clean worktree a Recovery Contract.

SAY:  Here’s that case. AuthProvider was rewritten to verifyRequest, ApiClient
      was migrated, but we also got a useful compat test and an expired-token
      finding. I want the test. I don’t want the migration.
PASTE:
Run `node --test tests/auth-compat.test.mjs` and show `git diff --stat`.

Do not edit anything. Stop after reporting the observable failure and changed files.

SAY:  So I’m invoking recover.
PASTE:
/claude-recovery:recover

SAY:  Keep the compat test and the expired-token finding.
      Reject the AuthProvider interface change and the ApiClient migration.
      Restart from the clean base, use an adapter, and require that test.
PASTE:
Keep the compatibility test and expired-token finding.

Reject the AuthProvider interface change and ApiClient migration.

Restart from the clean base, use an adapter, and require the compatibility test before completion.

SAY:  Contract looks right — keep tests/auth-compat.test.mjs, discard provider
      and api-client, next attempt uses an adapter. Approving.
PASTE:
Approved. Run approve and finalize as separate steps, then show the compact receipt.

SAY:  Clean worktree. Only the approved test should differ.
TYPE: git diff --name-only

SAY:  Fresh session with the contract. Just summarize the boundary — don’t implement yet.
PASTE:
Before editing, summarize the implementation boundary and required verification.

SAY:  That’s the handoff. Stopping here.
STOP.
```

---

## Timing

Spoken lines total ~40s. Trim model waits so the published Loom lands in **30–60s**.

| Beat | ~spoken |
|------|---------|
| Why the skill | 10s |
| This attempt | 8s |
| Invoke recover | 2s |
| Decision | 8s |
| Contract + approve | 6s |
| Worktree | 3s |
| Fresh session + stop | 5s |

---

## Stalls

| Symptom | Say exactly |
|---------|-------------|
| Long wait | *(silence — trim later)* |
| Only JSON | `This is the plan output.` |
| No SessionStart | `Injection didn’t fire. Stopping.` |
| Urge to improvise | *(don’t)* |
