#!/usr/bin/env node
/**
 * Build ~/Downloads/claude-recovery.skill.zip (dashboard upload)
 * and install recover/ → ~/.claude/skills/recover/ (Claude Code CLI).
 *
 * Dashboard upload does NOT sync to CLI. Use: npm run skill:install
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
export const SKILL_INSTALL_DIR = join(homedir(), '.claude', 'skills');
export const SKILL_CLI_PATH = join(SKILL_INSTALL_DIR, SKILL_FOLDER, 'SKILL.md');

/** Scripts bundled into the personal skill folder. */
export const SKILL_SCRIPT_FILES = ['recovery.mjs', 'session-hook.mjs', 'setup-hooks.mjs'];

function readSourceSkill() {
  return readFileSync(join(ROOT, 'skills', 'recover', 'SKILL.md'), 'utf8');
}

/** Dashboard / .skill zip upload — relative scripts/ paths. */
export function skillMarkdownForUpload() {
  return readSourceSkill()
    .replace(/\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\//g, 'scripts/')
    .replace(
      /cd '<worktree>' && claude --plugin-dir '<plugin-root>'/g,
      "cd '<worktree>' && claude --plugin-dir '$HOME/claude-recovery'",
    );
}

/** ~/.claude/skills/recover — Claude Code expands ${CLAUDE_SKILL_DIR}. */
export function skillMarkdownForCli() {
  return readSourceSkill()
    .replace(/\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\//g, '${CLAUDE_SKILL_DIR}/scripts/')
    .replace(
      /cd '<worktree>' && claude --plugin-dir '<plugin-root>'/g,
      `cd '<worktree>' && claude --plugin-dir '${ROOT}'`,
    );
}

export function stageSkillFolder(destDir, { forCli = false } = {}) {
  const skillRoot = join(destDir, SKILL_FOLDER);
  const scriptsDir = join(skillRoot, 'scripts');
  mkdirSync(scriptsDir, { recursive: true });

  writeFileSync(
    join(skillRoot, 'SKILL.md'),
    forCli ? skillMarkdownForCli() : skillMarkdownForUpload(),
  );

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
  const options = { output: null, quiet: false, install: false, doctor: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--output' || arg === '-o') {
      options.output = argv[i + 1];
      i += 1;
    } else if (arg === '--quiet' || arg === '-q') options.quiet = true;
    else if (arg === '--install') options.install = true;
    else if (arg === '--doctor') options.doctor = true;
  }
  return options;
}

function requireZip() {
  if (!spawnSync('sh', ['-c', 'command -v zip'], { encoding: 'utf8' }).stdout.trim()) {
    throw new Error('zip not found on PATH');
  }
}

export function installSkillToCli({ targetDir = SKILL_INSTALL_DIR, quiet = false } = {}) {
  const staging = mkdtempSync(join(tmpdir(), 'claude-recovery-skill-'));
  try {
    stageSkillFolder(staging, { forCli: true });
    const skillRoot = join(staging, SKILL_FOLDER);
    const dest = join(targetDir, SKILL_FOLDER);
    rmSync(dest, { recursive: true, force: true });
    mkdirSync(targetDir, { recursive: true });
    cpSync(skillRoot, dest, { recursive: true });

    const result = { ok: true, path: dest, skillFile: join(dest, 'SKILL.md'), slash: '/recover' };

    if (!quiet) {
      console.log(`
Installed CLI skill:
  ${result.skillFile}

Dashboard upload does NOT sync here — this is a separate local install.

Next:
  1. Quit Claude Code completely (not just a new tab)
  2. Reopen Claude Code
  3. Run /skills  — look for "recover"
  4. Invoke /recover

If /recover is missing:
  • Run /skills and press Space on recover (not hidden)
  • Or install the full plugin instead:
      export CLAUDE_RECOVERY_PLUGIN_DIR=$HOME/Downloads/claude-recovery.zip
      claude --plugin-dir "$CLAUDE_RECOVERY_PLUGIN_DIR"
    then use /claude-recovery:recover (hooks + SessionStart)
`);
    }

    return result;
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

export function diagnoseSkillInstall() {
  const lines = [];
  let ok = true;

  if (!existsSync(SKILL_CLI_PATH)) {
    ok = false;
    lines.push(`MISSING  ${SKILL_CLI_PATH}`);
    lines.push('Fix: npm run skill:install');
  } else {
    lines.push(`OK       ${SKILL_CLI_PATH}`);
    const md = readFileSync(SKILL_CLI_PATH, 'utf8');
    if (!md.includes('name: recover')) {
      ok = false;
      lines.push('FAIL     frontmatter name: recover');
    }
    if (!md.includes('description:')) {
      ok = false;
      lines.push('FAIL     frontmatter description');
    }
    if (!md.includes('${CLAUDE_SKILL_DIR}/scripts/')) {
      ok = false;
      lines.push('WARN     SKILL.md should use ${CLAUDE_SKILL_DIR}/scripts/ for CLI');
    }
    if (!existsSync(join(SKILL_INSTALL_DIR, SKILL_FOLDER, 'scripts', 'recovery.mjs'))) {
      ok = false;
      lines.push('FAIL     missing scripts/recovery.mjs in skill folder');
    }
  }

  lines.push('');
  lines.push('CLI slash command: /recover  (folder name under ~/.claude/skills/)');
  lines.push('Full plugin slash: /claude-recovery:recover  (needs --plugin-dir zip)');
  lines.push('');
  lines.push('After install: quit Claude Code fully, reopen, run /skills');

  return { ok, lines };
}

export function buildSkillZip({ quiet = false, output = null } = {}) {
  requireZip();

  const dest = output ?? process.env.CLAUDE_RECOVERY_SKILL_ZIP ?? SKILL_ZIP_DOWNLOADS;
  const staging = mkdtempSync(join(tmpdir(), 'claude-recovery-skill-'));

  try {
    stageSkillFolder(staging, { forCli: false });
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
    if (options.doctor) {
      const report = diagnoseSkillInstall();
      console.log(report.lines.join('\n'));
      process.exit(report.ok ? 0 : 1);
    }
    if (options.install) {
      installSkillToCli({ quiet: false });
    } else {
      const result = buildSkillZip({ quiet: true, output: options.output });
      console.log(result.path);
    }
  } catch (err) {
    console.error(`skill failed: ${err.message}`);
    process.exit(1);
  }
}
