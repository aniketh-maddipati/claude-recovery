# Changelog

All notable changes to **claude-recovery** are documented here.

## [0.1.1] - 2026-07-31

### Added

- `scripts/setup-hooks.mjs` — one-time install of native Claude Code hooks for reliable SessionStart contract injection
- `scripts/lib/native-hooks.mjs` — shared merge logic for `~/.claude/settings.json`
- Launch command now embeds `recovery-contract.md` via `-p "$(cat ...)"` as the primary reliable path

### Changed

- `pending-contract.json` stores full `recovery-contract.md` text (Keep/Discard/Next), not just continuation excerpt
- `launch-instructions` exposes `recommendedLaunchCommandInteractive` and `setupNativeHooksCommand`
- Manual paste documented as last-resort fallback, not primary path

## [0.1.0] - 2026-07-31

### Added

- Claude Code plugin with `/claude-recovery:recover` skill
- Local evidence capture hooks: `UserPromptSubmit`, `PreToolUse`/`PostToolUse` (Bash), `SessionStart`
- Recovery helper CLI: `capture`, `inspect`, `preview`, `approve`, `finalize`, `verify-boundaries`, worktree + patch commands
- Recovery Contract output: `recovery-contract.md`, `recovery-manifest.json`, `pending-contract.json`
- Scenario-driven e2e tests (`auth-service` golden + `config-toggle`)
- Optional Claude CLI prompt evals and `run-manual-test.mjs` orchestrator (`--eval`, `--claude`, `--sandbox`)
- In-repo manual sandbox (`.sandbox/`)

### Fixed

- Seed approved `pending-contract.json` into recovery worktree cwd (SessionStart resolves relative to session cwd)
- Improved Claude CLI error reporting in scripted tests (no more opaque `failed: null`)

### Known limitations

See [LIMITATIONS.md](LIMITATIONS.md).
