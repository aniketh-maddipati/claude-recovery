# Changelog

All notable changes to **claude-recovery** are documented here.

## [0.1.2] - 2026-08-06

### Added

- Mechanically enforced approval state machine: `preview` → `approve` → `finalize` (finalize never calls approve)
- SHA-256 digests for exact `decision.json` bytes and a stable recovery plan payload
- Compact `receipt` command (and `finalize --format compact`) for Loom-friendly output
- `npm run demo:preflight` — local machine checks without global settings writes
- `npm run demo:receipt` — print compact receipt after finalize
- `.claude-plugin/marketplace.json` for single-plugin repository distribution
- Automatic boundary verification during `finalize`
- `recommendedLaunchCommandHeadless` for explicit non-interactive `-p` fallback

### Changed

- Primary launch command is interactive (`cd … && claude --plugin-dir …`); `-p` is headless-only
- Plugin-scoped SessionStart is documented and messaged as the primary handoff
- Native `setup-hooks.mjs` installer labeled as optional compatibility fallback
- Skill flow is `capture → inspect` with separate approve and finalize steps
- Demo fixture is an honest deterministic mixed-attempt overlay (no seeded `decision.json` / fake `commands.jsonl`)
- README tightened for public beta (accurate rewind/branch distinction; tech reference below product explanation)
- Primary demo/recording materials reduced to one auth-service HN scenario; `npm run demo` prints the full paste sequence
- Demo materials simplified to one cold-read card: `demo/PROMPTS.md` (paste prompts + terminal commands)
- Version bumped to 0.1.2 across package and plugin manifests

### Added (beta polish)

- `.github/ISSUE_TEMPLATE/beta-feedback.yml` — sanitized beta feedback questionnaire
- `docs/SHOW_HN.md` — short Show HN draft
- `demo/PROMPTS.md` — cold-read card with paste prompts and terminal commands
- `demo/record.sh` / `npm run demo:record` — preflight + fixture + open PROMPTS.md
- `npm run demo:reset` — remove stale `.demo/` rehearsal artifacts
- Demo fixture setup strips ephemeral session files (`commands.jsonl`, etc.) so preflight passes after rehearsals

### Fixed

- Finalize no longer implicitly approves an unapproved preview
- Changing the decision or plan after approve invalidates finalize before worktree creation
- Removed misleading `BAD ATTEMPT` fixture markers and fake hook-captured evidence from the recording path

## [0.1.1] - 2026-07-31

### Added

- `scripts/setup-hooks.mjs` — optional native Claude Code hooks for SessionStart contract injection
- `scripts/lib/native-hooks.mjs` — shared merge logic for `~/.claude/settings.json`
- Launch command variants for interactive and `-p` embedding paths

### Changed

- `pending-contract.json` stores full `recovery-contract.md` text (Keep/Discard/Next), not just continuation excerpt
- `launch-instructions` exposes interactive and native-hook helper fields
- Manual paste documented as last-resort fallback

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
