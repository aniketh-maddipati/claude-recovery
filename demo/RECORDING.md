# Loom recording — primary final cut (45–75s)

**Use Loom, not asciinema.** You need mic, screen, and three short overlays; Claude Code is an interactive TUI.

Word-for-word narration + viewer cues: [`demo/SCRIPT.md`](SCRIPT.md)

Prepare with one script (off camera):

```bash
./demo/record.sh
# or: npm run demo:record
# optional: ./demo/record.sh --launch
```

## Scenario (plain English)

**Not a real auth product** — a fake 3-file mini app for the demo.

| Name in code | Plain English | What happened |
|--------------|---------------|---------------|
| `AuthProvider` | login checker | Rejected: `authenticate(token)` renamed to `verifyRequest(...)` |
| `ApiClient` | code that calls the login checker | Rejected: rewritten to call `verifyRequest` |
| `auth-compat.test.mjs` | guardrail test | **Keep** — checks `authenticate` still exists (fails today) |
| expired-token finding | edge-case note | **Keep** — tokens starting with `expired` fail auth |

Recovery keeps the test + finding, restores provider and client to the clean base.

Full explainer + teleprompter: [`demo/SCRIPT.md`](SCRIPT.md) — start at **READ THIS FIRST**.

## What viewers should see (beat by beat)

| Beat | On screen | Success looks like |
|------|-----------|-------------------|
| Intro | You in Claude, auth-service cwd | Skill + scenario explained in one sentence |
| Evidence | Test run + `git diff --stat` | Test fails; diff shows provider, client, test |
| Recover | `/claude-recovery:recover` | Evidence + keep/reject question |
| Decision | Your paste + contract preview | KEEP test + finding; DISCARD provider + client |
| Approve | Receipt after approve + finalize | `RECOVERY READY`, Kept test, Boundary `PASS` |
| Worktree | `git diff --name-only` | Only `tests/auth-compat.test.mjs` |
| Fresh session | New interactive Claude in worktree | Summary: authenticate, no migration, adapter, run test |
| Stop | You close | No second implementation |

Full spoken lines: [`demo/SCRIPT.md`](SCRIPT.md).

## Final cut sequence

Trim model waits so spoken lines + action fit **45–75s**.

| Time | Action |
|------|--------|
| 0–15s | Intro + scenario context |
| 15–25s | failing compat test + `git diff --stat` |
| 25–35s | `/claude-recovery:recover` + observed evidence |
| 35–45s | keep/reject decision + contract preview |
| 45–55s | approve + compact receipt |
| 55–62s | `git diff --name-only` in recovery worktree |
| 62–75s | fresh session summarizes boundary → stop |

### Exact prompts

**Evidence**

```
Run `node --test tests/auth-compat.test.mjs` and show `git diff --stat`.

Do not edit anything. Stop after reporting the observable failure and changed files.
```

**Recovery**

```
/claude-recovery:recover
```

**Decision**

```
Keep the compatibility test and expired-token finding.

Reject the AuthProvider interface change and ApiClient migration.

Restart from the clean base, use an adapter, and require the compatibility test before completion.
```

**Approval**

```
Approved. Run approve and finalize as separate steps, then show the compact receipt.
```

**Worktree check**

```bash
git diff --name-only
```

Expect only:

```text
tests/auth-compat.test.mjs
```

**Fresh-session proof**

```
Before editing, summarize the implementation boundary and required verification.
```

Expect: preserve `AuthProvider.authenticate(token)`; no `ApiClient` migration; use an adapter; run `node --test tests/auth-compat.test.mjs`.

## Overlays (only these three)

```text
The implementation direction is rejected. The test is useful.

Keep the evidence. Reject the migration.

Clean base. Only the approved test carries forward.
```

## Recording rules

- Use Loom; single terminal; 16–18 pt font
- Trim model waits; add “waits trimmed” note
- Do not fake terminal output
- Do not show install or preflight in the final cut
- Do not show raw JSON unless it is the only available output
- Do not wait for the second implementation
- End after the fresh session proves it received the contract
- Say only the lines in [`demo/SCRIPT.md`](SCRIPT.md)

## Guardrails

- You start the fresh interactive session — the plugin cannot launch Claude
- Do not describe `-p` as interactive
- Do not claim seeded `commands.jsonl` was hook-captured
- Discarded source files in the worktree must match the clean base byte-for-byte
- If SessionStart injection fails, stop and report — do not fake it
