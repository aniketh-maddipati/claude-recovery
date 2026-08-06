#!/usr/bin/env node
/**
 * Demo helpers — worktree path and launch lines for pure shell commands.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { demoFixturePath } from './setup-fixture.mjs';
import { defaultPluginZipPath, buildPluginZip } from '../scripts/build-plugin-zip.mjs';
import { ROOT } from '../tests/harness/scenario-e2e.mjs';

const scenario = process.argv.includes('--scenario')
  ? process.argv[process.argv.indexOf('--scenario') + 1]
  : 'auth-service';

const fixture = demoFixturePath(scenario);
const manifestPath = join(fixture, '.claude', 'recovery', 'recovery-manifest.json');

function pluginDir() {
  if (process.env.CLAUDE_RECOVERY_PLUGIN_DIR) {
    return process.env.CLAUDE_RECOVERY_PLUGIN_DIR;
  }
  const zip = defaultPluginZipPath();
  if (existsSync(zip)) {
    return zip;
  }
  return ROOT;
}

function readManifest() {
  if (!existsSync(manifestPath)) {
    throw new Error(`no recovery manifest at ${manifestPath} — finalize first`);
  }
  return JSON.parse(readFileSync(manifestPath, 'utf8'));
}

function worktreePath() {
  const wt = readManifest().worktreePath;
  if (!wt) throw new Error('manifest has no worktreePath');
  return wt;
}

const cmd = process.argv[2];

try {
  switch (cmd) {
    case 'root':
      console.log(ROOT);
      break;
    case 'fixture':
      console.log(fixture);
      break;
    case 'plugin':
      console.log(pluginDir());
      break;
    case 'worktree':
      console.log(worktreePath());
      break;
    case 'launch-fixture':
      console.log(`cd '${fixture}' && claude --plugin-dir '${pluginDir()}'`);
      break;
    case 'launch-worktree':
      console.log(`cd '${worktreePath()}' && claude --plugin-dir '${pluginDir()}'`);
      break;
    default:
      console.error(`Usage: node demo/demo-cmd.mjs <root|fixture|plugin|worktree|launch-fixture|launch-worktree>`);
      process.exit(1);
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
