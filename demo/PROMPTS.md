# Demo teleprompter

Read **SAY** lines aloud. **TYPE** the prompts below. Stay silent on **WAIT**.

## Commands (copy or type)

```bash
# once per session
export CLAUDE_RECOVERY_PLUGIN_DIR=$HOME/Downloads/claude-recovery.zip

# Step 0 — Claude in fixture
cd ~/claude-recovery/.demo/auth-service && claude --plugin-dir "$CLAUDE_RECOVERY_PLUGIN_DIR"

# Step 7 — worktree diff (after receipt)
cd "$(node ~/claude-recovery/demo/demo-cmd.mjs worktree)" && git diff --name-only

# Step 8 — fresh Claude in worktree
cd "$(node ~/claude-recovery/demo/demo-cmd.mjs worktree)" && claude --plugin-dir "$CLAUDE_RECOVERY_PLUGIN_DIR"
```

## Type into Claude

| Step | Type |
|------|------|
| 3 | `Run compat test and git diff --stat. No edits.` |
| 4 | `/claude-recovery:recover` |
| 5 | `Keep compat test and expired-token finding. Reject AuthProvider and ApiClient migration. Adapter next pass, require compat test.` |
| 6 | `Approved. Approve and finalize separately, show receipt.` |
| 8 | `Summarize boundary and verification before editing.` |

---

## Setup (off camera)

```bash
cd ~/claude-recovery
npm run plugin:zip
npm run demo:reset && npm run demo:preflight && npm run demo
export CLAUDE_RECOVERY_PLUGIN_DIR=$HOME/Downloads/claude-recovery.zip
```

---

## Step 0 — Launch

**RUN:**
```bash
cd ~/claude-recovery/.demo/auth-service && claude --plugin-dir "$CLAUDE_RECOVERY_PLUGIN_DIR"
```

---

## Step 1 — Why this exists

**SAY:**
> I built claude-recovery for when a Claude Code attempt is mixed. Rewind throws away everything after a checkpoint. Here I reject the implementation, but a test or finding is still useful. This lets me choose what survives and hand the next session a Recovery Contract.

---

## Step 2 — What this repo is

**SAY:**
> Quick context. Fake mini app. Login checker authenticate was renamed verifyRequest. Useful guardrail test fails. Keeping the test.

---

## Step 3 — Evidence

**SAY:**
> Let me show the evidence — the failing test and what files changed.

**TYPE:** `Run compat test and git diff --stat. No edits.`

**WAIT** · **SEE:** failing test + diff

**SAY:**
> authenticate gone, verifyRequest in place, client migrated, test failing. Want the test, not the rename.

---

## Step 4 — Recover

**SAY:**
> Invoking recover.

**TYPE:** `/claude-recovery:recover`

**WAIT** · **SEE:** keep/reject question

---

## Step 5 — Decide

**SAY:**
> Keeping test and finding, rejecting migration, adapter next pass.

**TYPE:** `Keep compat test and expired-token finding. Reject AuthProvider and ApiClient migration. Adapter next pass, require compat test.`

**WAIT** · **SEE:** contract preview

---

## Step 6 — Approve

**SAY:**
> Looks right. Approving.

**TYPE:** `Approved. Approve and finalize separately, show receipt.`

**WAIT** · **SEE:** receipt, Boundary PASS

---

## Step 7 — Worktree

**SAY:**
> Only the approved test should differ.

**RUN:**
```bash
cd "$(node ~/claude-recovery/demo/demo-cmd.mjs worktree)" && git diff --name-only
```

**SEE:** only `tests/auth-compat.test.mjs`

---

## Step 8 — Fresh session

**SAY:**
> Fresh session — restate the boundary.

**RUN:**
```bash
cd "$(node ~/claude-recovery/demo/demo-cmd.mjs worktree)" && claude --plugin-dir "$CLAUDE_RECOVERY_PLUGIN_DIR"
```

**TYPE:** `Summarize boundary and verification before editing.`

**WAIT** · **SEE:** boundary summary

---

## Step 9 — Close

**SAY:**
> Same boundary, clean tree, test kept. Stopping here.

**STOP LOOM.**

---

Recording notes: [`demo/RECORDING.md`](RECORDING.md)
