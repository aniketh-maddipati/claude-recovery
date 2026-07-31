/**
 * Claude CLI prompt-eval harness for /recover skill regressions.
 *
 * Requires:
 *   - `claude` on PATH (@anthropic-ai/claude-code)
 *   - ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, or CLAUDE_CODE_OAUTH_TOKEN
 *     (or an interactive login visible to `claude auth status`)
 *
 * Without Claude/auth, callers should skip — deterministic Git e2e tests
 * remain the default CI gate.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { setupScenario, cleanupScenario, ROOT } from './scenario-e2e.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const EVALS_DIR = join(ROOT, 'evals', 'cases');
export const RECORDINGS_DIR = join(ROOT, 'evals', 'recordings');

export function listEvalCases() {
  return readdirSync(EVALS_DIR)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => {
      const path = join(EVALS_DIR, name);
      return { path, caseDef: JSON.parse(readFileSync(path, 'utf8')) };
    });
}

export function findClaudeBinary() {
  const fromEnv = process.env.CLAUDE_BIN;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  const which = spawnSync('which', ['claude'], { encoding: 'utf8' });
  if (which.status === 0) return which.stdout.trim();

  // Common local npm global install layouts
  const candidates = [
    join(process.env.HOME ?? '', '.npm-global', 'bin', 'claude'),
    join(process.env.HOME ?? '', '.local', 'bin', 'claude'),
    '/usr/local/bin/claude',
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

export function hasClaudeAuth() {
  if (
    process.env.ANTHROPIC_API_KEY ||
    process.env.ANTHROPIC_AUTH_TOKEN ||
    process.env.CLAUDE_CODE_OAUTH_TOKEN
  ) {
    return true;
  }

  const claude = findClaudeBinary();
  if (!claude) return false;

  const status = spawnSync(claude, ['auth', 'status'], {
    encoding: 'utf8',
    timeout: 15_000,
  });
  return status.status === 0;
}

export function promptEvalAvailability() {
  const claude = findClaudeBinary();
  if (!claude) {
    return {
      ok: false,
      reason: 'claude CLI not found on PATH (install @anthropic-ai/claude-code)',
    };
  }
  if (!hasClaudeAuth()) {
    return {
      ok: false,
      reason:
        'Claude auth missing (set ANTHROPIC_API_KEY / CLAUDE_CODE_OAUTH_TOKEN or run claude auth login)',
    };
  }
  return { ok: true, claude };
}

function flattenPrompt(prompt, pluginRoot) {
  const lines = Array.isArray(prompt) ? prompt : [String(prompt)];
  return lines.join('\n').replaceAll('<plugin-root>', pluginRoot);
}

function extractResultText(stdout, outputFormat) {
  if (outputFormat !== 'json') return stdout;
  try {
    const parsed = JSON.parse(stdout);
    return parsed.result ?? parsed.output ?? stdout;
  } catch {
    // Some Claude versions wrap JSON among log lines — find last JSON object.
    const start = stdout.lastIndexOf('{');
    if (start === -1) return stdout;
    try {
      const parsed = JSON.parse(stdout.slice(start));
      return parsed.result ?? parsed.output ?? stdout;
    } catch {
      return stdout;
    }
  }
}

function parseClaudeJson(stdout) {
  try {
    return JSON.parse(stdout);
  } catch {
    const start = stdout.lastIndexOf('{');
    if (start === -1) return null;
    try {
      return JSON.parse(stdout.slice(start));
    } catch {
      return null;
    }
  }
}

export function formatClaudeFailure(label, result, { claude, args } = {}) {
  const parsed = parseClaudeJson(result.stdout ?? '');
  const parts = [`${label} failed (exit ${result.status ?? 'null'})`];
  if (result.signal) parts.push(`signal: ${result.signal}`);
  if (result.error) parts.push(`spawn: ${result.error}`);
  if (parsed?.is_error || parsed?.subtype === 'error_during_execution') {
    parts.push(`claude error: ${parsed.result ?? parsed.error ?? 'unknown'}`);
  } else if (parsed?.result && /not logged in|login|auth/i.test(String(parsed.result))) {
    parts.push(`auth: ${parsed.result}`);
  }
  if (result.stderr?.trim()) parts.push(`stderr:\n${result.stderr.trim()}`);
  if (result.stdout?.trim()) {
    const preview = result.stdout.trim().slice(0, 4000);
    parts.push(`stdout:\n${preview}`);
  }
  if (claude && args) {
    parts.push(`command: ${claude} ${args.map((a) => (a.includes(' ') ? `"${a}"` : a)).join(' ').slice(0, 500)}...`);
  }
  return parts.join('\n');
}

export function claudePromptFailed(result, parsed) {
  if (result.status !== 0 && result.status !== null) return true;
  if (result.signal) return true;
  if (result.error) return true;
  if (parsed?.is_error) return true;
  if (parsed?.subtype === 'error_during_execution') return true;
  if (parsed?.result && /not logged in · please run \/login/i.test(String(parsed.result))) return true;
  return false;
}

export function scorePromptResult(text, expect) {
  const failures = [];
  const haystack = text ?? '';

  for (const fragment of expect.mustInclude ?? []) {
    if (!haystack.includes(fragment)) {
      failures.push(`missing required fragment: ${fragment}`);
    }
  }

  for (const group of expect.mustIncludeOneOf ?? []) {
    if (!group.some((fragment) => haystack.includes(fragment))) {
      failures.push(`missing one of: ${group.join(' | ')}`);
    }
  }

  for (const fragment of expect.mustNotInclude ?? []) {
    if (haystack.includes(fragment)) {
      failures.push(`forbidden fragment present: ${fragment}`);
    }
  }

  return { ok: failures.length === 0, failures };
}

export function runClaudePrompt({
  claude,
  cwd,
  pluginRoot,
  caseDef,
  timeoutMs = Number(process.env.CLAUDE_RECOVERY_EVAL_TIMEOUT_MS ?? 180_000),
}) {
  const prompt = flattenPrompt(caseDef.prompt, pluginRoot);
  const tools = caseDef.tools ?? 'Bash,Read,Glob,Grep';
  const args = [
    '--plugin-dir',
    pluginRoot,
    '-p',
    prompt,
    '--output-format',
    'json',
    '--max-turns',
    String(caseDef.maxTurns ?? 8),
    '--tools',
    tools,
    '--allowedTools',
    caseDef.allowedTools ?? tools,
    '--permission-mode',
    caseDef.permissionMode ?? 'acceptEdits',
  ];

  if (caseDef.disallowedTools) {
    args.push('--disallowedTools', caseDef.disallowedTools);
  }
  if (process.env.CLAUDE_RECOVERY_DEBUG === '1') {
    args.push('--debug');
  }
  if (caseDef.model || process.env.CLAUDE_RECOVERY_EVAL_MODEL) {
    args.push('--model', caseDef.model ?? process.env.CLAUDE_RECOVERY_EVAL_MODEL);
  }

  const configDir = join(cwd, '.claude-eval-config');
  mkdirSync(configDir, { recursive: true });

  const result = spawnSync(claude, args, {
    cwd,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 20 * 1024 * 1024,
    env: {
      ...process.env,
      CLAUDE_CONFIG_DIR: configDir,
    },
  });

  const stdout = result.stdout ?? '';
  const parsed = parseClaudeJson(stdout);
  const failed = claudePromptFailed(result, parsed);

  return {
    ok: !failed,
    status: result.status,
    signal: result.signal,
    stdout,
    stderr: result.stderr ?? '',
    error: result.error?.message ?? null,
    parsed,
    text: extractResultText(stdout, 'json'),
    args,
  };
}

export function loadRecording(id) {
  const path = join(RECORDINGS_DIR, `${id}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function saveRecording(id, payload) {
  mkdirSync(RECORDINGS_DIR, { recursive: true });
  writeFileSync(
    join(RECORDINGS_DIR, `${id}.json`),
    `${JSON.stringify(payload, null, 2)}\n`,
    'utf8',
  );
}

/**
 * Run one eval case against a fresh scenario worktree.
 * Modes:
 *   - live (default when Claude+auth available)
 *   - replay when CLAUDE_RECOVERY_EVAL_REPLAY=1 and a recording exists
 */
export function runPromptEvalCase(caseDef, options = {}) {
  const availability = promptEvalAvailability();
  const replay = process.env.CLAUDE_RECOVERY_EVAL_REPLAY === '1';
  const record = process.env.CLAUDE_RECOVERY_EVAL_RECORD === '1';

  if (replay) {
    const recording = loadRecording(caseDef.id);
    if (!recording) {
      return {
        skipped: true,
        reason: `no recording for ${caseDef.id} (run with CLAUDE_RECOVERY_EVAL_RECORD=1 first)`,
      };
    }
    const score = scorePromptResult(recording.text, caseDef.expect);
    return { skipped: false, mode: 'replay', score, text: recording.text, recording };
  }

  if (!availability.ok) {
    return { skipped: true, reason: availability.reason };
  }

  const ctx = setupScenario(caseDef.scenario);
  try {
    // Pre-capture so Claude spends turns on labeling/questions, not setup.
    spawnSync('node', [join(ROOT, 'scripts', 'recovery.mjs'), 'capture'], {
      cwd: ctx.tmp,
      encoding: 'utf8',
    });

    const claudeResult = runClaudePrompt({
      claude: availability.claude,
      cwd: ctx.tmp,
      pluginRoot: ROOT,
      caseDef,
      timeoutMs: options.timeoutMs,
    });

    if (!claudeResult.ok) {
      return {
        skipped: false,
        mode: 'live',
        ok: false,
        failures: [
          formatClaudeFailure(caseDef.id, claudeResult, { claude: availability.claude, args: claudeResult.args }),
        ],
        text: claudeResult.text,
        claudeResult,
        tmp: ctx.tmp,
      };
    }

    const score = scorePromptResult(claudeResult.text, caseDef.expect);

    if (record) {
      saveRecording(caseDef.id, {
        id: caseDef.id,
        recordedAt: new Date().toISOString(),
        text: claudeResult.text,
        score,
      });
    }

    return {
      skipped: false,
      mode: 'live',
      ok: score.ok,
      failures: score.failures,
      text: claudeResult.text,
      claudeResult,
      tmp: ctx.tmp,
      score,
    };
  } finally {
    if (!options.keepTmp) {
      cleanupScenario(ctx.tmp);
    }
  }
}
