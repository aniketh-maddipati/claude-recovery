# Loom recording — primary 60–75 second cut

Prepare the deterministic mixed-attempt fixture:

```bash
npm run demo:preflight
npm run demo
```

This fixture overlays a rejected auth-service attempt on a clean base. It is **not** proof that Claude independently violated an instruction. Starting state:

```text
Git diff: present
Useful compatibility test: present
commands.jsonl: absent or empty
decision.json: absent
recovery manifest: absent
approved pending contract: absent
```

**Prompts:** [`demo/PROMPTS.md`](PROMPTS.md)

Run the printed interactive launch command. Terminal: 120% zoom, crop to the active pane. Narrate or use captions.

## Primary sequence (60–75 seconds)

### 0–8 seconds

Show:

```bash
git diff --stat
node --test tests/auth-compat.test.mjs
```

Caption:

```text
Two rejected API changes. One useful compatibility test.
```

The failing test must run through Bash in Claude Code (or with plugin hooks active) so the real PostToolUse hook can capture `commands.jsonl`. Do not pretape fake evidence.

### 8–18 seconds

Invoke:

```text
/claude-recovery:recover
```

Show the observed evidence and the exact keep/reject/change question:

```text
What should the next attempt keep, reject, or change?
```

### 18–28 seconds

Developer decision (type or paste):

```text
Keep the compatibility test and expired-token finding.
Reject the AuthProvider and client migrations.
Start clean and use an adapter.
```

### 28–40 seconds

Show only the important Recovery Contract fields:

```text
KEEP
tests/auth-compat.test.mjs
expired-token finding

DISCARD
src/auth/provider.mjs
src/clients/api-client.mjs

NEXT
clean base
adapter approach
run compatibility test
```

### 40–55 seconds

Explicitly approve. Claude must run **approve** then **finalize** as separate steps. Show the compact receipt:

```bash
node /path/to/claude-recovery/scripts/recovery.mjs receipt \
  --manifest .claude/recovery/recovery-manifest.json
```

Expected shape:

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

In the recovery worktree:

```bash
git diff --name-only
```

It should show only:

```text
tests/auth-compat.test.mjs
```

### 55–75 seconds

Manually launch the **interactive** session (no `-p`):

```bash
cd '<worktree>' && claude --plugin-dir '<plugin-root>'
```

Ask:

```text
Summarize the implementation boundary before editing.
```

The fresh session must identify:

- preserve `AuthProvider.authenticate(token)`
- do not migrate `ApiClient`
- use an adapter
- run `tests/auth-compat.test.mjs`

Do **not** wait for a full implementation in the demo.

If SessionStart injection is unavailable in this environment, **stop and report the exact blocker**. Do not fake injection. Optional fallback (separately labeled): native `setup-hooks.mjs`, or headless `recommendedLaunchCommandHeadless` (`-p`, non-interactive), or manual paste.

## 30-second cut (secondary)

| Time | Action | Caption |
|------|--------|---------|
| 0–5s | `git diff --stat` + failing compat test | Two rejected API changes. One useful test. |
| 5–12s | `/claude-recovery:recover` + decision paste | Keep the test. Reject the migration. |
| 12–20s | Approve → receipt → `git diff --name-only` in worktree | Only the approved test carries forward. |
| 20–30s | Manual interactive launch + boundary summarize | Fresh session. Same boundary. |

## Recording guardrails

- You start the fresh interactive session — the plugin cannot launch Claude or invoke `/clear`.
- Do not describe `-p` as interactive.
- Do not claim seeded `commands.jsonl` was hook-captured.
- Final shot is valid only if SessionStart injects (check `injection-audit.jsonl`) **or** you clearly label a fallback path.
- Discarded source files in the new worktree must remain byte-identical to the clean base.
