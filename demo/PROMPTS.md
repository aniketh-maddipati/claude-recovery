# Demo prompts (copy-paste)

Use this file during Loom recordings. Every block below is ready to paste into Claude Code or your terminal.

**Setup (pick one):**

```bash
npm run demo                              # auth-service (default, best for 30-sec cut)
npm run demo:config                       # config-toggle (simplest story)
npm run demo:live -- auth-service         # clean codebase — you create the mistake live
npm run demo:live -- config-toggle
```

Then run the printed `cd ... && claude --plugin-dir ...` command.

---

## Which scenario should I use?

| Scenario | Best for | One-line story | The mistake you'll show |
|----------|----------|----------------|-------------------------|
| **config-toggle** | First Loom, non-technical audience | "Add feature flags" | `getConfig()` renamed to `loadSettings()` |
| **auth-service** | 30-sec silent demo, API boundaries | "Add auth without breaking clients" | `authenticate()` renamed to `verifyRequest()` |

**Recommendation:** Start with **config-toggle** in Loom — one file changes, one obvious rename, easy to read on screen.

---

## Scenario A — config-toggle (simplest)

### The story (say this on camera)

> Claude was asked to add feature flags. Your rule was: don't rename `getConfig()`. Claude renamed it anyway. Recovery keeps the smoke test and restarts from a clean base.

### Pre-built fixture

```bash
npm run demo:config
```

### Terminal commands to show the problem

```bash
cat .claude/recovery/original-outcome.json
git diff --stat HEAD
git diff HEAD -- src/config.mjs
tail -n 2 .claude/recovery/commands.jsonl
```

### Recovery flow — paste in order

**1. Start recovery**

```
/claude-recovery:recover
```

**2. When asked what to keep / reject / change**

```
Keep the smoke test and default-false finding. Reject the getConfig rename. Fresh session from clean base.
```

**3. When the contract preview looks right**

```
Approved. Run finalize and print the launch command only.
```

**4. In the new worktree session (you start this manually)**

```
Use the Recovery Contract. Add a feature flag reader without renaming getConfig. Run: node --test tests/config-smoke.test.mjs
```

### Loom captions

| Moment | Caption |
|--------|---------|
| Show diff | **getConfig was renamed despite a no-rename boundary.** |
| Show evidence | **The smoke test caught the breaking change.** |
| Paste decision | **Keep the test. Reject the rename.** |
| Show contract | **Clean base + wrapper approach + required verification.** |
| Show finalize | **Only the approved smoke test carries forward.** |
| Fresh session | **Fresh context. Same boundary. No reconstruction.** |

---

## Scenario B — auth-service (30-sec demo)

### The story (say this on camera)

> Claude was asked to add authentication without changing the public API or forcing a client migration. It rewrote the interface anyway. Recovery salvages the compatibility test and expired-token finding.

### Pre-built fixture

```bash
npm run demo
```

### Terminal commands to show the problem

```bash
cat .claude/recovery/original-outcome.json
git diff --stat HEAD
git diff HEAD -- src/auth/provider.mjs src/clients/api-client.mjs
tail -n 2 .claude/recovery/commands.jsonl
```

### Recovery flow — paste in order

**1. Start recovery**

```
/claude-recovery:recover
```

**2. When asked what to keep / reject / change**

```
Keep the compatibility test and expired-token discovery. The API migration is rejected. Start from the clean base and use an adapter. Do not resume this session.
```

**3. When the contract preview looks right**

```
Approved. Run finalize and print the launch command only.
```

**4. In the new worktree session (you start this manually)**

```
Use the Recovery Contract. Add request authentication with an adapter around AuthProvider. Do not change AuthProvider or api-client.mjs. Before claiming completion run: node --test tests/auth-compat.test.mjs
```

### Loom captions

| Moment | Caption |
|--------|---------|
| Show diff | **AuthProvider changed despite a no-migration boundary.** |
| Show evidence | **Useful evidence exists inside a rejected attempt.** |
| Paste decision | **Keep the test. Reject the migration.** |
| Show contract | **Clean base + adapter approach + required verification.** |
| Show finalize | **Only the approved compatibility test carries forward.** |
| Fresh session | **Fresh context. Same boundary. No reconstruction.** |

---

## Live simulation (build the mistake on camera)

Use this when you want the bad attempt to happen in the recording — not pre-seeded.

### 1. Start a clean sample codebase

```bash
npm run demo:live -- config-toggle
# or: npm run demo:live -- auth-service
```

Run the printed `claude --plugin-dir` command.

### 2. Paste the initial task

**config-toggle:**

```
Add a feature flag reader to this project.

Hard boundary:
- Do not rename the exported getConfig API.

Add a smoke test if helpful.
```

**auth-service:**

```
Add request authentication to this service.

Hard boundaries:
- Do not change the exported AuthProvider interface (keep authenticate(token)).
- Do not require a client migration.

Add tests if helpful.
```

### 3. Paste the "bad attempt" nudge (if Claude didn't break the boundary on its own)

**config-toggle:**

```
Refactor config.mjs: rename getConfig to loadSettings and update exports. Commit the changes.
```

**auth-service:**

```
Implement authentication by changing AuthProvider to verifyRequest(request) and update api-client.mjs to use it. Commit the changes.
```

### 4. Run evidence commands in the terminal (creates commands.jsonl if hooks are installed)

**config-toggle:**

```bash
node -e "import('./src/config.mjs').then((m)=>console.log(typeof m.getConfig))"
node --test tests/config-smoke.test.mjs
```

**auth-service:**

```bash
node -e "import('./src/auth/provider.mjs').then(({AuthProvider})=>{const p=new AuthProvider('secret');console.log(JSON.stringify(p.verifyRequest({headers:{authorization:'Bearer expired-abc'}})));})"
node --test tests/auth-compat.test.mjs
```

If hooks aren't installed, recovery still works — Git diff is enough evidence.

### 5. Continue with recovery prompts above

Use the matching scenario's `/claude-recovery:recover` block from this file.

---

## Quick reference — all recovery prompts

| Step | Prompt |
|------|--------|
| Invoke | `/claude-recovery:recover` |
| config-toggle decision | `Keep the smoke test and default-false finding. Reject the getConfig rename. Fresh session from clean base.` |
| auth-service decision | `Keep the compatibility test and expired-token discovery. The API migration is rejected. Start from the clean base and use an adapter. Do not resume this session.` |
| Approve | `Approved. Run finalize and print the launch command only.` |

---

## Recording guardrails

- **You** start the fresh session after finalize — the plugin cannot launch Claude or submit the first prompt.
- Final shot is valid only if `.claude/recovery/injection-audit.jsonl` has a `SessionStart` entry and the first response mentions the boundary + required test.
- If SessionStart hooks fail, show `recovery-contract.md` and use `recommendedLaunchCommand` as a separately labeled fallback.

```bash
npm run setup-hooks    # one-time fix for SessionStart injection
```

---

## Files in the sample codebase

**config-toggle**

```
src/config.mjs          ← getConfig() lives here (clean) / renamed to loadSettings() (bad)
tests/config-smoke.test.mjs   ← test you keep after recovery
```

**auth-service**

```
src/auth/provider.mjs         ← authenticate() (clean) / verifyRequest() (bad)
src/clients/api-client.mjs    ← updated to use new API (bad)
tests/auth-compat.test.mjs    ← test you keep after recovery
```
