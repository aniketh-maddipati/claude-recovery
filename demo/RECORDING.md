# Loom recording — primary final cut (30–60s)

Word-for-word narration + paste blocks: [`demo/SCRIPT.md`](SCRIPT.md)

Prepare the deterministic auth-service fixture:

```bash
npm run demo:preflight
npm run demo
```

Starting state:

```text
Git diff: present
Useful compatibility test: present
commands.jsonl: absent or empty
decision.json: absent
recovery manifest: absent
approved pending contract: absent
```

`npm run demo` prints the full paste sequence. Fixture files in play:

- reject: `src/auth/provider.mjs` (`authenticate` → `verifyRequest`)
- reject: `src/clients/api-client.mjs` (migrated client)
- keep: `tests/auth-compat.test.mjs` + expired-token finding

## Final cut sequence (published length 30–60s)

Trim model waits so spoken lines + action fit the window. Spoken script alone is ~30s; see [`demo/SCRIPT.md`](SCRIPT.md).

| Time | Action |
|------|--------|
| 0–8s | failing compat test + `git diff --stat` |
| 8–16s | `/claude-recovery:recover` + observed evidence |
| 16–24s | keep/reject/change decision |
| 24–38s | Recovery Contract preview + approve + compact receipt |
| 38–46s | `git diff --name-only` in recovery worktree |
| 46–60s | fresh interactive session summarizes boundary → stop |

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

- Use Loom
- Single terminal window
- 16–18 pt terminal font
- Trim model wait time; add a small “waits trimmed” note
- Do not fake terminal output
- Do not show installation or preflight in the final cut
- Do not show raw JSON unless it is the only available output
- Do not wait for the second implementation
- End after the fresh session proves it received the contract
- Say only the lines in [`demo/SCRIPT.md`](SCRIPT.md) — do not paraphrase

## Guardrails

- You start the fresh interactive session — the plugin cannot launch Claude or invoke `/clear`.
- Do not describe `-p` as interactive.
- Do not claim seeded `commands.jsonl` was hook-captured.
- Final shot is valid only if SessionStart injects (check `injection-audit.jsonl`) **or** you clearly label a fallback path.
- Discarded source files in the new worktree must remain byte-identical to the clean base.
- If SessionStart injection is unavailable, **stop and report the exact blocker**. Do not fake injection.
