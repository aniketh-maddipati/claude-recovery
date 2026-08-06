#!/usr/bin/env node
/**
 * Build a disposable demo fixture under .demo/<scenario>.
 *
 * This is a deterministic mixed-attempt fixture: clean base + rejected overlay.
 * It does NOT pre-seed decision.json, fake commands.jsonl, or approved contracts.
 * Real PostToolUse evidence is captured during the Claude Code recording.
 */

import { existsSync, rmSync } from 'node:fs';
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
    withRejectedAttempt: true,
    seedDecision: false,
    seedCommandEvidence: false,
  });

  const pluginDir = process.env.CLAUDE_RECOVERY_PLUGIN_DIR || ROOT;
  const launchCommand = `cd ${fixture} && claude --plugin-dir ${pluginDir}`;

  return {
    ok: true,
    scenario: scenario.id,
    mode: 'deterministic-fixture',
    note:
      'Deterministic mixed-attempt fixture: rejected Git overlay + useful test. ' +
      'Not proof that Claude independently violated an instruction. ' +
      'commands.jsonl and decision.json are intentionally absent until the real session.',
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
    startingState: {
      gitDiff: 'present (rejected attempt overlay)',
      usefulTest: 'present',
      commandsJsonl: 'absent',
      decisionJson: 'absent',
      recoveryManifest: 'absent',
      approvedPendingContract: 'absent',
    },
  };
}

function printDemoInstructions(result) {
  console.log(`
Demo fixture ready (${result.scenario}): ${result.fixture}
${result.loomTitle} — ${result.oneLiner}

This is a deterministic mixed-attempt fixture (not live Claude misbehavior).
Starting state: Git diff present, useful test present, commands.jsonl absent,
decision.json absent, no recovery manifest / approved pending contract.

Preflight (recommended):

  npm run demo:preflight

Run this in a terminal with authenticated Claude Code (120% zoom, crop to active pane):

  ${result.launchCommand}

During recording, run the failing compatibility test through Bash so the real
PostToolUse hook can capture commands.jsonl. Then invoke:

  /claude-recovery:recover

When asked what to keep/reject/change, paste:

  ${result.decisionPaste}

When the contract preview looks right, explicitly approve. Claude should then run
approve and finalize (separate steps). Show the compact receipt:

  node ${result.pluginDir}/scripts/recovery.mjs receipt \\
    --manifest .claude/recovery/recovery-manifest.json

Launch the fresh interactive session yourself (plugin cannot start Claude):

  <recommendedLaunchCommand from receipt — interactive, no -p>

In the fresh session, paste:

  ${result.freshSessionPaste}

Copy-paste prompts: demo/PROMPTS.md
Shot list (60–75 sec primary): demo/RECORDING.md`);
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
