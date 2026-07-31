# Changelog

All notable changes to **claude-recovery** are documented here.

## [0.1.0] - 2026-07-31

### Added

- Claude Code plugin with `/claude-recovery:recover` skill
- Local evidence capture hooks: `UserPromptSubmit`, `PreToolUse`/`PostToolUse` (Bash), `SessionStart`
- Recovery helper CLI: `capture`, `inspect`, `preview`, `approve`, `finalize`, `verify-boundaries`, worktree + patch commands
- Recovery Contract output: `recovery-contract.md`, `recovery-manifest.json`, `pending-contract.json`
- Scenario-driven e2e tests (`auth-service` golden + `config-toggle`)
- Optional Claude CLI prompt evals and `run-manual-test.mjs` orchestrator
- In-repo manual sandbox (`.sandbox/`) and `quick-smoke.mjs`

### Fixed

- Seed approved `pending-contract.json` into recovery worktree cwd (SessionStart resolves relative to session cwd)
- Improved Claude CLI error reporting in scripted tests (no more opaque `failed: null`)

### Known limitations

See [LIMITATIONS.md](LIMITATIONS.md).
