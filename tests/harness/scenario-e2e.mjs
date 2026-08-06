/**
 * Generalized end-to-end recovery harness.
 *
 * Any fixture under fixtures/<name>/ with this layout can be exercised:
 *
 *   fixtures/<name>/
 *     scenario.json          # name, commitMessage, expectations
 *     clean/                 # files committed as the clean base
 *     bad-attempt/           # overlay applied after the base commit
 *     evidence/
 *       original-prompt.txt
 *       boundaries.json
 *       findings.json
 *     decision.json          # developer recovery decision
 *
 * The harness runs: capture → inspect → preview → approve → worktree →
 * apply → launch-instructions → SessionStart hook checks.
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { createSessionHookOutput, runRecovery } from '../helpers.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(__dirname, '..', '..');
export const FIXTURES_DIR = join(ROOT, 'fixtures');
export const SESSION_HOOK = join(ROOT, 'scripts', 'session-hook.mjs');

export function git(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

export function listScenarios() {
  return readdirSync(FIXTURES_DIR)
    .filter((name) => {
      const dir = join(FIXTURES_DIR, name);
      return (
        statSync(dir).isDirectory() &&
        existsSync(join(dir, 'scenario.json')) &&
        existsSync(join(dir, 'decision.json'))
      );
    })
    .sort();
}

export function loadScenario(name) {
  const fixtureDir = join(FIXTURES_DIR, name);
  const scenario = JSON.parse(readFileSync(join(fixtureDir, 'scenario.json'), 'utf8'));
  return { name, fixtureDir, scenario };
}

function overlayDirectory(src, dest) {
  if (!existsSync(src)) return;
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const from = join(src, entry.name);
    const to = join(dest, entry.name);
    if (entry.isDirectory()) {
      mkdirSync(to, { recursive: true });
      overlayDirectory(from, to);
    } else {
      mkdirSync(dirname(to), { recursive: true });
      cpSync(from, to);
    }
  }
}

/**
 * Build a Git sandbox from a fixture at `dest`.
 * Shared by e2e tests (ephemeral .tmp-test/) and manual sandboxes (.sandbox/).
 *
 * Options:
 *   withRejectedAttempt / withBadAttempt — overlay the deterministic rejected attempt
 *   seedDecision — copy fixtures/<name>/decision.json (test harness default: true when rejected)
 *   seedCommandEvidence — write fake commands.jsonl (default: false; recording must capture real hooks)
 */
export function setupFixtureSandbox(name, dest, {
  withBadAttempt = true,
  withRejectedAttempt = withBadAttempt,
  seedDecision = withRejectedAttempt,
  seedCommandEvidence = false,
} = {}) {
  const { fixtureDir, scenario } = loadScenario(name);
  mkdirSync(dest, { recursive: true });

  cpSync(join(fixtureDir, 'clean'), dest, { recursive: true });
  git(['init'], dest);
  git(['config', 'user.email', 'test@example.com'], dest);
  git(['config', 'user.name', 'Test User'], dest);
  git(['add', '.'], dest);
  git(['commit', '-m', scenario.commitMessage ?? `Initial ${name} base`], dest);
  const cleanBaseSha = git(['rev-parse', 'HEAD'], dest);

  const recoveryDir = join(dest, '.claude', 'recovery');
  mkdirSync(recoveryDir, { recursive: true });
  writeFileSync(
    join(recoveryDir, 'scenario.json'),
    `${JSON.stringify({ cleanBaseSha, name }, null, 2)}\n`,
  );

  const promptPath = join(fixtureDir, 'evidence', 'original-prompt.txt');
  const prompt = existsSync(promptPath) ? readFileSync(promptPath, 'utf8').trim() : '';
  writeFileSync(
    join(recoveryDir, 'original-outcome.json'),
    `${JSON.stringify({ text: prompt }, null, 2)}\n`,
  );

  for (const file of ['boundaries.json', 'findings.json']) {
    const src = join(fixtureDir, 'evidence', file);
    if (existsSync(src)) {
      cpSync(src, join(recoveryDir, file));
    }
  }

  if (prompt) {
    writeFileSync(
      join(recoveryDir, 'prompts.jsonl'),
      `${JSON.stringify({
        label: 'Observed evidence',
        timestamp: new Date().toISOString(),
        prompt,
      })}\n`,
    );
  }

  if (withRejectedAttempt) {
    overlayDirectory(join(fixtureDir, 'bad-attempt'), dest);
  }

  if (seedDecision) {
    const decisionSrc = join(fixtureDir, 'decision.json');
    if (existsSync(decisionSrc)) {
      cpSync(decisionSrc, join(recoveryDir, 'decision.json'));
    }
  }

  if (seedCommandEvidence) {
    const commandsSrc = join(fixtureDir, 'evidence', 'commands.jsonl');
    if (existsSync(commandsSrc)) {
      cpSync(commandsSrc, join(recoveryDir, 'commands.jsonl'));
    }
  }

  const snapshots = {};
  for (const entry of scenario.expectations?.originalFilesUnchanged ?? []) {
    snapshots[entry.path] = readFileSync(join(dest, entry.path), 'utf8');
  }

  return {
    sandbox: dest,
    cleanBaseSha,
    fixtureDir,
    scenario,
    snapshots,
    options: { withRejectedAttempt, seedDecision, seedCommandEvidence },
  };
}

export function setupScenario(name) {
  const tmp = join(
    ROOT,
    '.tmp-test',
    `${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const ctx = setupFixtureSandbox(name, tmp, { withBadAttempt: true });
  return { tmp, ...ctx };
}

export function cleanupScenario(tmp) {
  if (!tmp || !existsSync(tmp)) return;
  spawnSync('git', ['worktree', 'prune'], { cwd: tmp, encoding: 'utf8' });
  rmSync(tmp, { recursive: true, force: true });
}

function assertFileExpectations(root, files) {
  for (const entry of files ?? []) {
    const abs = join(root, entry.path);
    if (entry.exists === false) {
      assert.equal(existsSync(abs), false, `expected missing: ${entry.path}`);
      continue;
    }
    assert.ok(existsSync(abs), `expected file: ${entry.path}`);
    if (entry.matches || entry.doesNotMatch) {
      const content = readFileSync(abs, 'utf8');
      for (const pattern of entry.matches ?? []) {
        assert.match(content, new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      }
      for (const pattern of entry.doesNotMatch ?? []) {
        assert.doesNotMatch(content, new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      }
    }
  }
}

/**
 * Full recovery pipeline for one scenario fixture.
 * Returns artifacts for scenario-specific assertions.
 */
export function runScenarioE2E(name, { worktreeName = `recovery-${name}` } = {}) {
  const ctx = setupScenario(name);
  const { tmp, cleanBaseSha, scenario, snapshots } = ctx;
  const expect = scenario.expectations ?? {};

  try {
    const capture = runRecovery(['capture'], tmp);
    assert.equal(capture.ok, true);
    assert.equal(capture.evidence.label, 'Observed evidence');
    assert.equal(capture.evidence.sourceSha, git(['rev-parse', 'HEAD'], tmp));
    assert.equal(capture.evidence.sourceSha, cleanBaseSha);

    for (const pattern of expect.observedDiffPatterns ?? []) {
      assert.match(
        `${capture.evidence.gitDiff}\n${capture.evidence.untrackedSnapshot ?? ''}`,
        new RegExp(pattern),
      );
    }

    const inspect = runRecovery(['inspect'], tmp);
    assert.equal(inspect.view.interfaceDiff.label, 'Observed evidence');
    assert.ok(inspect.note.includes('not automatic semantic verdicts'));

    const preview = runRecovery(['preview', '--decision-file', '.claude/recovery/decision.json'], tmp);
    const manifest = preview.manifest;
    const keptPaths = manifest.selectedPatches.map((p) => p.path);
    const discardedPaths = manifest.discardedPatches.map((p) => p.path);

    for (const file of expect.keepFiles ?? []) {
      assert.ok(keptPaths.includes(file), `expected keep: ${file}`);
    }
    for (const file of expect.discardFiles ?? []) {
      assert.ok(discardedPaths.includes(file), `expected discard: ${file}`);
      assert.ok(!keptPaths.includes(file), `must not keep discarded: ${file}`);
    }

    for (const fragment of expect.continuationMustInclude ?? []) {
      assert.ok(
        manifest.continuationContext.includes(fragment),
        `continuation missing: ${fragment}`,
      );
    }

    runRecovery(['approve', '--decision-file', '.claude/recovery/decision.json'], tmp);
    const wt = runRecovery(
      ['create-worktree', '--base', cleanBaseSha, '--name', worktreeName],
      tmp,
    );
    assert.ok(existsSync(wt.worktree.path));

    const seededPending = join(wt.worktree.path, '.claude', 'recovery', 'pending-contract.json');
    assert.ok(
      existsSync(seededPending),
      'approved pending-contract.json must be seeded into the recovery worktree for SessionStart',
    );
    const seeded = JSON.parse(readFileSync(seededPending, 'utf8'));
    assert.equal(seeded.approved, true);
    assert.ok(!seeded.injectedAt, 'seeded contract must be fresh for the new session');

    const applied = runRecovery(
      ['apply-selected-patches', '--manifest', '.claude/recovery/recovery-manifest.json'],
      tmp,
    );
    if (expect.appliedPatches) {
      assert.deepEqual(applied.applied, expect.appliedPatches);
    }

    const boundaries = runRecovery(
      ['verify-boundaries', '--manifest', '.claude/recovery/recovery-manifest.json'],
      tmp,
    );
    assert.equal(boundaries.ok, true, JSON.stringify(boundaries.checks));

    const finalManifest = JSON.parse(
      readFileSync(join(tmp, '.claude/recovery/recovery-manifest.json'), 'utf8'),
    );
    assertFileExpectations(finalManifest.worktreePath, expect.worktreeFiles);

    for (const entry of expect.originalFilesUnchanged ?? []) {
      const after = readFileSync(join(tmp, entry.path), 'utf8');
      assert.equal(after, snapshots[entry.path], `original worktree changed: ${entry.path}`);
      for (const pattern of entry.matches ?? []) {
        assert.match(after, new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      }
    }

    // SessionStart must succeed when Claude is launched with cwd = recovery worktree.
    const worktreeHook = createSessionHookOutput(SESSION_HOOK, {
      hook_event_name: 'SessionStart',
      source: 'startup',
      cwd: wt.worktree.path,
      session_id: `${name}-worktree`,
    });
    assert.ok(worktreeHook, 'SessionStart in recovery worktree should inject additionalContext');
    for (const fragment of expect.hookContextMustInclude ?? []) {
      assert.match(worktreeHook.hookSpecificOutput.additionalContext, new RegExp(fragment));
    }

    const secondHook = createSessionHookOutput(SESSION_HOOK, {
      hook_event_name: 'SessionStart',
      source: 'startup',
      cwd: wt.worktree.path,
      session_id: `${name}-worktree-second`,
    });
    assert.equal(secondHook, null, 'must not inject an already-injected contract');

    // Wipe approved pending in the worktree so launch-instructions exercises manual fallback.
    if (existsSync(seededPending)) {
      const pending = JSON.parse(readFileSync(seededPending, 'utf8'));
      pending.approved = false;
      writeFileSync(seededPending, `${JSON.stringify(pending, null, 2)}\n`);
    }
    const sourcePending = join(tmp, '.claude/recovery/pending-contract.json');
    if (existsSync(sourcePending)) {
      const pending = JSON.parse(readFileSync(sourcePending, 'utf8'));
      pending.approved = false;
      writeFileSync(sourcePending, `${JSON.stringify(pending, null, 2)}\n`);
    }

    const instructions = runRecovery(
      ['launch-instructions', '--manifest', '.claude/recovery/recovery-manifest.json'],
      tmp,
    );
    assert.ok(instructions.manualFallback);
    assert.ok(instructions.recommendedLaunchCommand.includes('claude --plugin-dir'));
    assert.ok(
      !instructions.recommendedLaunchCommand.includes(' -p '),
      'recommendedLaunchCommand must be interactive (no -p)',
    );
    assert.ok(
      instructions.recommendedLaunchCommandHeadless.includes(' -p '),
      'recommendedLaunchCommandHeadless must include -p',
    );
    for (const fragment of expect.manualFallbackMustInclude ?? []) {
      const haystack = `${instructions.manualFallback.contractText}\n${instructions.manualFallback.instruction}`;
      assert.ok(haystack.includes(fragment), `manual fallback missing: ${fragment}`);
    }

    return {
      ...ctx,
      capture,
      inspect,
      manifest: finalManifest,
      applied,
      instructions,
      worktreeHook,
    };
  } catch (err) {
    cleanupScenario(tmp);
    throw err;
  }
}
