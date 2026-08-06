import { spawnSync } from 'node:child_process';
import { accessSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const RECOVERY_SCRIPT = join(ROOT, 'scripts', 'recovery.mjs');

export function runRecoveryRaw(args, cwd) {
  return spawnSync('node', [RECOVERY_SCRIPT, ...args], {
    cwd,
    encoding: 'utf8',
  });
}

export function runRecovery(args, cwd) {
  const result = runRecoveryRaw(args, cwd);

  const stdout = result.stdout?.trim() ?? '';
  const stderr = result.stderr?.trim() ?? '';

  if (result.status !== 0) {
    let message = stderr || stdout;
    try {
      const parsed = JSON.parse(stderr || stdout);
      message = parsed.error ?? message;
    } catch {
      // keep raw message
    }
    throw new Error(message);
  }

  return JSON.parse(stdout);
}

export function runRecoveryExpectFail(args, cwd) {
  const result = runRecoveryRaw(args, cwd);
  const stdout = result.stdout?.trim() ?? '';
  const stderr = result.stderr?.trim() ?? '';
  let error = stderr || stdout;
  try {
    error = JSON.parse(stderr || stdout).error ?? error;
  } catch {
    // keep raw
  }
  return {
    status: result.status ?? 1,
    error,
    stdout,
    stderr,
  };
}

export function createSessionHookOutput(scriptPath, payload) {
  const result = spawnSync('node', [scriptPath], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
  });
  const stdout = result.stdout?.trim();
  if (!stdout) return null;
  return JSON.parse(stdout);
}
