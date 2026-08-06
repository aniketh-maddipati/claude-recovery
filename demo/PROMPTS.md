# Demo prompts (copy-paste)

Use this file during Loom recordings. Every block matches the implemented recover → preview → approve → finalize flow.

**Setup:**

```bash
npm run demo:preflight
npm run demo                              # auth-service (primary HN demo)
npm run demo:config                       # config-toggle (simpler story)
```

Then run the printed interactive `cd ... && claude --plugin-dir ...` command.

The fixture is a **deterministic mixed-attempt overlay**. It is not live proof of independent instruction violation. `decision.json` and `commands.jsonl` start absent.

---

## Primary scenario — auth-service (60–75 sec)

### Story (say this on camera)

> This attempt changed two public interfaces, but also produced a useful compatibility test and an expired-token finding. Recovery keeps only what we approve.

### Show the problem

```bash
git diff --stat
node --test tests/auth-compat.test.mjs
```

Run the failing test through Claude’s Bash tool when hooks are loaded so real PostToolUse evidence is captured.

### Recovery flow — paste in order

**1. Start recovery**

```
/claude-recovery:recover
```

**2. When asked what to keep / reject / change**

```
Keep the compatibility test and expired-token finding.
Reject the AuthProvider and client migrations.
Start clean and use an adapter.
```

**3. When the contract preview looks right**

```
Approved. Run approve, then finalize, then show the compact receipt and interactive launch command.
```

**4. After finalize — show receipt (or ask Claude to run it)**

```bash
node /path/to/claude-recovery/scripts/recovery.mjs receipt \
  --manifest .claude/recovery/recovery-manifest.json
```

**5. In the new worktree (you start this manually — interactive, no `-p`)**

```
Summarize the implementation boundary before editing.
```

Expected themes in the reply:

- preserve `AuthProvider.authenticate(token)`
- do not migrate `ApiClient`
- use an adapter
- run `tests/auth-compat.test.mjs`

---

## Secondary scenario — config-toggle

### Setup

```bash
npm run demo:config
```

### Decision

```
Keep the smoke test and default-false finding. Reject the getConfig rename. Fresh session from clean base.
```

### Approve

```
Approved. Run approve, then finalize, then show the compact receipt and interactive launch command.
```

### Fresh session

```
Summarize the implementation boundary before editing.
```

---

## Live simulation (optional)

Use only when you want to create the rejected attempt on camera. Prefer the deterministic fixture for the primary HN cut.

```bash
npm run demo:live -- auth-service
```

Paste the initial task from the printed instructions. If you need the rejected overlay shape for rehearsal, the printed nudge is **explicit demo setup** — do not imply it happened without instruction.

Then run the failing test through Bash, invoke `/claude-recovery:recover`, and continue with the recovery prompts above.

---

## Quick reference

| Step | Prompt / command |
|------|------------------|
| Invoke | `/claude-recovery:recover` |
| auth-service decision | Keep compat test + expired-token finding; reject AuthProvider + client migrations; adapter |
| Approve | `Approved. Run approve, then finalize, then show the compact receipt and interactive launch command.` |
| Fresh session | `Summarize the implementation boundary before editing.` |
| Interactive launch | `cd '<worktree>' && claude --plugin-dir '<plugin-root>'` |
| Headless fallback | same + `-p "$(cat .claude/recovery/recovery-contract.md)"` (non-interactive) |

---

## Recording guardrails

- **You** start the fresh interactive session after finalize.
- Plugin SessionStart is the primary handoff. Native `setup-hooks` is optional.
- Never describe `-p` as interactive.
- If SessionStart is unavailable, stop and report the blocker — do not fake injection.
- Do not pre-seed or describe fake `commands.jsonl` as hook-captured evidence.
