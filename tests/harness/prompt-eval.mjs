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
    caseDef.tools ?? 'Bash,Read,Glob,Grep',
    '--permission-mode',
    caseDef.permissionMode ?? 'bypassPermissions',
  ];

  if (caseDef.disallowedTools) {
    args.push('--disallowedTools', caseDef.disallowedTools);
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
      // Keep evals from picking up unrelated user hooks/plugins outside plugin-dir.
      CLAUDE_CONFIG_DIR: configDir,
    },
  });

  return {
    status: result.status,
    signal: result.signal,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error?.message ?? null,
    text: extractResultText(result.stdout ?? '', 'json'),
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

    if (claudeResult.status !== 0) {
      return {
        skipped: false,
        mode: 'live',
        ok: false,
        failures: [
          `claude exited ${claudeResult.status}: ${claudeResult.stderr || claudeResult.error || 'unknown error'}`,
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
