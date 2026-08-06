# Silent 30-second demo — recording script

Prepare the fixture:

```bash
./demo/run-demo.sh
# or: npm run demo              # auth-service (30-sec default)
# or: npm run demo:config       # config-toggle (simplest for Loom)
```

**All copy-paste prompts:** [`demo/PROMPTS.md`](PROMPTS.md)

Run the printed `cd ... && claude --plugin-dir ...` command in a terminal with authenticated Claude Code. This is a real Git worktree — do not substitute an edited terminal recording.

**Terminal:** 120% zoom, crop to the active pane. Use captions below as brief editing overlays.

| Time | Screen action | On-screen caption |
|---|---|---|
| 0–3 sec | Title card on a dark background. | **Claude Code recovery: keep the good work, restart cleanly.** |
| 3–7 sec | In the prepared fixture, show `cat .claude/recovery/original-outcome.json`, then the three-line `git diff --stat` and the `verifyRequest` / changed client call. | **AuthProvider changed despite a no-migration boundary.** |
| 7–11 sec | Show only the two saved evidence records: `tail -n 2 .claude/recovery/commands.jsonl`. Keep the visible output to the expired-token result and failed compatibility test summary. | **Useful evidence exists inside a rejected attempt.** |
| 11–17 sec | Type `/claude-recovery:recover`. When asked, paste the decision from `run-demo.sh`. Approve when Claude shows the contract preview. | **Keep the test. Reject the migration.** |
| 17–22 sec | Show continuation context from the preview (`continuationContext` in recovery-manifest.json, or the preview output). Focus on Outcome, Non-negotiable boundary, Carry forward, Rejected approach, and Before claiming completion. | **Clean base + adapter approach + required verification.** |
| 22–26 sec | Show the compact `finalize` result: new worktree path and `applied: tests/auth-compat.test.mjs`; then `git diff --name-only` in the new worktree. Do not scroll. | **Only the approved compatibility test carries forward.** |
| 26–30 sec | Run the printed `freshClaudeCommand` yourself. In the new Claude session, show the Recovery Contract context and a short first response such as “I'll use an adapter and run `node --test tests/auth-compat.test.mjs`.” | **Fresh context. Same boundary. No reconstruction.** |

## Quick command reference (inside the fixture)

```bash
cat .claude/recovery/original-outcome.json
git diff --stat HEAD
git diff HEAD -- src/auth/provider.mjs src/clients/api-client.mjs
tail -n 2 .claude/recovery/commands.jsonl
/claude-recovery:recover
node -e "const m=require('fs').readFileSync('.claude/recovery/recovery-manifest.json','utf8');console.log(JSON.parse(m).continuationContext)"
# after finalize, in the new worktree:
git diff --name-only
```

## Recording guardrails

- The user — not the plugin — starts the fresh interactive session. The plugin cannot invoke `/clear`, launch Claude, or submit the first interactive prompt.
- The final shot is valid only if the new session's `.claude/recovery/injection-audit.jsonl` has a `SessionStart` entry and the first response acknowledges the adapter boundary and required test.
- If the plugin hook does not load in the installed Claude Code build, do not claim success. Show `recovery-contract.md` and use the explicit non-interactive `recommendedLaunchCommand` only as a separately labeled fallback.

## Fallback when SessionStart hooks fail

```bash
node scripts/setup-hooks.mjs   # one-time native hook install
# or use recommendedLaunchCommand from finalize output (embeds contract via -p)
```
