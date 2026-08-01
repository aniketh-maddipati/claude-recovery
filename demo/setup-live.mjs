#!/usr/bin/env node
/**
 * Build a clean (no bad attempt) sandbox for live demo simulation.
 * Usage: node demo/setup-live.mjs --scenario config-toggle [--print]
 */

import { existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { setupFixtureSandbox, ROOT } from '../tests/harness/scenario-e2e.mjs';
import { getDemoScenario, listDemoScenarios } from './scenarios.mjs';
import { DEMO_ROOT } from './setup-fixture.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const options = { scenario: 'auth-service', print: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--print') options.print = true;
    if (arg === '--scenario') {
      options.scenario = argv[i + 1];
      i += 1;
    }
  }
  return options;
}

export function setupLiveFixture({ scenario: scenarioName = 'auth-service', reset = true } = {}) {
  const scenario = getDemoScenario(scenarioName);
  const fixture = join(DEMO_ROOT, `${scenario.id}-live`);

  if (existsSync(fixture)) {
    if (!reset) {
      return { ok: true, scenario: scenario.id, fixture, reused: true, mode: 'live' };
    }
    spawnSync('git', ['worktree', 'prune'], { cwd: fixture, encoding: 'utf8' });
    rmSync(fixture, { recursive: true, force: true });
  }

  setupFixtureSandbox(scenario.fixtureDir, fixture, { withBadAttempt: false });

  const pluginDir = process.env.CLAUDE_RECOVERY_PLUGIN_DIR || ROOT;
  const launchCommand = `cd ${fixture} && claude --plugin-dir ${pluginDir}`;

  return {
    ok: true,
    mode: 'live',
    scenario: scenario.id,
    loomTitle: scenario.loomTitle,
    oneLiner: scenario.oneLiner,
    fixture,
    pluginDir,
    launchCommand,
    liveSimulation: scenario.liveSimulation,
    promptsFile: join(ROOT, 'demo', 'PROMPTS.md'),
  };
}

function printLiveInstructions(result) {
  const live = result.liveSimulation;
  console.log(`
Live demo fixture ready (${result.scenario}): ${result.fixture}
${result.loomTitle} — ${result.oneLiner}

This is a CLEAN codebase. Paste prompts from demo/PROMPTS.md to create the bad attempt on camera.

Run Claude Code:

  ${result.launchCommand}

Then paste (step 2 — initial task):

${live.initialTask}

If Claude does not break the boundary, paste (step 3 — bad attempt nudge):

${live.badAttemptNudge}

Then run in terminal (step 4 — evidence):

${live.evidenceCommands.map((c) => `  ${c}`).join('\n')}

Then /claude-recovery:recover — see demo/PROMPTS.md for recovery prompts.
`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const options = parseArgs(process.argv.slice(2));
  const scenarioArg = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (scenarioArg) options.scenario = scenarioArg;
  try {
    const result = setupLiveFixture({ scenario: options.scenario });
    if (options.print) {
      printLiveInstructions(result);
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (err) {
    console.error(`Live demo setup failed: ${err.message}`);
    console.error(`Available scenarios: ${listDemoScenarios().join(', ')}`);
    process.exit(1);
  }
}
