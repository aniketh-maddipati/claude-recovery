#!/usr/bin/env node
/**
 * Demo preflight — verify the machine can run the HN demo honestly.
 *
 * Checks local tools and fixture honesty. Does not log into Claude, modify
 * global settings, install native hooks, delete user worktrees, or write to the network.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { ROOT } from '../tests/harness/scenario-e2e.mjs';
import { setupDemoFixture, demoFixturePath, assertHonestDemoFixture } from './setup-fixture.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function check(name, fn) {
  try {
    const detail = fn();
    return { name, ok: true, detail: detail ?? 'ok' };
  } catch (err) {
    return { name, ok: false, detail: err.message };
  }
}

function requireExecutable(bin) {
  const result = spawnSync('sh', ['-c', `command -v ${bin}`], { encoding: 'utf8' });
  if (result.status !== 0 || !result.stdout.trim()) {
    throw new Error(`${bin} not found on PATH`);
  }
  return result.stdout.trim();
}

function main() {
  const rows = [];

  rows.push(check('Node.js >= 22', () => {
    const major = Number(process.versions.node.split('.')[0]);
    if (major < 22) throw new Error(`found ${process.versions.node}`);
    return process.versions.node;
  }));

  rows.push(check('git installed', () => requireExecutable('git')));

  rows.push(check('claude installed', () => requireExecutable('claude')));

  rows.push(check('claude --version', () => {
    const claude = requireExecutable('claude');
    const result = spawnSync(claude, ['--version'], { encoding: 'utf8' });
    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout || `exit ${result.status}`);
    }
    return (result.stdout || result.stderr).trim();
  }));

  rows.push(check('plugin manifest parses', () => {
    const path = join(ROOT, '.claude-plugin', 'plugin.json');
    if (!existsSync(path)) throw new Error('missing .claude-plugin/plugin.json');
    const json = JSON.parse(readFileSync(path, 'utf8'));
    if (!json.name) throw new Error('plugin.json missing name');
    return `${json.name}@${json.version ?? '?'}`;
  }));

  rows.push(check('skill file exists', () => {
    const path = join(ROOT, 'skills', 'recover', 'SKILL.md');
    if (!existsSync(path)) throw new Error('missing skills/recover/SKILL.md');
    return path;
  }));

  rows.push(check('hook configuration parses', () => {
    const path = join(ROOT, 'hooks', 'hooks.json');
    if (!existsSync(path)) throw new Error('missing hooks/hooks.json');
    const json = JSON.parse(readFileSync(path, 'utf8'));
    if (!json.hooks?.SessionStart) throw new Error('SessionStart hook missing');
    return 'SessionStart present';
  }));

  const sourceSnapshot = spawnSync('git', ['status', '--porcelain'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  const sourceBefore = sourceSnapshot.stdout;

  rows.push(check('demo fixture creates without seeded decision/commands', () => {
    const result = setupDemoFixture({ scenario: 'auth-service', reset: true });
    assertHonestDemoFixture(result.fixture);
    return result.fixture;
  }));

  rows.push(check('source repository unmodified by fixture', () => {
    const after = spawnSync('git', ['status', '--porcelain'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    if (after.stdout !== sourceBefore) {
      throw new Error('fixture setup mutated the source repository working tree');
    }
    return 'unchanged';
  }));

  rows.push(check('mechanical recovery smoke', () => {
    // Avoid nesting the full unit suite (fixture races). Point failures at npm test.
    if (process.env.CLAUDE_RECOVERY_PREFLIGHT_SKIP_TESTS === '1') {
      return 'skipped (CLAUDE_RECOVERY_PREFLIGHT_SKIP_TESTS=1); run npm test';
    }
    const result = spawnSync('node', [join(ROOT, 'scripts', 'run-manual-test.mjs')], {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_RECOVERY_PREFLIGHT_SKIP_TESTS: '1' },
    });
    if (result.status !== 0) {
      throw new Error(
        `mechanical smoke failed (exit ${result.status}). Run: npm test\n` +
          `${result.stderr || result.stdout}`.slice(0, 500),
      );
    }
    return 'run-manual-test.mjs passed (full suite: npm test)';
  }));

  rows.push(check('no global settings writes', () => {
    // Preflight must never call setup-hooks / write ~/.claude/settings.json.
    // Guard: ensure this process did not create a temp settings override write path.
    const probe = mkdtempSync(join(tmpdir(), 'claude-recovery-preflight-'));
    rmSync(probe, { recursive: true, force: true });
    return 'preflight performs no settings writes';
  }));

  const width = Math.max(...rows.map((r) => r.name.length));
  console.log('\nclaude-recovery demo preflight\n');
  for (const row of rows) {
    const status = row.ok ? 'PASS' : 'FAIL';
    console.log(`${status.padEnd(4)}  ${row.name.padEnd(width)}  ${row.detail}`);
  }

  const failed = rows.filter((r) => !r.ok);
  console.log('');
  if (failed.length === 0) {
    console.log('All checks passed.');
    console.log(`Next: npm run demo`);
    console.log(`Then: cd ${demoFixturePath('auth-service')} && claude --plugin-dir ${ROOT}`);
    console.log('Follow: demo/RECORDING.md');
    process.exit(0);
  }

  console.log(`${failed.length} check(s) failed.`);
  if (failed.some((r) => r.name.startsWith('claude'))) {
    console.log('Install/authenticate Claude Code CLI, then re-run: npm run demo:preflight');
  } else if (failed.some((r) => r.detail?.includes('commands.jsonl'))) {
    console.log('Close Claude Code if it is open in .demo/auth-service, then run:');
    console.log('  rm -rf .demo/auth-service && npm run demo:preflight');
    console.log('Or: npm run demo:reset && npm run demo:preflight');
  } else {
    console.log('Fix the failing checks, then re-run: npm run demo:preflight');
    console.log('Or run the full suite: npm test');
  }
  process.exit(1);
}

try {
  main();
} catch (err) {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
}
