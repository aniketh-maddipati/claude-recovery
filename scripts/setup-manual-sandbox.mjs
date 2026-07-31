#!/usr/bin/env node
/**
 * Build a persistent Git sandbox under .sandbox/ for interactive /recover testing.
 *
 *   node scripts/setup-manual-sandbox.mjs
 *   node scripts/setup-manual-sandbox.mjs --with-bad-attempt
 *   node scripts/setup-manual-sandbox.mjs --reset
 *   node scripts/setup-manual-sandbox.mjs --scenario config-toggle
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { setupFixtureSandbox, ROOT } from '../tests/harness/scenario-e2e.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SANDBOX_ROOT = join(ROOT, '.sandbox');

function parseArgs(argv) {
  const options = {
    scenario: 'auth-service',
    withBadAttempt: false,
    reset: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--with-bad-attempt') options.withBadAttempt = true;
    if (arg === '--reset') options.reset = true;
    if (arg === '--scenario') {
      options.scenario = argv[i + 1];
      i += 1;
    }
  }
  return options;
}

function setupSandbox({ scenario, withBadAttempt, reset }) {
  const sandbox = join(SANDBOX_ROOT, scenario);
  if (existsSync(sandbox)) {
    if (!reset && !withBadAttempt) {
      console.log(`Sandbox already exists: ${sandbox}`);
      printNextSteps(scenario, sandbox);
      return { sandbox, cleanBaseSha: null, withBadAttempt };
    }
    spawnSync('git', ['worktree', 'prune'], { cwd: sandbox, encoding: 'utf8' });
    rmSync(sandbox, { recursive: true, force: true });
  }

  mkdirSync(SANDBOX_ROOT, { recursive: true });
  const { cleanBaseSha } = setupFixtureSandbox(scenario, sandbox, { withBadAttempt });

  writeFileSync(
    join(sandbox, 'SANDBOX.md'),
    [
      `# ${scenario} manual sandbox`,
      '',
      'Created by `node scripts/setup-manual-sandbox.mjs`.',
      '',
      'Start Claude from this directory:',
      '',
      '```bash',
      `claude --plugin-dir ${ROOT}`,
      '```',
      '',
      'Prompts: `node scripts/run-manual-test.mjs --print-prompts`',
      '',
    ].join('\n'),
  );

  console.log(JSON.stringify({
    ok: true,
    scenario,
    sandbox,
    cleanBaseSha,
    withBadAttempt,
    pluginDir: ROOT,
  }, null, 2));
  printNextSteps(scenario, sandbox);
  return { sandbox, cleanBaseSha, withBadAttempt };
}

function printNextSteps(scenario, sandbox) {
  const pluginDir = process.env.CLAUDE_RECOVERY_PLUGIN_DIR || ROOT;
  console.error(`
Next:
  cd ${sandbox}
  claude --plugin-dir ${pluginDir}

Prompts:
  node scripts/run-manual-test.mjs --print-prompts --scenario ${scenario}
`);
}

try {
  setupSandbox(parseArgs(process.argv.slice(2)));
} catch (err) {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
}
