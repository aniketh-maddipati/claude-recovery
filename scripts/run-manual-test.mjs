#!/usr/bin/env node
/**
 * Encapsulated manual test — prompts baked in, optional Claude CLI automation.
 *
 *   node scripts/run-manual-test.mjs                    # mechanical only (~2s)
 *   node scripts/run-manual-test.mjs --claude           # + Claude skill prompts
 *   node scripts/run-manual-test.mjs --claude --implement  # + worktree implementation
 *   node scripts/run-manual-test.mjs --print-prompts    # setup + echo prompts for paste
 *
 * Requires Claude auth for --claude / --implement.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  promptEvalAvailability,
  runClaudePrompt,
  scorePromptResult,
  formatClaudeFailure,
} from '../tests/harness/prompt-eval.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const RECOVERY = join(ROOT, 'scripts', 'recovery.mjs');
const PROMPTS = join(ROOT, 'manual-test', 'prompts.json');

function parseArgs(argv) {
  const options = {
    scenario: 'auth-service',
    claude: false,
    implement: false,
    printPrompts: false,
    keep: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--claude') options.claude = true;
    if (arg === '--implement') options.implement = true;
    if (arg === '--print-prompts') options.printPrompts = true;
    if (arg === '--keep') options.keep = true;
    if (arg === '--scenario') {
      options.scenario = argv[i + 1];
      i += 1;
    }
  }
  if (options.implement) options.claude = true;
  return options;
}

function log(stage, message) {
  process.stderr.write(`[${stage}] ${message}\n`);
}

function runRecovery(args, cwd) {
  const result = spawnSync('node', [RECOVERY, ...args], { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout);
  }
  return JSON.parse(result.stdout);
}

function setupSandbox(scenario) {
  const result = spawnSync(
    'node',
    ['scripts/setup-manual-sandbox.mjs', '--with-bad-attempt', '--reset', '--scenario', scenario],
    { cwd: ROOT, encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout);
  }
  const start = result.stdout.indexOf('{');
  const end = result.stdout.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('setup-manual-sandbox did not return JSON');
  return JSON.parse(result.stdout.slice(start, end + 1));
}

function loadPrompts(scenario) {
  const all = JSON.parse(readFileSync(PROMPTS, 'utf8'));
  if (!all[scenario]) throw new Error(`No prompts for scenario: ${scenario}`);
  return all[scenario];
}

function asCaseDef(name, stageDef) {
  const prompt = stageDef.prompt;
  return {
    id: name,
    prompt: Array.isArray(prompt) ? prompt : [prompt],
    maxTurns: stageDef.maxTurns ?? 10,
    tools: stageDef.tools,
    disallowedTools: stageDef.disallowedTools,
    permissionMode: stageDef.permissionMode ?? 'acceptEdits',
    expect: stageDef.expect ?? {},
  };
}

function runPromptStage({ claude, sandbox, pluginRoot, stageName, stageDef }) {
  log(stageName, 'running claude -p ...');
  const caseDef = asCaseDef(stageName, stageDef);
  const result = runClaudePrompt({ claude, cwd: sandbox, pluginRoot, caseDef });
  if (!result.ok) {
    const detail = formatClaudeFailure(stageName, result, { claude, args: result.args });
    const errPath = join(sandbox, '.claude', 'recovery', `last-${stageName}-error.txt`);
    mkdirSync(join(sandbox, '.claude', 'recovery'), { recursive: true });
    writeFileSync(errPath, detail, 'utf8');
    throw new Error(`${detail}\n(full log: ${errPath})`);
  }
  const score = scorePromptResult(result.text, caseDef.expect);
  return { stage: stageName, text: result.text, score, preview: result.text.slice(0, 300) };
}

function preflightClaude(claude, pluginDir) {
  const probe = runClaudePrompt({
    claude,
    cwd: ROOT,
    pluginRoot: pluginDir,
    caseDef: {
      id: 'preflight',
      prompt: ['Reply with exactly: ok'],
      maxTurns: 1,
      tools: 'Read',
      allowedTools: 'Read',
      permissionMode: 'acceptEdits',
    },
    timeoutMs: 60_000,
  });
  if (!probe.ok) {
    throw new Error(formatClaudeFailure('claude preflight', probe, { claude, args: probe.args }));
  }
}

function verifyWorktree(scenario, finalized) {
  const wt = finalized.worktree.path;
  const checks = {
    worktreeExists: existsSync(wt),
    pendingSeeded: existsSync(join(wt, '.claude', 'recovery', 'pending-contract.json')),
  };
  if (scenario === 'auth-service') {
    const provider = readFileSync(join(wt, 'src/auth/provider.mjs'), 'utf8');
    checks.compatTest = existsSync(join(wt, 'tests/auth-compat.test.mjs'));
    checks.cleanProvider = provider.includes('authenticate') && !provider.includes('verifyRequest');
  } else {
    const config = readFileSync(join(wt, 'src/config.mjs'), 'utf8');
    checks.smokeTest = existsSync(join(wt, 'tests/config-smoke.test.mjs'));
    checks.cleanApi = config.includes('getConfig') && !config.includes('loadSettings');
  }
  return { ok: Object.values(checks).every(Boolean), checks, worktree: wt };
}

function runTestsInWorktree(scenario, worktree) {
  const testGlob = scenario === 'auth-service'
    ? 'tests/auth-compat.test.mjs'
    : 'tests/config-smoke.test.mjs';
  const result = spawnSync('node', ['--test', testGlob], { cwd: worktree, encoding: 'utf8' });
  return { ok: result.status === 0, stdout: result.stdout, stderr: result.stderr };
}

function printPromptsForPaste(scenario, prompts, sandbox, pluginDir) {
  const stages = ['recover', 'decision', 'approve', 'implement'];
  console.log(JSON.stringify({
    ok: true,
    mode: 'print-prompts',
    scenario,
    sandbox,
    pluginDir,
    stages: stages.reduce((acc, name) => {
      if (!prompts[name]) return acc;
      const p = prompts[name].prompt;
      acc[name] = Array.isArray(p) ? p.join('\n') : p;
      return acc;
    }, {}),
    launchHint: `cd ${sandbox} && claude --plugin-dir ${pluginDir}`,
  }, null, 2));
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const pluginDir = process.env.CLAUDE_RECOVERY_PLUGIN_DIR || ROOT;
  const prompts = loadPrompts(options.scenario);
  const stages = [];

  log('setup', `scenario=${options.scenario}`);
  const { sandbox } = setupSandbox(options.scenario);

  if (options.printPrompts) {
    printPromptsForPaste(options.scenario, prompts, sandbox, pluginDir);
    return;
  }

  runRecovery(['capture'], sandbox);

  if (options.claude) {
    const availability = promptEvalAvailability();
    if (!availability.ok) {
      console.log(JSON.stringify({
        ok: false,
        skipped: true,
        reason: availability.reason,
        hint: 'Run without --claude for mechanical-only, or set ANTHROPIC_API_KEY / claude auth login',
      }, null, 2));
      process.exit(2);
    }

    preflightClaude(availability.claude, pluginDir);

    for (const stageName of ['recover', 'decision', 'approve']) {
      if (!prompts[stageName]) continue;
      const stage = runPromptStage({
        claude: availability.claude,
        sandbox,
        pluginRoot: pluginDir,
        stageName,
        stageDef: prompts[stageName],
      });
      stages.push(stage);
      if (stage.score.failures?.length) {
        log(stageName, `soft-check warnings: ${stage.score.failures.join('; ')}`);
      }
    }
  }

  log('finalize', 'running recovery.mjs finalize ...');
  const finalized = runRecovery(
    ['finalize', '--decision-file', '.claude/recovery/decision.json', '--name', 'manual-test'],
    sandbox,
  );

  log('verify', 'running verify-boundaries ...');
  const boundaries = runRecovery(
    ['verify-boundaries', '--manifest', '.claude/recovery/recovery-manifest.json'],
    sandbox,
  );
  if (!boundaries.ok) {
    throw new Error(`boundary verification failed: ${JSON.stringify(boundaries.checks)}`);
  }

  const verify = verifyWorktree(options.scenario, finalized);
  if (!verify.ok) {
    throw new Error(`worktree verification failed: ${JSON.stringify(verify.checks)}`);
  }

  let implement = null;
  let tests = null;

  if (options.implement && options.claude) {
    const availability = promptEvalAvailability();
    implement = runPromptStage({
      claude: availability.claude,
      sandbox: finalized.worktree.path,
      pluginRoot: pluginDir,
      stageName: 'implement',
      stageDef: prompts.implement,
    });
    stages.push(implement);
    tests = runTestsInWorktree(options.scenario, finalized.worktree.path);
  }

  const summary = {
    ok: verify.ok && (tests ? tests.ok : true),
    mode: options.claude ? (options.implement ? 'claude+implement' : 'claude') : 'mechanical',
    scenario: options.scenario,
    sandbox,
    worktree: finalized.worktree.path,
    launch: finalized.launch.recommendedLaunchCommand,
    verify: verify.checks,
    boundaries: boundaries.checks,
    stages: stages.map((s) => ({
      stage: s.stage,
      scoreOk: s.score?.ok ?? null,
      scoreFailures: s.score?.failures ?? [],
      preview: s.preview,
    })),
    tests,
    keptAt: options.keep ? sandbox : null,
  };

  console.log(JSON.stringify(summary, null, 2));
  if (!summary.ok) process.exit(1);
}

try {
  main();
} catch (err) {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
}
