# Demo script — word for word

Fixture: `.demo/auth-service`  
Files in play:

| Path | What’s wrong / useful |
|------|------------------------|
| `src/auth/provider.mjs` | Rejected: `authenticate(token)` → `verifyRequest(request)` |
| `src/clients/api-client.mjs` | Rejected: client migrated to `verifyRequest` |
| `tests/auth-compat.test.mjs` | Keep: asserts `authenticate(token)` still exists |
| expired-token finding | Keep: tokens prefixed with `expired` fail auth |

**Off camera** (do not record):

```bash
npm run demo:preflight
npm run demo
cd .demo/auth-service && claude --plugin-dir ../..
```

Open this file beside Loom. One terminal. 16–18 pt. Trim model waits; add “waits trimmed”.

**Target cut: 30–60 seconds of you talking + on-screen action.**  
Say **only** the lines in quotes. Do not paraphrase. Stay silent while Claude works.

---

## Teleprompter (30–60s)

### Beat 1 — evidence (on-screen ~0–8s)

**YOU SAY:**

> This attempt rewrote AuthProvider to verifyRequest and migrated ApiClient. I also got a useful compat test and an expired-token finding. I’m keeping the test. I’m rejecting the migration.

**YOU PASTE:**

```
Run `node --test tests/auth-compat.test.mjs` and show `git diff --stat`.

Do not edit anything. Stop after reporting the observable failure and changed files.
```

**SILENT** until fail + diff show `provider.mjs` / `api-client.mjs` / the test.

**OVERLAY:** `The implementation direction is rejected. The test is useful.`

---

### Beat 2 — recover (on-screen ~8–16s)

**YOU SAY:**

> Recover.

**YOU PASTE:**

```
/claude-recovery:recover
```

**SILENT** until evidence + keep/reject question appear.

---

### Beat 3 — decide (on-screen ~16–24s)

**YOU SAY:**

> Keep the compat test and the expired-token finding. Reject the AuthProvider interface change and the ApiClient migration. Restart from the clean base, use an adapter, and require that test.

**YOU PASTE:**

```
Keep the compatibility test and expired-token finding.

Reject the AuthProvider interface change and ApiClient migration.

Restart from the clean base, use an adapter, and require the compatibility test before completion.
```

**OVERLAY:** `Keep the evidence. Reject the migration.`

**SILENT** while the Recovery Contract preview appears.

---

### Beat 4 — contract + approve (on-screen ~24–38s)

**YOU SAY** (point at KEEP / DISCARD / NEXT):

> Contract looks right — keep tests/auth-compat.test.mjs, discard provider and api-client, next attempt uses an adapter.

**YOU PASTE:**

```
Approved. Run approve and finalize as separate steps, then show the compact receipt.
```

**SILENT** until receipt shows `RECOVERY READY`, Kept `tests/auth-compat.test.mjs`, Boundary verification `PASS`.

Copy the `cd '…' && claude --plugin-dir '…'` line from the receipt.

---

### Beat 5 — worktree proof (on-screen ~38–46s)

**YOU SAY:**

> Clean worktree. Only the approved test should differ.

**YOU TYPE** in the recovery worktree:

```bash
git diff --name-only
```

**Expect:**

```text
tests/auth-compat.test.mjs
```

**OVERLAY:** `Clean base. Only the approved test carries forward.`

---

### Beat 6 — fresh session (on-screen ~46–60s)

**YOU SAY:**

> Fresh session. Just summarize the boundary — don’t implement yet.

**YOU RUN** (interactive, no `-p`):

```bash
cd '<worktree-from-receipt>' && claude --plugin-dir '<plugin-root>'
```

**YOU PASTE:**

```
Before editing, summarize the implementation boundary and required verification.
```

**SILENT** until it says roughly:

- keep `AuthProvider.authenticate(token)`
- no `ApiClient` migration
- use an adapter
- run `node --test tests/auth-compat.test.mjs`

**YOU SAY:**

> That’s the handoff. Stopping here.

**STOP.** Do not wait for a second implementation.

---

## Cold-read card (print this)

```text
SAY:  This attempt rewrote AuthProvider to verifyRequest and migrated ApiClient.
      I also got a useful compat test and an expired-token finding.
      I’m keeping the test. I’m rejecting the migration.
PASTE:
Run `node --test tests/auth-compat.test.mjs` and show `git diff --stat`.

Do not edit anything. Stop after reporting the observable failure and changed files.

SAY:  Recover.
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
      and api-client, next attempt uses an adapter.
PASTE:
Approved. Run approve and finalize as separate steps, then show the compact receipt.

SAY:  Clean worktree. Only the approved test should differ.
TYPE: git diff --name-only

SAY:  Fresh session. Just summarize the boundary — don’t implement yet.
PASTE:
Before editing, summarize the implementation boundary and required verification.

SAY:  That’s the handoff. Stopping here.
STOP.
```

---

## Timing notes

| Spoken line | ~seconds |
|-------------|----------|
| Opening (Beat 1) | 8 |
| “Recover.” | 1 |
| Decision (Beat 3) | 8 |
| Contract line (Beat 4) | 5 |
| Worktree line (Beat 5) | 3 |
| Fresh-session line (Beat 6) | 3 |
| Close | 2 |
| **Spoken total** | **~30s** |

On-screen waits push wall-clock higher; trim those in Loom so the published cut lands in **30–60s**.

---

## If something stalls

| Symptom | You say (exact) |
|---------|-----------------|
| Long model wait | *(say nothing — trim later)* |
| Only raw JSON | `This is the plan output.` |
| No receipt | *(run receipt CLI off the cold-read; don’t invent output)* |
| No SessionStart inject | `Injection didn’t fire. Stopping.` |
| Want to keep talking | *(don’t)* |
