#!/usr/bin/env node
/**
 * Build ~/Downloads/claude-recovery.skill.zip for Claude skill upload UI.
 *
 * Required layout (folder at zip root, SKILL.md inside that folder — not skills/recover/):
 *   recover/
 *     SKILL.md
 *     scripts/
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(__dirname, '..');
export const SKILL_FOLDER = 'recover';
export const SKILL_ZIP_DOWNLOADS = join(homedir(), 'Downloads', 'claude-recovery.skill.zip');

/** Scripts bundled into the upload skill (SKILL.md references these). */
export const SKILL_SCRIPT_FILES = ['recovery.mjs', 'session-hook.mjs', 'setup-hooks.mjs'];

export function skillMarkdownForUpload() {
  const source = readFileSync(join(ROOT, 'skills', 'recover', 'SKILL.md'), 'utf8');
  return source
    .replace(/\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\//g, 'scripts/')
    .replace(
      /cd '<worktree>' && claude --plugin-dir '<plugin-root>'/g,
      "cd '<worktree>' && claude --plugin-dir '$HOME/claude-recovery'  # or ~/Downloads/claude-recovery.zip",
    );
}

export function stageSkillFolder(destDir) {
  const skillRoot = join(destDir, SKILL_FOLDER);
  const scriptsDir = join(skillRoot, 'scripts');
  mkdirSync(scriptsDir, { recursive: true });

  writeFileSync(join(skillRoot, 'SKILL.md'), skillMarkdownForUpload());

  for (const file of SKILL_SCRIPT_FILES) {
    const src = join(ROOT, 'scripts', file);
    if (!existsSync(src)) {
      throw new Error(`missing script for skill bundle: scripts/${file}`);
    }
    cpSync(src, join(scriptsDir, file));
  }

  cpSync(join(ROOT, 'scripts', 'lib'), join(scriptsDir, 'lib'), { recursive: true });

  return skillRoot;
}

function parseArgs(argv) {
  const options = { output: null, quiet: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--output' || arg === '-o') {
      options.output = argv[i + 1];
      i += 1;
    } else if (arg === '--quiet' || arg === '-q') options.quiet = true;
  }
  return options;
}

export function buildSkillZip({ quiet = false, output = null } = {}) {
  if (!spawnSync('sh', ['-c', 'command -v zip'], { encoding: 'utf8' }).stdout.trim()) {
    throw new Error('zip not found on PATH');
  }

  const dest = output ?? process.env.CLAUDE_RECOVERY_SKILL_ZIP ?? SKILL_ZIP_DOWNLOADS;
  const staging = mkdtempSync(join(tmpdir(), 'claude-recovery-skill-'));

  try {
    stageSkillFolder(staging);
    mkdirSync(dirname(dest), { recursive: true });
    rmSync(dest, { force: true });

    const args = quiet ? ['-qr', dest, SKILL_FOLDER] : ['-r', dest, SKILL_FOLDER];
    const result = spawnSync('zip', args, { cwd: staging, encoding: 'utf8' });
    if (result.status !== 0) {
      throw new Error(result.stderr?.trim() || result.stdout?.trim() || `zip exit ${result.status}`);
    }
    if (!existsSync(dest)) {
      throw new Error(`zip succeeded but ${dest} was not created`);
    }

    return { ok: true, path: dest, bytes: statSync(dest).size };
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = buildSkillZip({ quiet: true, output: options.output });
    console.log(result.path);
  } catch (err) {
    console.error(`skill zip build failed: ${err.message}`);
    process.exit(1);
  }
}
