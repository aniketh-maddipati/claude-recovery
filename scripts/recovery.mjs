#!/usr/bin/env node
/**
 * claude-recovery helper CLI — deterministic Git-backed recovery operations.
 * Requires a Git repository with at least one commit.
 *
 * Lifecycle (mechanically enforced):
 *   capture → inspect → write decision → preview → approve → finalize → verify
 * Finalize never silently approves. Digests bind the approved decision + plan.
 */

import { createHash } from 'node:crypto';
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
  finalize --decision-file <path> [--name <name>] [--base <sha>]
  receipt --manifest <path>
  verify-boundaries --manifest <path> [--worktree <path>]
  create-worktree --base <sha> --name <name>
  apply-selected-patches --manifest <path>
  launch-instructions --manifest <path>

SessionStart handoff: plugin-scoped hooks (hooks/hooks.json) are primary.
Optional compatibility fallback: node scripts/setup-hooks.mjs
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

function sha256Hex(value) {
  return createHash('sha256').update(value).digest('hex');
}

/** Deterministic JSON serialization for plan digests (sorted object keys). */
function stableStringify(value) {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function decisionFileDigest(decisionPath) {
  return sha256Hex(readFileSync(decisionPath));
}

function patchIdentity(patch) {
  return {
    path: patch.path,
    kind: patch.kind ?? null,
    patchFile: patch.patchFile ?? null,
    fullFile: patch.fullFile ?? null,
  };
}

function planDigestPayload(manifest) {
  return {
    decisionDigest: manifest.decisionSha256,
    sourceSha: manifest.sourceSha,
    baseSha: manifest.baseSha,
    selectedPatches: (manifest.selectedPatches ?? []).map(patchIdentity),
    discardedPatchPaths: (manifest.discardedPatches ?? []).map((p) => p.path).sort(),
    boundaryFiles: [...(manifest.boundaryFiles ?? [])].sort(),
    forbiddenPatterns: [...(manifest.forbiddenPatterns ?? [])].sort(),
    contextMode: manifest.contextMode ?? null,
    verificationCommand: manifest.verificationCommand ?? null,
    continuationContext: manifest.continuationContext ?? null,
    contractText: manifest.contractText ?? null,
  };
}

function computePlanDigest(manifest) {
  return sha256Hex(stableStringify(planDigestPayload(manifest)));
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

/**
 * Build the recovery plan from the current decision + frozen patch index.
 * Does not write approval state or pending contracts.
 */
function buildRecoveryPlan(cwd, decisionPath) {
  const decision = readJson(decisionPath);
  const decisionSha256 = decisionFileDigest(decisionPath);
  const baseSha = resolveBaseSha(cwd, decision);
  const { selected, discarded, sourceSha } = selectPatches(cwd, decision);

  const manifest = {
    sourceSha,
    baseSha,
    selectedPatches: selected,
    discardedPatches: discarded,
    contextMode: decision.next?.contextMode ?? 'fresh',
    approved: false,
    decisionSha256,
    planSha256: null,
    approvedDecisionSha256: null,
    approvedPlanSha256: null,
    timestamps: {
      previewedAt: new Date().toISOString(),
      approvedAt: null,
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
  manifest.boundaryFiles = decision.boundaryFiles ?? decision.discard?.files ?? [];
  manifest.forbiddenPatterns = decision.forbiddenPatterns ?? [];
  manifest.planSha256 = computePlanDigest(manifest);

  return manifest;
}

function previewRecovery(cwd, decisionPath) {
  const manifest = buildRecoveryPlan(cwd, decisionPath);
  // Preview is never approved and must not write an approved pending contract.
  manifest.approved = false;
  manifest.approvedDecisionSha256 = null;
  manifest.approvedPlanSha256 = null;
  manifest.timestamps.approvedAt = null;

  const root = ensureRecoveryDir(cwd);
  writeFileSync(join(root, 'recovery-contract.md'), `${manifest.contractText}\n`, 'utf8');
  writeJson(join(root, 'recovery-manifest.json'), manifest);

  const pendingPath = join(root, 'pending-contract.json');
  if (existsSync(pendingPath)) {
    const existing = readOptionalJson(pendingPath);
    // Clear prior approval so an unapproved preview cannot leave an approved pending contract.
    if (existing?.approved) {
      writeJson(pendingPath, {
        ...existing,
        approved: false,
        clearedBy: 'preview',
        clearedAt: new Date().toISOString(),
      });
    }
  }

  return manifest;
}

function approveRecovery(cwd, decisionPath) {
  const manifest = buildRecoveryPlan(cwd, decisionPath);
  const approvedAt = new Date().toISOString();
  manifest.approved = true;
  manifest.approvedDecisionSha256 = manifest.decisionSha256;
  manifest.approvedPlanSha256 = manifest.planSha256;
  manifest.timestamps.previewedAt =
    readOptionalJson(join(recoveryRoot(cwd), 'recovery-manifest.json'))?.timestamps?.previewedAt ??
    manifest.timestamps.previewedAt;
  manifest.timestamps.approvedAt = approvedAt;

  const root = ensureRecoveryDir(cwd);
  writeFileSync(join(root, 'recovery-contract.md'), `${manifest.contractText}\n`, 'utf8');
  writeJson(join(root, 'recovery-manifest.json'), manifest);

  const pending = {
    approved: true,
    approvedAt,
    approvedDecisionSha256: manifest.approvedDecisionSha256,
    approvedPlanSha256: manifest.approvedPlanSha256,
    contractText: manifest.contractText,
    continuationContext: manifest.continuationContext,
    manifestPath: join(root, 'recovery-manifest.json'),
    baseSha: manifest.baseSha,
    contextMode: manifest.contextMode,
  };
  writeJson(join(root, 'pending-contract.json'), pending);

  return manifest;
}

function approvalMismatchError(detail) {
  return new Error(
    `${detail} Rerun: node scripts/recovery.mjs preview --decision-file <path> ` +
      `then node scripts/recovery.mjs approve --decision-file <path> before finalize.`,
  );
}

function requireApprovedManifest(cwd, decisionPath) {
  const manifestPath = join(recoveryRoot(cwd), 'recovery-manifest.json');
  if (!existsSync(manifestPath)) {
    throw approvalMismatchError(
      'Finalize requires an approved recovery manifest, but none exists.',
    );
  }

  const approvedManifest = readJson(manifestPath);
  if (!approvedManifest.approved) {
    throw approvalMismatchError(
      'Finalize refused: recovery manifest is not approved.',
    );
  }
  if (!approvedManifest.approvedDecisionSha256 || !approvedManifest.approvedPlanSha256) {
    throw approvalMismatchError(
      'Finalize refused: approved manifest is missing decision/plan digests.',
    );
  }

  const currentDecisionDigest = decisionFileDigest(decisionPath);
  if (currentDecisionDigest !== approvedManifest.approvedDecisionSha256) {
    throw approvalMismatchError(
      'Finalize refused: decision.json changed after approval ' +
        `(expected ${approvedManifest.approvedDecisionSha256}, got ${currentDecisionDigest}).`,
    );
  }

  const currentPlan = buildRecoveryPlan(cwd, decisionPath);
  if (currentPlan.planSha256 !== approvedManifest.approvedPlanSha256) {
    throw approvalMismatchError(
      'Finalize refused: recovery plan changed after approval ' +
        `(expected ${approvedManifest.approvedPlanSha256}, got ${currentPlan.planSha256}).`,
    );
  }
  if (currentPlan.decisionSha256 !== approvedManifest.approvedDecisionSha256) {
    throw approvalMismatchError(
      'Finalize refused: decision digest no longer matches the approved value.',
    );
  }

  return { manifestPath, approvedManifest };
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
  pending.worktreeName = worktreePath.split(/[/\\]/).pop() ?? null;
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
    pending.worktreeName = worktreeInfo.name;
    writeJson(pendingPath, pending);
  }

  const seed = seedWorktreePendingContract(cwd, worktreeInfo.path);
  manifest.pendingContractSeeded = seed.seeded;
  manifest.worktreePendingContractPath = seed.pendingContractPath ?? null;
  writeJson(manifestPath, manifest);
  return manifest;
}

function shellSingleQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function shortSha(sha) {
  if (!sha) return '(unknown)';
  return String(sha).slice(0, 12);
}

function launchInstructions(cwd, manifestPath) {
  const manifest = readJson(manifestPath);
  const wtPath = manifest.worktreePath ?? '<worktree-path>';
  const pluginDir = process.env.CLAUDE_RECOVERY_PLUGIN_DIR || resolve(__dirname, '..');
  const worktreeContractPath = join(wtPath, RECOVERY_DIR, 'pending-contract.json');
  const sourceContractPath = join(recoveryRoot(cwd), 'pending-contract.json');
  const contractPath = existsSync(worktreeContractPath)
    ? worktreeContractPath
    : sourceContractPath;
  const hasPending = existsSync(contractPath) && readJson(contractPath).approved;

  const contractFileRel = join(RECOVERY_DIR, 'recovery-contract.md');
  const contractFileInWorktree = join(wtPath, contractFileRel);
  const contractFile = existsSync(contractFileInWorktree)
    ? contractFileInWorktree
    : join(recoveryRoot(cwd), 'recovery-contract.md');

  // Primary recommended launch: interactive Claude Code (no -p).
  const interactiveLaunch =
    `cd ${shellSingleQuote(wtPath)} && claude --plugin-dir ${shellSingleQuote(pluginDir)}`;
  // Headless / non-interactive fallback embeds the contract via -p.
  const headlessLaunch =
    `${interactiveLaunch} -p "$(cat ${shellSingleQuote(contractFileRel)})"`;
  const setupHooksHint =
    'node scripts/setup-hooks.mjs  # optional compatibility fallback for native SessionStart';

  const output = {
    label: 'User decision',
    worktreePath: wtPath,
    manifestPath,
    contractPath: hasPending ? contractPath : null,
    contractFile: existsSync(contractFile) ? contractFile : null,
    developerMustLaunchManually: true,
    hookInjection: hasPending
      ? {
          label: 'Inferred suggestion',
          detail:
            'Primary handoff: plugin-scoped SessionStart reads .claude/recovery/pending-contract.json ' +
            'from the worktree cwd and injects the approved Recovery Contract. ' +
            'Optional fallback: run setup-hooks.mjs once for native ~/.claude/settings.json hooks. ' +
            'Headless fallback: recommendedLaunchCommandHeadless embeds the contract via -p (non-interactive).',
          pendingContractPath: contractPath,
          setupHooksCommand: setupHooksHint,
        }
      : null,
    manualFallback: {
      label: 'Observed evidence',
      contractFile,
      contractText: manifest.contractText ?? manifest.continuationContext ?? '',
      instruction:
        'If the new session does not acknowledge the Recovery Contract, Paste recovery-contract.md as your first message.',
    },
    // Interactive session — developer runs this manually.
    recommendedLaunchCommand: interactiveLaunch,
    // Headless / non-interactive (-p). Not an interactive session.
    recommendedLaunchCommandHeadless: headlessLaunch,
    // Deprecated alias of the interactive command; prefer recommendedLaunchCommand.
    recommendedLaunchCommandInteractive: interactiveLaunch,
    setupNativeHooksCommand: setupHooksHint,
    limitations: [
      'This plugin cannot invoke /clear or move an existing session.',
      'The developer must start Claude Code in the recovery worktree manually.',
      'recommendedLaunchCommand is interactive (no -p). Plugin SessionStart injects the approved contract.',
      'recommendedLaunchCommandHeadless uses -p and is non-interactive.',
      'Native setup-hooks.mjs is an optional compatibility fallback, not required for normal use.',
    ],
  };

  return output;
}

function searchTreeForPattern(root, pattern) {
  const hits = [];
  const re = new RegExp(pattern);
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
      } else if (re.test(readFileSync(abs, 'utf8'))) {
        hits.push(relative(root, abs));
      }
    }
  }
  walk(root);
  return hits;
}

function verifyBoundaries(cwd, manifestPath, { worktreePath: wtOverride } = {}) {
  const manifest = readJson(manifestPath);
  const wtPath = wtOverride ?? manifest.worktreePath;
  if (!wtPath || !existsSync(wtPath)) {
    throw new Error('Recovery worktree path missing. Pass --worktree or set manifest.worktreePath.');
  }

  const baseSha = manifest.baseSha;
  if (!baseSha) {
    throw new Error('manifest.baseSha is required for boundary verification.');
  }

  const filesToCheck = manifest.boundaryFiles ?? [];
  const forbiddenPatterns = manifest.forbiddenPatterns ?? [];
  const results = [];

  for (const file of filesToCheck) {
    const wtFile = join(wtPath, file);
    if (!existsSync(wtFile)) {
      results.push({ file, label: 'Observed evidence', ok: false, reason: 'missing in worktree' });
      continue;
    }
    const wtContent = readFileSync(wtFile, 'utf8').replace(/\r\n/g, '\n').trimEnd();
    const base = git(['show', `${baseSha}:${file}`], cwd);
    if (!base.ok) {
      results.push({
        file,
        label: 'Observed evidence',
        ok: false,
        reason: `not tracked at baseSha ${baseSha}: ${base.stderr}`,
      });
      continue;
    }
    const baseContent = base.stdout.replace(/\r\n/g, '\n').trimEnd();
    const matches = wtContent === baseContent;
    results.push({
      file,
      label: 'Observed evidence',
      ok: matches,
      reason: matches ? 'byte-identical to baseSha' : 'differs from baseSha',
    });
  }

  const grepScope = join(wtPath, 'src');
  if (existsSync(grepScope) && forbiddenPatterns.length > 0) {
    for (const pattern of forbiddenPatterns) {
      const hits = searchTreeForPattern(grepScope, pattern);
      results.push({
        pattern,
        label: 'Observed evidence',
        ok: hits.length === 0,
        reason: hits.length === 0 ? 'not found under src/' : `found in: ${hits.join(', ')}`,
      });
    }
  }

  const ok = results.every((r) => r.ok);
  const output = { ok, label: 'Observed evidence', baseSha, worktreePath: wtPath, checks: results };
  writeJson(join(recoveryRoot(cwd), 'boundary-verification.json'), output);
  // Also seed into worktree for receipt / demo inspection.
  if (existsSync(wtPath)) {
    mkdirSync(join(wtPath, RECOVERY_DIR), { recursive: true });
    writeJson(join(wtPath, RECOVERY_DIR, 'boundary-verification.json'), output);
  }
  return output;
}

function formatReceipt(cwd, manifestPath) {
  const manifest = readJson(manifestPath);
  const launch = launchInstructions(cwd, manifestPath);
  const boundaryPath = join(recoveryRoot(cwd), 'boundary-verification.json');
  const boundary = existsSync(boundaryPath) ? readJson(boundaryPath) : null;
  const kept = (manifest.selectedPatches ?? []).map((p) => p.path);
  const discarded = (manifest.discardedPatches ?? []).map((p) => p.path);
  const boundaryStatus = boundary
    ? boundary.ok
      ? 'PASS'
      : 'FAIL'
    : 'NOT RUN';

  const lines = [
    'RECOVERY READY',
    '',
    'Base',
    shortSha(manifest.baseSha),
    '',
    'Kept',
    ...(kept.length ? kept : ['(none)']),
    '',
    'Discarded',
    ...(discarded.length ? discarded : ['(none)']),
    '',
    'Boundary verification',
    boundaryStatus,
    '',
    'Fresh worktree',
    manifest.worktreePath ?? '(not created)',
    '',
    'Launch manually',
    launch.recommendedLaunchCommand,
  ];

  return {
    text: `${lines.join('\n')}\n`,
    receipt: {
      baseSha: manifest.baseSha,
      baseShaShort: shortSha(manifest.baseSha),
      kept,
      discarded,
      boundaryVerification: boundaryStatus,
      worktreePath: manifest.worktreePath ?? null,
      recommendedLaunchCommand: launch.recommendedLaunchCommand,
      recommendedLaunchCommandHeadless: launch.recommendedLaunchCommandHeadless,
    },
  };
}

function finalizeRecovery(cwd, decisionPath, { baseSha, name } = {}) {
  // Approval is a prior explicit step. Finalize never calls approveRecovery.
  const { manifestPath, approvedManifest } = requireApprovedManifest(cwd, decisionPath);

  const resolvedBase = baseSha ?? approvedManifest.baseSha;
  const worktreeName = name ?? `recovery-${Date.now()}`;

  // Create worktree only after all approval validation succeeds.
  const worktree = createWorktree(cwd, resolvedBase, worktreeName);
  updateManifestWorktree(cwd, manifestPath, worktree);

  let applied;
  try {
    applied = applySelectedPatches(cwd, manifestPath);
  } catch (err) {
    // Source worktree remains unchanged; leave inspectable error artifact.
    throw err;
  }

  const boundaries = verifyBoundaries(cwd, manifestPath);
  if (!boundaries.ok) {
    const reportPath = join(recoveryRoot(cwd), 'boundary-verification.json');
    throw new Error(
      `Boundary verification failed after finalize. See ${reportPath}. ` +
        `Checks: ${JSON.stringify(boundaries.checks)}`,
    );
  }

  const finalManifest = readJson(manifestPath);
  finalManifest.boundaryVerification = {
    ok: boundaries.ok,
    verifiedAt: new Date().toISOString(),
  };
  finalManifest.finalizedAt = new Date().toISOString();
  writeJson(manifestPath, finalManifest);

  const launch = launchInstructions(cwd, manifestPath);
  const { text: receiptText, receipt } = formatReceipt(cwd, manifestPath);

  return {
    ok: true,
    manifest: finalManifest,
    worktree,
    applied,
    boundaries,
    launch,
    receipt,
    receiptText,
    note: 'Developer must run recommendedLaunchCommand manually. Plugin does not start Claude or invoke /clear.',
  };
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
      case 'finalize': {
        if (!options['decision-file']) throw new Error('--decision-file is required');
        const result = finalizeRecovery(cwd, resolve(cwd, options['decision-file']), {
          baseSha: options.base,
          name: options.name,
        });
        if (options.format === 'compact') {
          process.stdout.write(result.receiptText);
        } else {
          console.log(JSON.stringify(result, null, 2));
        }
        break;
      }
      case 'receipt': {
        if (!options.manifest) throw new Error('--manifest is required');
        const { text, receipt } = formatReceipt(cwd, resolve(cwd, options.manifest));
        if (options.format === 'json') {
          console.log(JSON.stringify({ ok: true, receipt }, null, 2));
        } else {
          process.stdout.write(text);
        }
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
      case 'verify-boundaries': {
        if (!options.manifest) throw new Error('--manifest is required');
        const report = verifyBoundaries(cwd, resolve(cwd, options.manifest), {
          worktreePath: options.worktree ? resolve(cwd, options.worktree) : undefined,
        });
        console.log(JSON.stringify(report, null, 2));
        if (!report.ok) process.exit(1);
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
