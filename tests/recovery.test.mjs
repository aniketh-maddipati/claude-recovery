import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createSessionHookOutput, runRecovery } from './helpers.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const FIXTURE = join(ROOT, 'fixtures', 'auth-service');
const SESSION_HOOK = join(ROOT, 'scripts', 'session-hook.mjs');

function git(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

function copyTree(src, dest) {
  cpSync(src, dest, { recursive: true });
}

function setupAuthScenario() {
  const tmp = join(ROOT, '.tmp-test', `auth-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmp, { recursive: true });

  copyTree(join(FIXTURE, 'clean'), tmp);
  git(['init'], tmp);
  git(['config', 'user.email', 'test@example.com'], tmp);
  git(['config', 'user.name', 'Test User'], tmp);
  git(['add', '.'], tmp);
  git(['commit', '-m', 'Initial auth-service base'], tmp);
  const cleanBaseSha = git(['rev-parse', 'HEAD'], tmp);

  mkdirSync(join(tmp, '.claude', 'recovery'), { recursive: true });
  writeFileSync(join(tmp, '.claude', 'recovery', 'scenario.json'), `${JSON.stringify({ cleanBaseSha }, null, 2)}\n`);
  writeFileSync(
    join(tmp, '.claude', 'recovery', 'original-outcome.json'),
    `${JSON.stringify({ text: readFileSync(join(FIXTURE, 'evidence', 'original-prompt.txt'), 'utf8').trim() }, null, 2)}\n`,
  );
  cpSync(join(FIXTURE, 'evidence', 'boundaries.json'), join(tmp, '.claude', 'recovery', 'boundaries.json'));
  cpSync(join(FIXTURE, 'evidence', 'findings.json'), join(tmp, '.claude', 'recovery', 'findings.json'));

  writeFileSync(
    join(tmp, '.claude', 'recovery', 'prompts.jsonl'),
    `${JSON.stringify({
      label: 'Observed evidence',
      timestamp: new Date().toISOString(),
      prompt: readFileSync(join(FIXTURE, 'evidence', 'original-prompt.txt'), 'utf8').trim(),
    })}\n`,
  );

  copyTree(join(FIXTURE, 'bad-attempt', 'src'), join(tmp, 'src'));
  mkdirSync(join(tmp, 'tests'), { recursive: true });
  copyTree(join(FIXTURE, 'bad-attempt', 'tests', 'auth-compat.test.mjs'), join(tmp, 'tests', 'auth-compat.test.mjs'));

  return { tmp, cleanBaseSha };
}

function cleanup(tmp) {
  if (!tmp || !existsSync(tmp)) return;
  try {
    spawnSync('git', ['worktree', 'prune'], { cwd: tmp });
  } catch {
    // ignore
  }
  rmSync(tmp, { recursive: true, force: true });
}

test('captures clean base SHA as observed evidence', () => {
  const { tmp, cleanBaseSha } = setupAuthScenario();
  try {
    const out = runRecovery(['capture'], tmp);
    assert.equal(out.ok, true);
    assert.equal(out.evidence.sourceSha, git(['rev-parse', 'HEAD'], tmp));
    assert.match(out.evidence.gitDiff, /verifyRequest|auth-compat/);
    assert.equal(out.evidence.label, 'Observed evidence');
    assert.equal(cleanBaseSha, out.evidence.sourceSha);
  } finally {
    cleanup(tmp);
  }
});

test('bad API migration diff is observed Git evidence only', () => {
  const { tmp } = setupAuthScenario();
  try {
    runRecovery(['capture'], tmp);
    const inspect = runRecovery(['inspect'], tmp);
    assert.equal(inspect.view.interfaceDiff.label, 'Observed evidence');
    assert.match(inspect.view.interfaceDiff.gitDiff, /verifyRequest/);
    assert.match(inspect.view.interfaceDiff.gitDiff, /authenticate/);
    assert.ok(inspect.note.includes('not automatic semantic verdicts'));
  } finally {
    cleanup(tmp);
  }
});

test('manifest keeps compatibility test and expired-token finding', () => {
  const { tmp } = setupAuthScenario();
  try {
    runRecovery(['capture'], tmp);
  cpSync(join(FIXTURE, 'decision.json'), join(tmp, '.claude', 'recovery', 'decision.json'));
    const preview = runRecovery(['preview', '--decision-file', '.claude/recovery/decision.json'], tmp);
    const manifest = preview.manifest;
    const keptPaths = manifest.selectedPatches.map((p) => p.path);
    assert.ok(keptPaths.includes('tests/auth-compat.test.mjs'));
    assert.ok(manifest.continuationContext.includes('expired-token finding'));
    assert.ok(manifest.continuationContext.includes('compatibility test'));
  } finally {
    cleanup(tmp);
  }
});

test('manifest discards interface migration files', () => {
  const { tmp } = setupAuthScenario();
  try {
    runRecovery(['capture'], tmp);
  cpSync(join(FIXTURE, 'decision.json'), join(tmp, '.claude', 'recovery', 'decision.json'));
    const preview = runRecovery(['preview', '--decision-file', '.claude/recovery/decision.json'], tmp);
    const discardedPaths = preview.manifest.discardedPatches.map((p) => p.path);
    assert.ok(discardedPaths.includes('src/auth/provider.mjs'));
    assert.ok(discardedPaths.includes('src/clients/api-client.mjs'));
    const keptPaths = preview.manifest.selectedPatches.map((p) => p.path);
    assert.ok(!keptPaths.includes('src/auth/provider.mjs'));
    assert.ok(!keptPaths.includes('src/clients/api-client.mjs'));
  } finally {
    cleanup(tmp);
  }
});

test('creates recovery worktree from selected clean SHA', () => {
  const { tmp, cleanBaseSha } = setupAuthScenario();
  try {
    runRecovery(['capture'], tmp);
  cpSync(join(FIXTURE, 'decision.json'), join(tmp, '.claude', 'recovery', 'decision.json'));
    runRecovery(['preview', '--decision-file', '.claude/recovery/decision.json'], tmp);
    const wt = runRecovery(['create-worktree', '--base', cleanBaseSha, '--name', 'recovery-test'], tmp);
    assert.ok(existsSync(wt.worktree.path));
    const provider = readFileSync(join(wt.worktree.path, 'src/auth/provider.mjs'), 'utf8');
    assert.match(provider, /authenticate\(token\)/);
    assert.doesNotMatch(provider, /verifyRequest/);
  } finally {
    cleanup(tmp);
  }
});

test('applies only selected test patch to recovery worktree', () => {
  const { tmp, cleanBaseSha } = setupAuthScenario();
  try {
    runRecovery(['capture'], tmp);
  cpSync(join(FIXTURE, 'decision.json'), join(tmp, '.claude', 'recovery', 'decision.json'));
    runRecovery(['preview', '--decision-file', '.claude/recovery/decision.json'], tmp);
    runRecovery(['create-worktree', '--base', cleanBaseSha, '--name', 'recovery-apply'], tmp);
    const applied = runRecovery(
      ['apply-selected-patches', '--manifest', '.claude/recovery/recovery-manifest.json'],
      tmp,
    );
    assert.deepEqual(applied.applied, ['tests/auth-compat.test.mjs']);
    const manifest = JSON.parse(readFileSync(join(tmp, '.claude/recovery/recovery-manifest.json'), 'utf8'));
    const wtProvider = readFileSync(join(manifest.worktreePath, 'src/auth/provider.mjs'), 'utf8');
    assert.match(wtProvider, /authenticate\(token\)/);
    assert.ok(existsSync(join(manifest.worktreePath, 'tests/auth-compat.test.mjs')));
  } finally {
    cleanup(tmp);
  }
});

test('original worktree remains unchanged after recovery', () => {
  const { tmp, cleanBaseSha } = setupAuthScenario();
  try {
    const beforeProvider = readFileSync(join(tmp, 'src/auth/provider.mjs'), 'utf8');
    runRecovery(['capture'], tmp);
    copyTree(join(FIXTURE, 'decision.json'), join(tmp, '.claude/recovery/decision.json'));
    runRecovery(['preview', '--decision-file', '.claude/recovery/decision.json'], tmp);
    runRecovery(['create-worktree', '--base', cleanBaseSha, '--name', 'recovery-unchanged'], tmp);
    runRecovery(['apply-selected-patches', '--manifest', '.claude/recovery/recovery-manifest.json'], tmp);
    const afterProvider = readFileSync(join(tmp, 'src/auth/provider.mjs'), 'utf8');
    assert.equal(afterProvider, beforeProvider);
    assert.match(afterProvider, /verifyRequest/);
  } finally {
    cleanup(tmp);
  }
});

test('continuation context includes boundaries, finding, and verification command', () => {
  const { tmp } = setupAuthScenario();
  try {
    runRecovery(['capture'], tmp);
    copyTree(join(FIXTURE, 'decision.json'), join(tmp, '.claude/recovery/decision.json'));
    const preview = runRecovery(['preview', '--decision-file', '.claude/recovery/decision.json'], tmp);
    const ctx = preview.manifest.continuationContext;
    assert.match(ctx, /Outcome: Add request authentication\./);
    assert.match(ctx, /Do not change the exported AuthProvider interface\./);
    assert.match(ctx, /Do not require a client migration\./);
    assert.match(ctx, /expired-token finding/);
    assert.match(ctx, /compatibility test: tests\/auth-compat\.test\.mjs/);
    assert.match(ctx, /Do not reintroduce the API migration\./);
    assert.match(ctx, /Run node --test tests\/auth-compat\.test\.mjs/);
  } finally {
    cleanup(tmp);
  }
});

test('session hook injects additionalContext only for approved pending contract', () => {
  const { tmp } = setupAuthScenario();
  try {
    runRecovery(['capture'], tmp);
  cpSync(join(FIXTURE, 'decision.json'), join(tmp, '.claude', 'recovery', 'decision.json'));
    runRecovery(['approve', '--decision-file', '.claude/recovery/decision.json'], tmp);

    const approvedOutput = createSessionHookOutput(
      SESSION_HOOK,
      {
        hook_event_name: 'SessionStart',
        source: 'startup',
        cwd: tmp,
        session_id: 'sess-1',
      },
    );
    assert.ok(approvedOutput);
    assert.match(approvedOutput.hookSpecificOutput.additionalContext, /Recovery Contract/);
    assert.match(approvedOutput.hookSpecificOutput.additionalContext, /Do not change the exported AuthProvider interface/);

    const second = createSessionHookOutput(
      SESSION_HOOK,
      {
        hook_event_name: 'SessionStart',
        source: 'startup',
        cwd: tmp,
        session_id: 'sess-2',
      },
    );
    assert.equal(second, null, 'should not inject twice');

    const unapprovedPath = join(tmp, '.claude/recovery/pending-unapproved.json');
    writeFileSync(
      unapprovedPath,
      `${JSON.stringify({ approved: false, contractText: 'rejected' }, null, 2)}\n`,
    );
    const rejected = createSessionHookOutput(
      SESSION_HOOK,
      {
        hook_event_name: 'SessionStart',
        source: 'startup',
        cwd: tmp,
        session_id: 'sess-3',
      },
    );
    assert.equal(rejected, null);
  } finally {
    cleanup(tmp);
  }
});

test('launch-instructions provides manual fallback without hook injection', () => {
  const { tmp } = setupAuthScenario();
  try {
    runRecovery(['capture'], tmp);
    copyTree(join(FIXTURE, 'decision.json'), join(tmp, '.claude/recovery/decision.json'));
    runRecovery(['preview', '--decision-file', '.claude/recovery/decision.json'], tmp);
    const instructions = runRecovery(
      ['launch-instructions', '--manifest', '.claude/recovery/recovery-manifest.json'],
      tmp,
    );
    assert.ok(instructions.manualFallback);
    assert.match(instructions.manualFallback.contractText, /Do not change the exported AuthProvider interface/);
    assert.match(instructions.manualFallback.instruction, /Paste recovery-contract.md/);
    assert.ok(instructions.recommendedLaunchCommand.includes('claude --plugin-dir'));
  } finally {
    cleanup(tmp);
  }
});
