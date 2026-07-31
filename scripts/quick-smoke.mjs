#!/usr/bin/env node
/**
 * One-command smoke test — no Claude, ~2 seconds.
 *
 *   node scripts/quick-smoke.mjs
 *   node scripts/quick-smoke.mjs --scenario config-toggle
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { setupScenario, cleanupScenario, ROOT } from '../tests/harness/scenario-e2e.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RECOVERY = join(ROOT, 'scripts', 'recovery.mjs');

function parseArgs(argv) {
  const options = { scenario: 'auth-service', keep: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--scenario') {
      options.scenario = argv[i + 1];
      i += 1;
    }
    if (argv[i] === '--keep') options.keep = true;
  }
  return options;
}

function run(args, cwd) {
  const result = spawnSync('node', [RECOVERY, ...args], { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout);
  }
  return JSON.parse(result.stdout);
}

function main() {
  const { scenario, keep } = parseArgs(process.argv.slice(2));
  const ctx = setupScenario(scenario);
  const { tmp } = ctx;

  try {
    run(['capture'], tmp);
    const finalized = run(
      ['finalize', '--decision-file', '.claude/recovery/decision.json', '--name', 'quick-smoke'],
      tmp,
    );

    const wt = finalized.worktree.path;
    const manifest = finalized.manifest;
    const provider = readFileSync(join(wt, 'src', scenario === 'auth-service' ? 'auth/provider.mjs' : 'config.mjs'), 'utf8');

    const checks = {
      worktreeExists: existsSync(wt),
      pendingSeeded: existsSync(join(wt, '.claude', 'recovery', 'pending-contract.json')),
      launchCommand: Boolean(finalized.launch.recommendedLaunchCommand),
    };

    if (scenario === 'auth-service') {
      checks.compatTestInWorktree = existsSync(join(wt, 'tests/auth-compat.test.mjs'));
      checks.cleanProvider = provider.includes('authenticate') && !provider.includes('verifyRequest');
    } else {
      checks.smokeTestInWorktree = existsSync(join(wt, 'tests/config-smoke.test.mjs'));
      checks.cleanApi = provider.includes('getConfig') && !provider.includes('loadSettings');
    }

    const ok = Object.values(checks).every(Boolean);
    console.log(JSON.stringify({
      ok,
      scenario,
      checks,
      worktree: wt,
      launch: finalized.launch.recommendedLaunchCommand,
      elapsedNote: 'Mechanical recovery only — skip Claude for this smoke.',
    }, null, 2));

    if (!ok) process.exit(1);
    if (!keep) cleanupScenario(tmp);
    else console.error(`Kept sandbox at: ${tmp}`);
  } catch (err) {
    cleanupScenario(tmp);
    console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
    process.exit(1);
  }
}

main();
