# Loom recording (45–75s)

Cold-read card + paste/type sequence: [`demo/PROMPTS.md`](PROMPTS.md)

```bash
npm run demo:reset      # if a rehearsal left commands.jsonl
npm run demo:preflight
npm run demo
# open demo/PROMPTS.md
```

Trim model waits in edit. Three overlays (in PROMPTS.md). Stop after fresh session — no second implementation.

## Guardrails

- Loom, single terminal, 16–18 pt
- FIXTURE = `.demo/auth-service` until receipt; then WORKTREE
- Do not fake terminal output or SessionStart injection
- Do not show install/preflight in the final cut
