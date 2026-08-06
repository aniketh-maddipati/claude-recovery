#!/usr/bin/env node
/**
 * Build a disposable demo fixture under .demo/<scenario>.
 *
 * This is a deterministic mixed-attempt fixture: clean base + rejected overlay.
 * It does NOT pre-seed decision.json, fake commands.jsonl, or approved contracts.
 * Real PostToolUse evidence is captured during the Claude Code recording.
 */

import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { setupFixtureSandbox, ROOT } from '../tests/harness/scenario-e2e.mjs';
import { getDemoScenario, listDemoScenarios } from './scenarios.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DEMO_ROOT = join(ROOT, '.demo');

/** Session artifacts that must not exist until the real Claude Code recording. */
const DEMO_EPHEMERAL_RECOVERY_FILES = [
  'commands.jsonl',
  'decision.json',
  'recovery-manifest.json',
  'pending-contract.json',
  'evidence.json',
  'patches-index.json',
  'boundary-verification.json',
  'injection-audit.jsonl',
  'patch-application-errors.json',
  'recovery-contract.md',
];

export function stripDemoSessionArtifacts(fixture) {
  const recoveryDir = join(fixture, '.claude', 'recovery');
  if (existsSync(recoveryDir)) {
    for (const name of DEMO_EPHEMERAL_RECOVERY_FILES) {
      rmSync(join(recoveryDir, name), { force: true });
    }
    rmSync(join(recoveryDir, 'patches'), { recursive: true, force: true });
  }
  rmSync(join(fixture, '.claude', 'recovery-worktrees'), { recursive: true, force: true });
}

export function assertHonestDemoFixture(fixture) {
  const recoveryDir = join(fixture, '.claude', 'recovery');
  const checks = [
    ['decision.json', join(recoveryDir, 'decision.json')],
    ['commands.jsonl', join(recoveryDir, 'commands.jsonl')],
    ['recovery-manifest.json', join(recoveryDir, 'recovery-manifest.json')],
    ['pending-contract.json', join(recoveryDir, 'pending-contract.json')],
  ];
  for (const [label, path] of checks) {
    if (label === 'commands.jsonl') {
      if (existsSync(path) && readFileSync(path, 'utf8').trim()) {
        throw new Error(`${label} was pre-seeded`);
      }
      continue;
    }
    if (existsSync(path)) {
      throw new Error(`${label} was pre-seeded`);
    }
  }
}

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

  stripDemoSessionArtifacts(fixture);
  assertHonestDemoFixture(fixture);

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
    evidencePaste: scenario.evidencePaste,
    decisionPaste: scenario.decisionPaste,
    approvePaste: scenario.approvePaste,
    recoverPaste: scenario.recoverPaste,
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

function indentBlock(text, prefix = '  ') {
  return String(text)
    .split('\n')
    .map((line) => (line.length ? `${prefix}${line}` : ''))
    .join('\n');
}

function printDemoInstructions(result) {
  const evidence =
    result.evidencePaste ||
    `Run \`${result.demoCommands.runCompatTest || result.demoCommands.runSmokeTest}\` and show \`git diff --stat\`.\n\n` +
      'Do not edit anything. Stop after reporting the observable failure and changed files.';

  console.log(`
Demo ready: ${result.fixture}
Teleprompter: demo/PROMPTS.md

Launch (FIXTURE):
${indentBlock(result.launchCommand)}

Before recording: run /help → Custom commands. Look for claude-recovery:recover.
If missing, use the recover paste below (Step 4) instead of the slash command.

── Paste into Claude (FIXTURE) ──

1) Evidence:
${indentBlock(evidence)}

2) Recover (paste this — works even if /claude-recovery:recover is unknown):
${indentBlock(result.recoverPaste)}

  Or try slash: /claude-recovery:recover

3) Decision:
${indentBlock(result.decisionPaste)}

4) Approve:
${indentBlock(result.approvePaste)}

── Type in terminal (WORKTREE, after receipt) ──

git diff --name-only

── Launch fresh Claude (WORKTREE) ──

<cd + claude line from receipt>

── Paste into Claude (WORKTREE) ──

${indentBlock(result.freshSessionPaste)}

Full teleprompter: demo/PROMPTS.md
`);
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
