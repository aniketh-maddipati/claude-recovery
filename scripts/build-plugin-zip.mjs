#!/usr/bin/env node
/**
 * Build dist/claude-recovery.zip for `claude --plugin-dir ./dist/claude-recovery.zip`.
 * Claude Code 2.1.128+ accepts zip archives; some builds register skills more reliably than a directory path.
 */

import { existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(__dirname, '..');
export const PLUGIN_ZIP = join(ROOT, 'dist', 'claude-recovery.zip');

/** Paths at the plugin root that must ship inside the zip. */
export const PLUGIN_ZIP_ENTRIES = [
  '.claude-plugin',
  'skills',
  'commands',
  'hooks',
  'scripts',
  'LICENSE',
];

export function buildPluginZip({ quiet = false } = {}) {
  const missing = PLUGIN_ZIP_ENTRIES.filter((entry) => !existsSync(join(ROOT, entry)));
  if (missing.length > 0) {
    throw new Error(`missing plugin paths for zip: ${missing.join(', ')}`);
  }

  if (!spawnSync('sh', ['-c', 'command -v zip'], { encoding: 'utf8' }).stdout.trim()) {
    throw new Error('zip not found on PATH (install zip, or build the archive manually)');
  }

  mkdirSync(join(ROOT, 'dist'), { recursive: true });
  const args = quiet ? ['-qr', PLUGIN_ZIP, ...PLUGIN_ZIP_ENTRIES] : ['-r', PLUGIN_ZIP, ...PLUGIN_ZIP_ENTRIES];
  const result = spawnSync('zip', args, { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || result.stdout?.trim() || `zip exit ${result.status}`);
  }

  if (!existsSync(PLUGIN_ZIP)) {
    throw new Error(`zip command succeeded but ${PLUGIN_ZIP} was not created`);
  }

  return {
    ok: true,
    path: PLUGIN_ZIP,
    bytes: statSync(PLUGIN_ZIP).size,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const result = buildPluginZip({ quiet: true });
    console.log(result.path);
  } catch (err) {
    console.error(`plugin zip build failed: ${err.message}`);
    process.exit(1);
  }
}
