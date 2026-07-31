/**
 * Install claude-recovery hooks into native Claude Code settings (~/.claude/settings.json).
 * Native hooks reliably surface SessionStart additionalContext; plugin hooks may not (#16538).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

export const HOOK_SCRIPT_SUFFIX = 'claude-recovery/scripts/session-hook.mjs';

export function defaultSettingsPath() {
  return join(homedir(), '.claude', 'settings.json');
}

export function resolveSettingsPath(override) {
  return override ?? process.env.CLAUDE_RECOVERY_SETTINGS_PATH ?? defaultSettingsPath();
}

export function buildNativeHookEntries(pluginRoot) {
  const command = `node ${join(pluginRoot, 'scripts', 'session-hook.mjs')}`;
  const hook = { type: 'command', command, timeout: 10 };
  return {
    UserPromptSubmit: [{ hooks: [hook] }],
    PreToolUse: [{ matcher: 'Bash', hooks: [hook] }],
    PostToolUse: [{ matcher: 'Bash', hooks: [hook] }],
    SessionStart: [{ matcher: 'startup', hooks: [hook] }],
  };
}

export function isRecoveryHookCommand(command) {
  return typeof command === 'string' && command.includes(HOOK_SCRIPT_SUFFIX);
}

export function hookListsEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Merge recovery native hooks into settings. Replaces prior recovery hook entries only.
 */
export function mergeRecoveryHooks(settings, pluginRoot) {
  const next = { ...settings };
  const desired = buildNativeHookEntries(pluginRoot);
  const existingHooks = { ...(next.hooks ?? {}) };

  for (const [event, desiredEntries] of Object.entries(desired)) {
    const currentEntries = Array.isArray(existingHooks[event]) ? existingHooks[event] : [];
    const filtered = currentEntries.filter((entry) => {
      const inner = entry?.hooks ?? [];
      return !inner.some((h) => isRecoveryHookCommand(h?.command));
    });
    existingHooks[event] = [...filtered, ...desiredEntries];
  }

  next.hooks = existingHooks;
  next.claudeRecovery = {
    pluginRoot,
    nativeHooksInstalledAt: new Date().toISOString(),
    note: 'Native hooks installed for reliable SessionStart contract injection (see LIMITATIONS.md).',
  };
  return next;
}

export function readSettings(path) {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    throw new Error(`Failed to parse settings JSON at ${path}: ${err.message}`);
  }
}

export function recoveryHooksInstalled(settings, pluginRoot) {
  const desired = buildNativeHookEntries(pluginRoot);
  for (const [event, desiredEntries] of Object.entries(desired)) {
    const current = settings.hooks?.[event];
    if (!Array.isArray(current)) return false;
    for (const desiredEntry of desiredEntries) {
      const match = current.some((entry) => hookListsEqual(entry, desiredEntry));
      if (!match) return false;
    }
  }
  return true;
}

export function installNativeHooks({ pluginRoot, settingsPath, dryRun = false } = {}) {
  const path = resolveSettingsPath(settingsPath);
  const previous = readSettings(path);
  const alreadyInstalled = recoveryHooksInstalled(previous, pluginRoot);
  const merged = mergeRecoveryHooks(previous, pluginRoot);

  if (!dryRun) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
  }

  return {
    ok: true,
    settingsPath: path,
    pluginRoot,
    alreadyInstalled,
    dryRun,
    installed: !dryRun,
    recoveryHooksInstalled: recoveryHooksInstalled(merged, pluginRoot),
  };
}
