#!/usr/bin/env node
/**
 * Build a disposable Git sandbox inside this repo for manual /recover testing.
 *
 *   node scripts/setup-manual-sandbox.mjs
 *   node scripts/setup-manual-sandbox.mjs --with-bad-attempt
 *   node scripts/setup-manual-sandbox.mjs --reset
 *   node scripts/setup-manual-sandbox.mjs --scenario config-toggle
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
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

function git(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

function overlayDirectory(src, dest) {
  if (!existsSync(src)) return;
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const from = join(src, entry.name);
    const to = join(dest, entry.name);
    if (entry.isDirectory()) {
      mkdirSync(to, { recursive: true });
      overlayDirectory(from, to);
    } else {
      mkdirSync(dirname(to), { recursive: true });
      cpSync(from, to);
    }
  }
}

function setupSandbox({ scenario, withBadAttempt, reset }) {
  const fixtureDir = join(ROOT, 'fixtures', scenario);
  if (!existsSync(join(fixtureDir, 'scenario.json'))) {
    throw new Error(`Unknown scenario fixture: ${scenario}`);
  }

  const sandbox = join(SANDBOX_ROOT, scenario);
  if (existsSync(sandbox)) {
    if (!reset && !withBadAttempt) {
      console.log(`Sandbox already exists: ${sandbox}`);
      printNextSteps(scenario, sandbox);
      return;
    }
    spawnSync('git', ['worktree', 'prune'], { cwd: sandbox, encoding: 'utf8' });
    rmSync(sandbox, { recursive: true, force: true });
  }

  mkdirSync(SANDBOX_ROOT, { recursive: true });
  cpSync(join(fixtureDir, 'clean'), sandbox, { recursive: true });

  git(['init'], sandbox);
  git(['config', 'user.email', 'manual-test@example.com'], sandbox);
  git(['config', 'user.name', 'Manual Test'], sandbox);
  git(['add', '.'], sandbox);
  git(['commit', '-m', `Initial ${scenario} sandbox base`], sandbox);
  const cleanBaseSha = git(['rev-parse', 'HEAD'], sandbox);

  const recoveryDir = join(sandbox, '.claude', 'recovery');
  mkdirSync(recoveryDir, { recursive: true });
  writeFileSync(
    join(recoveryDir, 'scenario.json'),
    `${JSON.stringify({ cleanBaseSha, name: scenario }, null, 2)}\n`,
  );

  const promptPath = join(fixtureDir, 'evidence', 'original-prompt.txt');
  if (existsSync(promptPath)) {
    const prompt = readFileSync(promptPath, 'utf8').trim();
    writeFileSync(
      join(recoveryDir, 'original-outcome.json'),
      `${JSON.stringify({ text: prompt }, null, 2)}\n`,
    );
    writeFileSync(
      join(recoveryDir, 'prompts.jsonl'),
      `${JSON.stringify({
        label: 'Observed evidence',
        timestamp: new Date().toISOString(),
        prompt,
      })}\n`,
    );
  }

  for (const file of ['boundaries.json', 'findings.json']) {
    const src = join(fixtureDir, 'evidence', file);
    if (existsSync(src)) cpSync(src, join(recoveryDir, file));
  }

  if (withBadAttempt) {
    overlayDirectory(join(fixtureDir, 'bad-attempt'), sandbox);
    cpSync(join(fixtureDir, 'decision.json'), join(recoveryDir, 'decision.json'));
  }

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
      'Prompts: `manual-test/PROMPTS.md`',
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
}

function printNextSteps(scenario, sandbox) {
  console.error(`
Next:
  cd ${sandbox}
  claude --plugin-dir ${ROOT}

Prompts:
  ${join(ROOT, 'manual-test', 'PROMPTS.md')}
`);
}

try {
  setupSandbox(parseArgs(process.argv.slice(2)));
} catch (err) {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
}
