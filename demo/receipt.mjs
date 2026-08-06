#!/usr/bin/env node
/**
 * Print the compact recovery receipt for the current (or demo) fixture.
 *
 *   npm run demo:receipt
 *   node demo/receipt.mjs --manifest .claude/recovery/recovery-manifest.json
 */

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { ROOT } from '../tests/harness/scenario-e2e.mjs';
import { demoFixturePath } from './setup-fixture.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const options = { manifest: null, cwd: null, scenario: 'auth-service' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--manifest') {
      options.manifest = argv[i + 1];
      i += 1;
    } else if (arg === '--cwd') {
      options.cwd = argv[i + 1];
      i += 1;
    } else if (arg === '--scenario') {
      options.scenario = argv[i + 1];
      i += 1;
    }
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const cwd = options.cwd
    ? resolve(options.cwd)
    : existsSync(join(demoFixturePath(options.scenario), '.claude', 'recovery', 'recovery-manifest.json'))
      ? demoFixturePath(options.scenario)
      : process.cwd();
  const manifest = options.manifest
    ? resolve(cwd, options.manifest)
    : join(cwd, '.claude', 'recovery', 'recovery-manifest.json');

  if (!existsSync(manifest)) {
    console.error(
      `No recovery manifest at ${manifest}. Finalize a recovery first, then rerun demo:receipt.`,
    );
    process.exit(1);
  }

  const result = spawnSync(
    'node',
    [join(ROOT, 'scripts', 'recovery.mjs'), 'receipt', '--manifest', manifest],
    { cwd, encoding: 'utf8' },
  );
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}

main();
