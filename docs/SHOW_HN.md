# Show HN draft

**Title:**

```text
Show HN: Selectively salvage useful work from a Claude Code attempt
```

**Opening:**

```text
I built this for a specific recovery case: I need to restart a Claude
Code attempt, but the later work is mixed. The implementation direction
is rejected while a test or finding is still useful.

Native rewind handles chronological rollback. This beta lets the
developer select what survives, previews that choice as a Recovery
Contract, and creates a clean Git worktree containing only the approved
whole-file changes.
```

**Ask for feedback on:**

- whether this mixed-attempt case occurs in real work;
- whether the contract is less effort than manual reconstruction;
- whether whole-file selection is sufficient.

**Links:**

- Repo: https://github.com/aniketh-maddipati/claude-recovery
- Demo: `npm run demo` (prints the full interactive sequence)
- Beta feedback: use the GitHub issue template

**Do not claim** in the post:

- that rewind or branch cannot perform their own jobs;
- that the fixture proves independent instruction violation;
- that SessionStart injection was verified if it was not smoke-tested on a Mac with Claude Code.
