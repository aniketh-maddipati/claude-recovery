#!/usr/bin/env node
/**
 * Optional compatibility fallback: install claude-recovery hooks into native
 * Claude Code settings (~/.claude/settings.json).
 *
 * Primary SessionStart handoff is the plugin-scoped hook in hooks/hooks.json.
 * Use this installer only when plugin SessionStart additionalContext is unavailable.
 *
 *   node scripts/setup-hooks.mjs
 *   node scripts/setup-hooks.mjs --check
 *   node scripts/setup-hooks.mjs --dry-run
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  installNativeHooks,
  readSettings,
  recoveryHooksInstalled,
  resolveSettingsPath,
} from './lib/native-hooks.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, '..');

function parseArgs(argv) {
  const options = { check: false, dryRun: false, settingsPath: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--check') options.check = true;
    if (arg === '--dry-run') options.dryRun = true;
    if (arg === '--settings-path') {
      options.settingsPath = argv[i + 1];
      i += 1;
    }
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const settingsPath = resolveSettingsPath(options.settingsPath);

  if (options.check) {
    const settings = readSettings(settingsPath);
    const installed = recoveryHooksInstalled(settings, PLUGIN_ROOT);
    console.log(JSON.stringify({
      ok: true,
      settingsPath,
      pluginRoot: PLUGIN_ROOT,
      recoveryHooksInstalled: installed,
      claudeRecovery: settings.claudeRecovery ?? null,
    }, null, 2));
    process.exit(installed ? 0 : 1);
  }

  const result = installNativeHooks({
    pluginRoot: PLUGIN_ROOT,
    settingsPath: options.settingsPath,
    dryRun: options.dryRun,
  });

  console.log(JSON.stringify({
    ...result,
    message: result.alreadyInstalled && !options.dryRun
      ? 'Native recovery hooks were already installed; settings refreshed (optional fallback).'
      : options.dryRun
        ? 'Dry run — no settings file written.'
        : 'Installed native recovery hooks as an optional compatibility fallback. ' +
          'Prefer the plugin-scoped SessionStart hook for normal use.',
    nextStep:
      'Primary path: launch Claude interactively in the recovery worktree with --plugin-dir. ' +
      'Native hooks are only needed if plugin SessionStart injection fails on your Claude Code build.',
  }, null, 2));
}

try {
  main();
} catch (err) {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
}
