import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildNativeHookEntries,
  installNativeHooks,
  mergeRecoveryHooks,
  readSettings,
  recoveryHooksInstalled,
} from '../scripts/lib/native-hooks.mjs';

test('mergeRecoveryHooks adds all recovery events without clobbering unrelated hooks', () => {
  const pluginRoot = '/tmp/claude-recovery';
  const merged = mergeRecoveryHooks({
    hooks: {
      PreToolUse: [{
        matcher: 'Write',
        hooks: [{ type: 'command', command: 'echo custom' }],
      }],
    },
  }, pluginRoot);

  assert.ok(recoveryHooksInstalled(merged, pluginRoot));
  assert.equal(merged.hooks.PreToolUse.length, 2);
  assert.equal(merged.hooks.PreToolUse[0].hooks[0].command, 'echo custom');
  assert.match(merged.hooks.SessionStart[0].hooks[0].command, /session-hook\.mjs$/);
});

test('installNativeHooks writes settings and is idempotent', () => {
  const dir = mkdtempSync(join(tmpdir(), 'claude-recovery-settings-'));
  const settingsPath = join(dir, 'settings.json');
  const pluginRoot = join(dir, 'plugin');
  try {
    const first = installNativeHooks({ pluginRoot, settingsPath });
    assert.equal(first.installed, true);
    assert.equal(first.recoveryHooksInstalled, true);

    const onDisk = JSON.parse(readFileSync(settingsPath, 'utf8'));
    assert.ok(recoveryHooksInstalled(onDisk, pluginRoot));

    const second = installNativeHooks({ pluginRoot, settingsPath });
    assert.equal(second.alreadyInstalled, true);
    assert.equal(second.recoveryHooksInstalled, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('buildNativeHookEntries uses absolute plugin script path', () => {
  const entries = buildNativeHookEntries('/opt/claude-recovery');
  assert.match(entries.SessionStart[0].hooks[0].command, /^node /);
  assert.match(entries.SessionStart[0].hooks[0].command, /\/opt\/claude-recovery\/scripts\/session-hook\.mjs$/);
});

test('readSettings returns empty object for missing file', () => {
  assert.deepEqual(readSettings('/tmp/does-not-exist-claude-recovery-settings.json'), {});
});
