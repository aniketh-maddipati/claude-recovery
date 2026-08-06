#!/usr/bin/env node
/**
 * Build a disposable demo fixture under .demo/<scenario>.
 * Seeds commands.jsonl evidence for Loom / silent demo recording.
 */

import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { setupFixtureSandbox, ROOT } from '../tests/harness/scenario-e2e.mjs';
import { getDemoScenario, listDemoScenarios } from './scenarios.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DEMO_ROOT = join(ROOT, '.demo');

function parseArgs(argv) {
  const options = { scenario: 'auth-service', print: false, list: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--print') options.print = true;
    if (arg === '--list') options.list = true;
    if (arg === '--scenario') {
      options.scenario = argv[i + 1];
      i += 1;
    }
  }
  return options;
}

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

export function demoFixturePath(scenarioName) {
  return join(DEMO_ROOT, scenarioName);
}

export function setupDemoFixture({ scenario: scenarioName = 'auth-service', reset = true } = {}) {
  const scenario = getDemoScenario(scenarioName);
  const fixture = demoFixturePath(scenario.id);

  if (existsSync(fixture)) {
    if (!reset) {
      return { ok: true, scenario: scenario.id, fixture, reused: true };
    }
    spawnSync('git', ['worktree', 'prune'], { cwd: fixture, encoding: 'utf8' });
    rmSync(fixture, { recursive: true, force: true });
  }

  const { cleanBaseSha } = setupFixtureSandbox(scenario.fixtureDir, fixture, {
    withBadAttempt: true,
  });

  const recoveryDir = join(fixture, '.claude', 'recovery');
  scenario.seedCommandsEvidence(recoveryDir, writeFileSync);
  runRecovery(['capture'], fixture);

  const pluginDir = process.env.CLAUDE_RECOVERY_PLUGIN_DIR || ROOT;
  const launchCommand = `cd ${fixture} && claude --plugin-dir ${pluginDir}`;

  return {
    ok: true,
    scenario: scenario.id,
    loomTitle: scenario.loomTitle,
    oneLiner: scenario.oneLiner,
    story: scenario.story,
    fixture,
    cleanBaseSha,
    pluginDir,
    launchCommand,
    reused: false,
    decisionPaste: scenario.decisionPaste,
    approvePaste: scenario.approvePaste,
    freshSessionPaste: scenario.freshSessionPaste,
    demoCommands: scenario.demoCommands,
    promptsFile: join(ROOT, 'demo', 'PROMPTS.md'),
  };
}

function printDemoInstructions(result) {
  console.log(`
Demo fixture ready (${result.scenario}): ${result.fixture}
${result.loomTitle} — ${result.oneLiner}

Run this in a terminal with authenticated Claude Code (120% zoom, crop to active pane):

  ${result.launchCommand}

Then invoke: /claude-recovery:recover

When asked what to keep/reject/change, paste:

  ${result.decisionPaste}

When the contract preview looks right:

  ${result.approvePaste}

After finalize, run the printed freshClaudeCommand (recommendedLaunchCommandInteractive)
yourself in a new terminal — the plugin cannot start the fresh session for you.

In the fresh session, paste:

  ${result.freshSessionPaste}

Copy-paste prompts for all scenarios: demo/PROMPTS.md
Shot list (30-sec): demo/RECORDING.md`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const options = parseArgs(process.argv.slice(2));
  if (options.list) {
    console.log(listDemoScenarios().join('\n'));
    process.exit(0);
  }
  try {
    const result = setupDemoFixture({ scenario: options.scenario });
    if (options.print) {
      printDemoInstructions(result);
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (err) {
    if (options.print) {
      console.error(`Demo setup failed: ${err.message}`);
    } else {
      console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
    }
    process.exit(1);
  }
}

// Back-compat for tests importing DEMO_FIXTURE
export const DEMO_FIXTURE = demoFixturePath('auth-service');
