# Loom recording — primary final cut (~68s)

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

**Prompts:** [`demo/PROMPTS.md`](PROMPTS.md) · `npm run demo` prints the full paste sequence.

## Final cut sequence

| Time | Action |
|------|--------|
| 0–8s | failing compatibility test + `git diff --stat` |
| 8–18s | invoke `/claude-recovery:recover` and show observed evidence |
| 18–27s | keep/reject/change decision |
| 27–39s | readable Recovery Contract preview |
| 39–49s | explicit approval + compact receipt |
| 49–55s | `git diff --name-only` in recovery worktree |
| 55–68s | fresh interactive session summarizes boundary |

### 0–8 seconds

In Claude, paste the evidence prompt (or run through Bash with hooks loaded):

```
Run `node --test tests/auth-compat.test.mjs` and show `git diff --stat`.

Do not edit anything. Stop after reporting the observable failure and changed files.
```

Overlay:

```text
The implementation direction is rejected. The test is useful.
```

### 8–18 seconds

```text
/claude-recovery:recover
```

Show observed evidence and the keep/reject/change question.

### 18–27 seconds

```
Keep the compatibility test and expired-token finding.

Reject the AuthProvider interface change and ApiClient migration.

Restart from the clean base, use an adapter, and require the compatibility test before completion.
```

Overlay:

```text
Keep the evidence. Reject the migration.
```

### 27–39 seconds

Show a readable Recovery Contract preview (KEEP / DISCARD / NEXT). Prefer the human-readable contract fields over raw JSON.

### 39–49 seconds

```
Approved. Run approve and finalize as separate steps, then show the compact receipt.
```

Expected receipt shape:

```text
RECOVERY READY
…
Kept
tests/auth-compat.test.mjs
…
Boundary verification
PASS
…
Launch manually
cd '<worktree>' && claude --plugin-dir '<plugin-root>'
```

### 49–55 seconds

In the recovery worktree:

```bash
git diff --name-only
```

It should show only:

```text
tests/auth-compat.test.mjs
```

Overlay:

```text
Clean base. Only the approved test carries forward.
```

### 55–68 seconds

Manually launch the **interactive** session (no `-p`):

```bash
cd '<worktree>' && claude --plugin-dir '<plugin-root>'
```

Ask:

```
Before editing, summarize the implementation boundary and required verification.
```

Expected content:

- preserve `AuthProvider.authenticate(token)`
- no `ApiClient` migration
- use an adapter
- run `node --test tests/auth-compat.test.mjs`

End the recording here. Do not wait for a second implementation.

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

## Overlays (only these three)

```text
The implementation direction is rejected. The test is useful.

Keep the evidence. Reject the migration.

Clean base. Only the approved test carries forward.
```

## Guardrails

- You start the fresh interactive session — the plugin cannot launch Claude or invoke `/clear`.
- Do not describe `-p` as interactive.
- Do not claim seeded `commands.jsonl` was hook-captured.
- Final shot is valid only if SessionStart injects (check `injection-audit.jsonl`) **or** you clearly label a fallback path.
- Discarded source files in the new worktree must remain byte-identical to the clean base.
- If SessionStart injection is unavailable, **stop and report the exact blocker**. Do not fake injection.
