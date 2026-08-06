#!/usr/bin/env node
/**
 * Build claude-recovery.zip for `claude --plugin-dir ~/Downloads/claude-recovery.zip`.
 * Claude Code 2.1.128+ accepts zip archives; skills register more reliably than a directory path.
 */

import { existsSync, mkdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(__dirname, '..');
export const PLUGIN_ZIP_DIST = join(ROOT, 'dist', 'claude-recovery.zip');
export const PLUGIN_ZIP_DOWNLOADS = join(homedir(), 'Downloads', 'claude-recovery.zip');

/** Default zip path for demo + upload. */
export const PLUGIN_ZIP = PLUGIN_ZIP_DOWNLOADS;

/** Paths at the plugin root that must ship inside the zip. */
export const PLUGIN_ZIP_ENTRIES = [
  '.claude-plugin',
  'skills',
  'commands',
  'hooks',
  'scripts',
  'LICENSE',
];

export function defaultPluginZipPath() {
  return process.env.CLAUDE_RECOVERY_PLUGIN_ZIP || PLUGIN_ZIP_DOWNLOADS;
}

function parseArgs(argv) {
  const options = { output: null, alsoDist: false, quiet: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--output' || arg === '-o') {
      options.output = argv[i + 1];
      i += 1;
    } else if (arg === '--also-dist') options.alsoDist = true;
    else if (arg === '--quiet' || arg === '-q') options.quiet = true;
  }
  return options;
}

function writeZip(dest, { quiet = false } = {}) {
  const missing = PLUGIN_ZIP_ENTRIES.filter((entry) => !existsSync(join(ROOT, entry)));
  if (missing.length > 0) {
    throw new Error(`missing plugin paths for zip: ${missing.join(', ')}`);
  }

  if (!spawnSync('sh', ['-c', 'command -v zip'], { encoding: 'utf8' }).stdout.trim()) {
    throw new Error('zip not found on PATH (install zip, or build the archive manually)');
  }

  mkdirSync(dirname(dest), { recursive: true });
  const args = quiet ? ['-qr', dest, ...PLUGIN_ZIP_ENTRIES] : ['-r', dest, ...PLUGIN_ZIP_ENTRIES];
  const result = spawnSync('zip', args, { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || result.stdout?.trim() || `zip exit ${result.status}`);
  }

  if (!existsSync(dest)) {
    throw new Error(`zip command succeeded but ${dest} was not created`);
  }

  return { path: dest, bytes: statSync(dest).size };
}

export function buildPluginZip({ quiet = false, output = null, alsoDist = false } = {}) {
  const primary = output ?? defaultPluginZipPath();
  const built = writeZip(primary, { quiet });

  if (alsoDist && primary !== PLUGIN_ZIP_DIST) {
    writeZip(PLUGIN_ZIP_DIST, { quiet: true });
  }

  return { ok: true, path: built.path, bytes: built.bytes };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = buildPluginZip({
      quiet: true,
      output: options.output,
      alsoDist: options.alsoDist,
    });
    console.log(result.path);
  } catch (err) {
    console.error(`plugin zip build failed: ${err.message}`);
    process.exit(1);
  }
}
