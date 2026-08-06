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
    evidencePaste: scenario.evidencePaste,
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
Demo fixture ready (${result.scenario}): ${result.fixture}
${result.loomTitle} — ${result.oneLiner}

Deterministic mixed-attempt fixture (not live Claude misbehavior).
Starting state: Git diff present, useful test present, commands.jsonl absent,
decision.json absent, no recovery manifest / approved pending contract.

Scenario (plain English — read demo/SCRIPT.md "READ THIS FIRST"):
  Fake mini app, not a real product.
  AuthProvider = login checker (authenticate(token)). ApiClient = code that calls it.
  Rejected: Claude renamed authenticate → verifyRequest and migrated the client.
  Keep: guardrail test (auth-compat.test.mjs) + expired-token finding.
  Recovery: keep test, undo rename on provider + client, hand off Recovery Contract.

Full word-for-word script + viewer cues: demo/SCRIPT.md

────────────────────────────────────────────────────────────────
Complete interactive sequence (paste in order)
────────────────────────────────────────────────────────────────

1) Launch Claude Code in the fixture (single terminal, 16–18 pt font):

${indentBlock(result.launchCommand)}

2) Evidence prompt:

${indentBlock(evidence)}

3) Recovery:

${indentBlock('/claude-recovery:recover')}

4) Decision:

${indentBlock(result.decisionPaste)}

5) Approval:

${indentBlock(result.approvePaste)}

6) After finalize — compact receipt (optional; Claude may already show it):

${indentBlock(`node ${result.pluginDir}/scripts/recovery.mjs receipt \\
  --manifest .claude/recovery/recovery-manifest.json`)}

7) In the recovery worktree, confirm only approved files changed:

${indentBlock('git diff --name-only')}

8) Fresh interactive session (you launch manually — no -p):

${indentBlock('<recommendedLaunchCommand from receipt>')}

9) Fresh-session proof:

${indentBlock(result.freshSessionPaste)}

Expected fresh-session themes: preserve AuthProvider.authenticate(token);
no ApiClient migration; use an adapter; run the compatibility test.

Recording setup (one script): npm run demo:record   # or ./demo/record.sh
Speaking script (word-for-word + viewer cues): demo/SCRIPT.md
Recording cut (45–75s): demo/RECORDING.md
Copy-paste prompts: demo/PROMPTS.md
Use Loom, not asciinema. Preflight is off-camera.`);
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
