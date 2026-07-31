#!/usr/bin/env node
/**
 * Build a disposable auth-service demo fixture under .demo/auth-service.
 * Seeds commands.jsonl evidence for the 30-second silent demo recording.
 */

import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { setupFixtureSandbox, ROOT } from '../tests/harness/scenario-e2e.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DEMO_ROOT = join(ROOT, '.demo');
export const DEMO_FIXTURE = join(DEMO_ROOT, 'auth-service');

function runRecovery(args, cwd) {
  const result = spawnSync('node', [join(ROOT, 'scripts', 'recovery.mjs'), ...args], {
    cwd,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`recovery.mjs ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  }
  return JSON.parse(result.stdout);
}

function seedCommandsEvidence(recoveryDir) {
  const commandsPath = join(recoveryDir, 'commands.jsonl');
  const expiredTokenCommand =
    "node -e \"import('./src/auth/provider.mjs').then(({AuthProvider})=>{const p=new AuthProvider('secret');console.log(JSON.stringify(p.verifyRequest({headers:{authorization:'Bearer expired-abc'}})));})\"";
  const testCommand = 'node --test tests/auth-compat.test.mjs';

  const records = [
    {
      label: 'Observed evidence',
      phase: 'post',
      timestamp: '2026-07-31T04:12:01.120Z',
      sessionId: 'demo-auth-service',
      command: expiredTokenCommand,
      stdout: '{"ok":false,"reason":"invalid or expired token"}\n',
      stderr: '',
      interrupted: false,
      durationMs: 42,
    },
    {
      label: 'Observed evidence',
      phase: 'post',
      timestamp: '2026-07-31T04:12:08.210Z',
      sessionId: 'demo-auth-service',
      command: testCommand,
      stdout: [
        'TAP version 13',
        '# Subtest: AuthProvider preserves authenticate(token) interface for clients',
        'not ok 1 - AuthProvider preserves authenticate(token) interface for clients',
        '  ---',
        '  error: |-',
        "    Expected values to be strictly equal:",
        "    + 'undefined'",
        "    - 'function'",
        '  ...',
        '# tests 1',
        '# pass 0',
        '# fail 1',
      ].join('\n'),
      stderr: '',
      interrupted: false,
      durationMs: 43,
    },
  ];

  writeFileSync(commandsPath, records.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
}

export function setupDemoFixture({ reset = true } = {}) {
  if (existsSync(DEMO_FIXTURE)) {
    if (!reset) {
      return { fixture: DEMO_FIXTURE, reused: true };
    }
    spawnSync('git', ['worktree', 'prune'], { cwd: DEMO_FIXTURE, encoding: 'utf8' });
    rmSync(DEMO_FIXTURE, { recursive: true, force: true });
  }

  const { cleanBaseSha } = setupFixtureSandbox('auth-service', DEMO_FIXTURE, {
    withBadAttempt: true,
  });

  const recoveryDir = join(DEMO_FIXTURE, '.claude', 'recovery');
  seedCommandsEvidence(recoveryDir);
  runRecovery(['capture'], DEMO_FIXTURE);

  const pluginDir = process.env.CLAUDE_RECOVERY_PLUGIN_DIR || ROOT;
  const launchCommand = `cd ${DEMO_FIXTURE} && claude --plugin-dir ${pluginDir}`;

  return {
    ok: true,
    fixture: DEMO_FIXTURE,
    cleanBaseSha,
    pluginDir,
    launchCommand,
    reused: false,
    decisionPaste:
      'Keep the compatibility test and expired-token discovery. The API migration is rejected. Start from the clean base and use an adapter. Do not resume this session.',
    demoCommands: {
      originalOutcome: 'cat .claude/recovery/original-outcome.json',
      diffStat: 'git diff --stat HEAD',
      verifyRequest: "git diff HEAD -- src/auth/provider.mjs src/clients/api-client.mjs",
      evidenceTail: 'tail -n 2 .claude/recovery/commands.jsonl',
      recoverSkill: '/claude-recovery:recover',
      contractFile: 'cat .claude/recovery/recovery-contract.md',
      continuationContext:
        "node -e \"const m=require('fs').readFileSync('.claude/recovery/recovery-manifest.json','utf8');console.log(JSON.parse(m).continuationContext)\"",
    },
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const result = setupDemoFixture();
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
    process.exit(1);
  }
}
