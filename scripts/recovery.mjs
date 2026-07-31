#!/usr/bin/env node
/**
 * claude-recovery helper CLI — deterministic Git-backed recovery operations.
 * Requires a Git repository with at least one commit.
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RECOVERY_DIR = '.claude/recovery';

function usage() {
  console.error(`Usage: node scripts/recovery.mjs <command> [options]

Commands:
  capture
  inspect
  preview --decision-file <path>
  approve --decision-file <path>
  create-worktree --base <sha> --name <name>
  apply-selected-patches --manifest <path>
  launch-instructions --manifest <path>
`);
}

function git(args, cwd) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  return {
    ok: result.status === 0,
    status: result.status ?? 1,
    stdout: (result.stdout ?? '').trimEnd(),
    stderr: (result.stderr ?? '').trimEnd(),
  };
}

function requireGitRepo(cwd) {
  const inside = git(['rev-parse', '--git-dir'], cwd);
  if (!inside.ok) {
    throw new Error(
      'claude-recovery requires a Git repository with at least one commit. ' +
        'Initialize Git and create an initial commit before using recovery.',
    );
  }
  const head = git(['rev-parse', 'HEAD'], cwd);
  if (!head.ok) {
    throw new Error(
      'claude-recovery requires a Git repository with at least one commit. ' +
        'Create an initial commit before using recovery.',
    );
  }
  return head.stdout;
}

function recoveryRoot(cwd) {
  return join(cwd, RECOVERY_DIR);
}

function ensureRecoveryDir(cwd) {
  const root = recoveryRoot(cwd);
  mkdirSync(root, { recursive: true });
  mkdirSync(join(root, 'patches'), { recursive: true });
  return root;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function parseArgs(argv) {
  const args = [...argv];
  const command = args.shift();
  const options = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        options[key] = next;
        i += 1;
      } else {
        options[key] = true;
      }
    }
  }
  return { command, options };
}

function listChangedFiles(cwd) {
  const tracked = git(['diff', '--name-only', 'HEAD'], cwd);
  const untracked = git(['ls-files', '--others', '--exclude-standard'], cwd);
  const files = new Set();
  for (const line of tracked.stdout.split('\n').filter(Boolean)) {
    files.add(line);
  }
  for (const line of untracked.stdout.split('\n').filter(Boolean)) {
    files.add(line);
  }
  return [...files];
}

function patchBasename(filePath) {
  return filePath.replace(/\//g, '__');
}

function writePatchForFile(cwd, filePath, patchesDir) {
  const patchName = `${patchBasename(filePath)}.patch`;
  const patchPath = join(patchesDir, patchName);
  const tracked = git(['ls-files', '--error-unmatch', filePath], cwd);
  const entry = { path: filePath, patchFile: relative(recoveryRoot(cwd), patchPath) };

  if (tracked.ok) {
    const diff = git(['diff', 'HEAD', '--', filePath], cwd);
    writeFileSync(patchPath, diff.stdout ? `${diff.stdout}\n` : '', 'utf8');
    entry.kind = 'modified';
    return entry;
  }

  const abs = join(cwd, filePath);
  const content = readFileSync(abs, 'utf8');
  const fullPath = join(patchesDir, `${patchBasename(filePath)}.full.json`);
  writeJson(fullPath, { path: filePath, content });
  entry.kind = 'added';
  entry.fullFile = relative(recoveryRoot(cwd), fullPath);
  writeFileSync(patchPath, '', 'utf8');
  return entry;
}

function captureEvidence(cwd) {
  const head = requireGitRepo(cwd);
  const root = ensureRecoveryDir(cwd);
  const status = git(['status', '--short'], cwd);
  const diff = git(['diff', 'HEAD'], cwd);
  const untracked = git(['ls-files', '--others', '--exclude-standard'], cwd);
  let untrackedDiff = '';
  for (const file of untracked.stdout.split('\n').filter(Boolean)) {
    const abs = join(cwd, file);
    if (!existsSync(abs)) continue;
    untrackedDiff += `\n--- untracked: ${file} ---\n${readFileSync(abs, 'utf8')}\n`;
  }

  const evidence = {
    label: 'Observed evidence',
    capturedAt: new Date().toISOString(),
    sourceSha: head,
    cwd,
    gitStatus: status.stdout,
    gitDiff: diff.stdout,
    untrackedFiles: untracked.stdout.split('\n').filter(Boolean),
    untrackedSnapshot: untrackedDiff.trim() || null,
  };

  writeJson(join(root, 'evidence.json'), evidence);

  const patchesDir = join(root, 'patches');
  const changedFiles = listChangedFiles(cwd);
  const patches = changedFiles.map((file) => writePatchForFile(cwd, file, patchesDir));
  writeJson(join(root, 'patches-index.json'), { sourceSha: head, patches });

  return { evidence, patches };
}

function readOptionalJson(path) {
  if (!existsSync(path)) return null;
  return readJson(path);
}

function loadPrompts(cwd) {
  const promptsPath = join(recoveryRoot(cwd), 'prompts.jsonl');
  if (!existsSync(promptsPath)) return [];
  return readFileSync(promptsPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function loadFindings(cwd) {
  const findingsPath = join(recoveryRoot(cwd), 'findings.json');
  return readOptionalJson(findingsPath) ?? [];
}

function classifyVerification(cwd) {
  const commandsPath = join(recoveryRoot(cwd), 'commands.jsonl');
  if (!existsSync(commandsPath)) {
    return { status: 'missing', label: 'Observed evidence', detail: 'No verification commands recorded.' };
  }
  const lines = readFileSync(commandsPath, 'utf8').split('\n').filter(Boolean);
  const testRuns = lines
    .map((line) => JSON.parse(line))
    .filter((entry) => entry.phase === 'post' && /node --test|npm test|pnpm test|yarn test/.test(entry.command ?? ''));

  if (testRuns.length === 0) {
    return { status: 'missing', label: 'Observed evidence', detail: 'No test command output captured.' };
  }
  const last = testRuns[testRuns.length - 1];
  const failed = /fail|error|✖|not ok/i.test(`${last.stdout}\n${last.stderr}`);
  return {
    status: failed ? 'failing' : 'passing',
    label: 'Observed evidence',
    detail: last.command,
    stdout: last.stdout,
    stderr: last.stderr,
  };
}

function inspectAttempt(cwd) {
  requireGitRepo(cwd);
  const evidence = readOptionalJson(join(recoveryRoot(cwd), 'evidence.json'));
  if (!evidence) {
    captureEvidence(cwd);
  }
  const current = readOptionalJson(join(recoveryRoot(cwd), 'evidence.json'));
  const prompts = loadPrompts(cwd);
  const findings = loadFindings(cwd);
  const verification = classifyVerification(cwd);
  const patchesIndex = readOptionalJson(join(recoveryRoot(cwd), 'patches-index.json'));

  const originalOutcome =
    prompts.find((p) => p.prompt)?.prompt ??
    readOptionalJson(join(recoveryRoot(cwd), 'original-outcome.json'))?.text ??
    null;

  return {
    view: {
      originalOutcome: {
        label: originalOutcome ? 'Observed evidence' : 'Inferred suggestion',
        value: originalOutcome ?? 'No submitted prompt captured yet.',
      },
      pinnedBoundaries: {
        label: 'User decision',
        value: readOptionalJson(join(recoveryRoot(cwd), 'boundaries.json'))?.items ?? [],
      },
      interfaceDiff: {
        label: 'Observed evidence',
        sourceSha: current?.sourceSha,
        gitStatus: current?.gitStatus ?? '',
        gitDiff: current?.gitDiff ?? '',
        changedFiles: patchesIndex?.patches?.map((p) => p.path) ?? [],
      },
      verification,
      findings: findings.map((f) => ({ ...f, label: f.label ?? 'Observed evidence' })),
    },
    note: 'Git diffs and command output are Observed evidence only — not automatic semantic verdicts.',
  };
}

function resolveBaseSha(cwd, decision) {
  if (decision.next?.baseSha && decision.next.baseSha !== 'clean-base') {
    return decision.next.baseSha;
  }
  const meta = readOptionalJson(join(recoveryRoot(cwd), 'scenario.json'));
  if (meta?.cleanBaseSha) {
    return meta.cleanBaseSha;
  }
  const evidence = readOptionalJson(join(recoveryRoot(cwd), 'evidence.json'));
  return evidence?.sourceSha ?? requireGitRepo(cwd);
}

function shortOutcome(text) {
  if (!text) return '(unspecified)';
  const first = String(text).trim().split(/[.!?]/)[0].trim();
  return first.endsWith('.') ? first : `${first}.`;
}

function buildContinuationContext(decision, _cwd, manifest) {
  const verification = decision.next?.verificationCommand ?? manifest.verificationCommand;
  const baseSha = manifest.baseSha ?? manifest.sourceSha;
  const cont = decision.continuation ?? {};
  const outcome = cont.outcome ?? shortOutcome(decision.originalOutcome);
  const boundaries = cont.boundaries ?? decision.pinnedBoundaries ?? [];
  const carryForward = cont.carryForward ?? [
    ...(decision.keep?.tests ?? []).map((t) => `compatibility test: ${t}`),
    ...(decision.keep?.findings ?? []),
  ];
  const rejectedFromAssumptions = (decision.discard?.assumptions ?? [])
    .map((a) => `Do not reintroduce the ${a}.`)
    .join('\n');
  const rejected =
    cont.rejectedApproach ||
    rejectedFromAssumptions ||
    'Do not reintroduce rejected approaches.';

  return [
    `Outcome: ${outcome}`,
    '',
    'Non-negotiable boundary:',
    ...(boundaries.length ? boundaries : ['(none specified)']),
    '',
    'Carry forward:',
    ...(carryForward.length ? carryForward.map((line) => `- ${line}`) : ['- (none selected)']),
    `- verified repository base: ${baseSha}`,
    '',
    'Rejected approach:',
    rejected,
    '',
    'Before claiming completion:',
    `Run ${verification}`,
  ].join('\n');
}

function buildContractMarkdown(decision, manifest) {
  const keepLines = [
    '- original outcome',
    ...(decision.pinnedBoundaries ?? []).map((b) => `- ${b}`),
    ...(decision.keep?.tests ?? []).map((t) => `- selected test: ${t}`),
    ...(decision.keep?.findings ?? []).map((f) => `- selected finding: ${f}`),
    `- selected repository base: ${manifest.baseSha}`,
  ];
  const discardLines = [
    ...(decision.discard?.files ?? []).map((f) => `- rejected file/patch: ${f}`),
    ...(decision.discard?.assumptions ?? []).map((a) => `- rejected assumption: ${a}`),
  ];
  if (decision.next?.contextMode === 'fresh') {
    discardLines.push('- current session context (fresh continuation chosen)');
  }

  const nextLines = [
    `- Git worktree base: ${manifest.baseSha}`,
    `- selected patches to apply: ${(manifest.selectedPatches ?? []).map((p) => p.path).join(', ') || '(none)'}`,
    `- continuation: ${decision.next?.contextMode === 'fresh' ? 'fresh Claude Code session' : 'resume/fork per developer choice'}`,
    `- verification command: ${manifest.verificationCommand}`,
  ];

  return [
    'Keep',
    ...keepLines,
    '',
    'Discard',
    ...(discardLines.length ? discardLines : ['- (none specified)']),
    '',
    'Next',
    ...nextLines,
  ].join('\n');
}

function selectPatches(cwd, decision) {
  const patchesIndex = readOptionalJson(join(recoveryRoot(cwd), 'patches-index.json'));
  if (!patchesIndex) {
    captureEvidence(cwd);
  }
  const index = readOptionalJson(join(recoveryRoot(cwd), 'patches-index.json'));
  const all = index?.patches ?? [];
  const keepFiles = new Set([
    ...(decision.keep?.files ?? []),
    ...(decision.keep?.tests ?? []),
  ]);
  const discardFiles = new Set(decision.discard?.files ?? []);

  const selected = all.filter((p) => keepFiles.has(p.path));
  const discarded = all.filter(
    (p) => discardFiles.has(p.path) || (!keepFiles.has(p.path) && listChangedFiles(cwd).includes(p.path)),
  );

  for (const file of keepFiles) {
    if (!selected.some((p) => p.path === file)) {
      const patch = all.find((p) => p.path === file);
      if (patch) selected.push(patch);
    }
  }

  const finalDiscarded = all.filter((p) => !selected.some((s) => s.path === p.path));

  return { selected, discarded: finalDiscarded, sourceSha: index?.sourceSha ?? requireGitRepo(cwd) };
}

function previewRecovery(cwd, decisionPath, { approved = false } = {}) {
  const decision = readJson(decisionPath);
  const baseSha = resolveBaseSha(cwd, decision);
  const { selected, discarded, sourceSha } = selectPatches(cwd, decision);

  const manifest = {
    sourceSha,
    baseSha,
    selectedPatches: selected,
    discardedPatches: discarded,
    contextMode: decision.next?.contextMode ?? 'fresh',
    approved,
    timestamps: {
      previewedAt: new Date().toISOString(),
      approvedAt: approved ? new Date().toISOString() : null,
    },
    userDecision: decision.userDecision ?? '',
    originalOutcome: decision.originalOutcome ?? '',
    pinnedBoundaries: decision.pinnedBoundaries ?? [],
    verificationCommand: decision.next?.verificationCommand ?? 'node --test',
    contract: {
      keep: decision.keep ?? {},
      discard: decision.discard ?? {},
      next: decision.next ?? {},
    },
  };

  manifest.continuationContext = buildContinuationContext(decision, cwd, manifest);
  manifest.contractText = buildContractMarkdown(decision, manifest);

  const root = ensureRecoveryDir(cwd);
  writeFileSync(join(root, 'recovery-contract.md'), `${manifest.contractText}\n`, 'utf8');
  writeJson(join(root, 'recovery-manifest.json'), manifest);

  return manifest;
}

function approveRecovery(cwd, decisionPath) {
  const manifest = previewRecovery(cwd, decisionPath, { approved: true });
  manifest.approved = true;
  manifest.timestamps.approvedAt = new Date().toISOString();
  writeJson(join(recoveryRoot(cwd), 'recovery-manifest.json'), manifest);

  const pending = {
    approved: true,
    approvedAt: manifest.timestamps.approvedAt,
    contractText: manifest.continuationContext,
    continuationContext: manifest.continuationContext,
    manifestPath: join(recoveryRoot(cwd), 'recovery-manifest.json'),
    baseSha: manifest.baseSha,
    contextMode: manifest.contextMode,
  };
  writeJson(join(recoveryRoot(cwd), 'pending-contract.json'), pending);

  return manifest;
}

function createWorktree(cwd, baseSha, name) {
  requireGitRepo(cwd);
  const worktreesDir = join(cwd, '.claude', 'recovery-worktrees');
  mkdirSync(worktreesDir, { recursive: true });
  const wtPath = join(worktreesDir, name);
  if (existsSync(wtPath)) {
    throw new Error(`Worktree path already exists: ${wtPath}`);
  }
  const result = git(['worktree', 'add', '--detach', wtPath, baseSha], cwd);
  if (!result.ok) {
    throw new Error(`Failed to create worktree at ${baseSha}: ${result.stderr}`);
  }
  return { path: wtPath, baseSha, name };
}

/**
 * SessionStart hooks resolve pending-contract.json relative to the session cwd.
 * Because recovery launches Claude inside the new worktree, the approved contract
 * must be seeded there — not left only in the source worktree.
 */
function seedWorktreePendingContract(sourceCwd, worktreePath) {
  const sourcePending = join(recoveryRoot(sourceCwd), 'pending-contract.json');
  if (!existsSync(sourcePending)) {
    return { seeded: false, reason: 'no pending-contract.json in source recovery dir' };
  }

  const pending = readJson(sourcePending);
  if (!pending.approved) {
    return { seeded: false, reason: 'source pending-contract.json is not approved' };
  }

  const wtRecovery = join(worktreePath, RECOVERY_DIR);
  mkdirSync(wtRecovery, { recursive: true });

  pending.worktreePath = worktreePath;
  pending.seededFrom = sourcePending;
  pending.seededAt = new Date().toISOString();
  // Fresh worktree session has not injected yet.
  delete pending.injectedAt;
  delete pending.injectedFrom;

  writeJson(join(wtRecovery, 'pending-contract.json'), pending);

  for (const file of ['recovery-contract.md', 'recovery-manifest.json']) {
    const src = join(recoveryRoot(sourceCwd), file);
    if (existsSync(src)) {
      copyFileSync(src, join(wtRecovery, file));
    }
  }

  return {
    seeded: true,
    pendingContractPath: join(wtRecovery, 'pending-contract.json'),
    worktreePath,
  };
}

function applySelectedPatches(cwd, manifestPath) {
  const manifest = readJson(manifestPath);
  const wtPath = manifest.worktreePath;
  if (!wtPath || !existsSync(wtPath)) {
    throw new Error(
      'Recovery worktree path missing from manifest. Run create-worktree first and ensure manifest.worktreePath is set.',
    );
  }

  const failures = [];
  for (const patch of manifest.selectedPatches ?? []) {
    const target = join(wtPath, patch.path);
    mkdirSync(dirname(target), { recursive: true });

    if (patch.kind === 'added' && patch.fullFile) {
      const fullAbs = join(recoveryRoot(cwd), patch.fullFile);
      if (!existsSync(fullAbs)) {
        failures.push({ path: patch.path, error: `Full file snapshot not found: ${fullAbs}` });
        continue;
      }
      const snapshot = readJson(fullAbs);
      writeFileSync(target, snapshot.content, 'utf8');
      continue;
    }

    const patchAbs = join(recoveryRoot(cwd), patch.patchFile);
    if (!existsSync(patchAbs)) {
      failures.push({ path: patch.path, error: `Patch file not found: ${patchAbs}` });
      continue;
    }
    const patchContent = readFileSync(patchAbs, 'utf8');
    if (!patchContent.trim()) {
      continue;
    }

    const apply = git(['apply', '--unsafe-paths', patchAbs], wtPath);
    if (!apply.ok) {
      failures.push({ path: patch.path, error: apply.stderr, patchFile: patchAbs });
    }
  }

  if (failures.length > 0) {
    writeJson(join(recoveryRoot(cwd), 'patch-application-errors.json'), {
      label: 'Observed evidence',
      failures,
      worktreePath: wtPath,
    });
    throw new Error(
      `Patch application failed for ${failures.length} file(s). ` +
        `See .claude/recovery/patch-application-errors.json. Original worktree unchanged.`,
    );
  }

  return { applied: (manifest.selectedPatches ?? []).map((p) => p.path), worktreePath: wtPath };
}

function updateManifestWorktree(cwd, manifestPath, worktreeInfo) {
  const manifest = readJson(manifestPath);
  manifest.worktreePath = worktreeInfo.path;
  manifest.worktreeName = worktreeInfo.name;
  writeJson(manifestPath, manifest);

  const pendingPath = join(recoveryRoot(cwd), 'pending-contract.json');
  if (existsSync(pendingPath)) {
    const pending = readJson(pendingPath);
    pending.worktreePath = worktreeInfo.path;
    writeJson(pendingPath, pending);
  }

  const seed = seedWorktreePendingContract(cwd, worktreeInfo.path);
  manifest.pendingContractSeeded = seed.seeded;
  manifest.worktreePendingContractPath = seed.pendingContractPath ?? null;
  writeJson(manifestPath, manifest);
  return manifest;
}

function launchInstructions(cwd, manifestPath) {
  const manifest = readJson(manifestPath);
  const wtPath = manifest.worktreePath ?? '<worktree-path>';
  const worktreeContractPath = join(wtPath, RECOVERY_DIR, 'pending-contract.json');
  const sourceContractPath = join(recoveryRoot(cwd), 'pending-contract.json');
  const contractPath = existsSync(worktreeContractPath)
    ? worktreeContractPath
    : sourceContractPath;
  const hasPending = existsSync(contractPath) && readJson(contractPath).approved;

  const initialPrompt =
    'Use the Recovery Contract injected via additionalContext. ' +
    'Respect all non-negotiable boundaries. Do not reintroduce rejected approaches.';

  const launchCommand = [
    'claude --plugin-dir',
    `"${resolve(__dirname, '..')}"`,
    `cd "${wtPath}" && claude --plugin-dir "${resolve(__dirname, '..')}"`,
  ].join(' ');

  const recommended = `cd "${wtPath}" && claude --plugin-dir "${resolve(__dirname, '..')}" -p "${initialPrompt}"`;

  const output = {
    label: 'User decision',
    worktreePath: wtPath,
    manifestPath,
    contractPath: hasPending ? contractPath : null,
    hookInjection: hasPending
      ? {
          label: 'Inferred suggestion',
          detail:
            'SessionStart reads .claude/recovery/pending-contract.json from the worktree cwd (seeded at create-worktree) and injects it via additionalContext.',
          pendingContractPath: contractPath,
        }
      : null,
    manualFallback: hasPending
      ? null
      : {
          label: 'Observed evidence',
          contractFile: existsSync(join(wtPath, RECOVERY_DIR, 'recovery-contract.md'))
            ? join(wtPath, RECOVERY_DIR, 'recovery-contract.md')
            : join(recoveryRoot(cwd), 'recovery-contract.md'),
          contractText: manifest.continuationContext ?? manifest.contractText ?? '',
          instruction:
            'No approved pending-contract.json found in the worktree. Paste recovery-contract.md contents manually as the first message.',
        },
    recommendedLaunchCommand: recommended,
    alternateLaunchCommand: launchCommand,
    initialUserPrompt: initialPrompt,
    limitations: [
      'This plugin cannot invoke /clear or move an existing session.',
      'The developer must start Claude Code in the recovery worktree manually.',
      'Plugin SessionStart additionalContext injection may vary by Claude Code version; manual paste fallback is always available.',
    ],
  };

  return output;
}

function main() {
  const cwd = process.cwd();
  const { command, options } = parseArgs(process.argv.slice(2));

  try {
    switch (command) {
      case 'capture': {
        const result = captureEvidence(cwd);
        console.log(JSON.stringify({ ok: true, ...result }, null, 2));
        break;
      }
      case 'inspect': {
        const view = inspectAttempt(cwd);
        console.log(JSON.stringify(view, null, 2));
        break;
      }
      case 'preview': {
        if (!options['decision-file']) throw new Error('--decision-file is required');
        const manifest = previewRecovery(cwd, resolve(cwd, options['decision-file']));
        console.log(JSON.stringify({ ok: true, manifest }, null, 2));
        break;
      }
      case 'approve': {
        if (!options['decision-file']) throw new Error('--decision-file is required');
        const manifest = approveRecovery(cwd, resolve(cwd, options['decision-file']));
        console.log(JSON.stringify({ ok: true, manifest }, null, 2));
        break;
      }
      case 'create-worktree': {
        if (!options.base || !options.name) throw new Error('--base and --name are required');
        const info = createWorktree(cwd, options.base, options.name);
        const manifestPath = join(recoveryRoot(cwd), 'recovery-manifest.json');
        if (existsSync(manifestPath)) {
          updateManifestWorktree(cwd, manifestPath, info);
        }
        console.log(JSON.stringify({ ok: true, worktree: info }, null, 2));
        break;
      }
      case 'apply-selected-patches': {
        if (!options.manifest) throw new Error('--manifest is required');
        const result = applySelectedPatches(cwd, resolve(cwd, options.manifest));
        console.log(JSON.stringify({ ok: true, ...result }, null, 2));
        break;
      }
      case 'launch-instructions': {
        if (!options.manifest) throw new Error('--manifest is required');
        const instructions = launchInstructions(cwd, resolve(cwd, options.manifest));
        console.log(JSON.stringify(instructions, null, 2));
        break;
      }
      default:
        usage();
        process.exit(command ? 1 : 0);
    }
  } catch (err) {
    console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
    process.exit(1);
  }
}

main();
