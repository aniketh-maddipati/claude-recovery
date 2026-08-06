import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  cleanupScenario,
  listScenarios,
  runScenarioE2E,
  setupScenario,
  SESSION_HOOK,
  git,
} from './harness/scenario-e2e.mjs';
import { createSessionHookOutput, runRecovery, runRecoveryExpectFail } from './helpers.mjs';

/**
 * Proper e2e coverage is scenario-driven:
 * every fixtures/<name>/ with scenario.json + decision.json runs the full
 * capture → approve → worktree → apply → hook → launch pipeline.
 */
for (const name of listScenarios()) {
  test(`e2e scenario: ${name}`, () => {
    const result = runScenarioE2E(name);
    cleanupScenario(result.tmp);
  });
}

/**
 * Auth-service remains the product golden case: exact continuation shape
 * from the original recovery product requirements.
 */
test('auth-service golden continuation context', () => {
  const { tmp } = setupScenario('auth-service');
  try {
    runRecovery(['capture'], tmp);
    const preview = runRecovery(['preview', '--decision-file', '.claude/recovery/decision.json'], tmp);
    const ctx = preview.manifest.continuationContext;
    const baseSha = preview.manifest.baseSha;

    const expected = [
      'Outcome: Add request authentication.',
      '',
      'Non-negotiable boundary:',
      'Do not change the exported AuthProvider interface.',
      'Do not require a client migration.',
      '',
      'Carry forward:',
      '- compatibility test: tests/auth-compat.test.mjs',
      "- expired-token finding: Tokens prefixed with 'expired' fail authentication with reason 'invalid or expired token' (observed during manual edge-case check).",
      `- verified repository base: ${baseSha}`,
      '',
      'Rejected approach:',
      'Do not reintroduce the API migration.',
      '',
      'Before claiming completion:',
      'Run node --test tests/auth-compat.test.mjs',
    ].join('\n');

    assert.equal(ctx, expected);
  } finally {
    cleanupScenario(tmp);
  }
});

test('preview does not approve or create a worktree', () => {
  const { tmp } = setupScenario('auth-service');
  try {
    runRecovery(['capture'], tmp);
    const preview = runRecovery(['preview', '--decision-file', '.claude/recovery/decision.json'], tmp);
    assert.equal(preview.manifest.approved, false);
    assert.equal(preview.manifest.approvedDecisionSha256, null);
    assert.equal(preview.manifest.approvedPlanSha256, null);
    assert.ok(preview.manifest.decisionSha256);
    assert.ok(preview.manifest.planSha256);
    assert.equal(preview.manifest.worktreePath, undefined);
    assert.equal(existsSync(join(tmp, '.claude', 'recovery-worktrees')), false);

    const pendingPath = join(tmp, '.claude', 'recovery', 'pending-contract.json');
    if (existsSync(pendingPath)) {
      assert.equal(JSON.parse(readFileSync(pendingPath, 'utf8')).approved, false);
    }
  } finally {
    cleanupScenario(tmp);
  }
});

test('finalize without approve fails before worktree creation', () => {
  const { tmp } = setupScenario('auth-service');
  try {
    runRecovery(['capture'], tmp);
    runRecovery(['preview', '--decision-file', '.claude/recovery/decision.json'], tmp);

    const failed = runRecoveryExpectFail(
      ['finalize', '--decision-file', '.claude/recovery/decision.json', '--name', 'should-not-exist'],
      tmp,
    );
    assert.notEqual(failed.status, 0);
    assert.match(failed.error, /not approved|requires an approved/i);
    assert.equal(
      existsSync(join(tmp, '.claude', 'recovery-worktrees', 'should-not-exist')),
      false,
      'worktree must not be created when finalize lacks approval',
    );
  } finally {
    cleanupScenario(tmp);
  }
});

test('approve stores decision and plan digests; finalize succeeds', () => {
  const { tmp } = setupScenario('auth-service');
  try {
    runRecovery(['capture'], tmp);
    runRecovery(['preview', '--decision-file', '.claude/recovery/decision.json'], tmp);
    const approved = runRecovery(['approve', '--decision-file', '.claude/recovery/decision.json'], tmp);

    assert.equal(approved.manifest.approved, true);
    assert.equal(approved.manifest.approvedDecisionSha256, approved.manifest.decisionSha256);
    assert.equal(approved.manifest.approvedPlanSha256, approved.manifest.planSha256);
    assert.ok(approved.manifest.timestamps.approvedAt);

    const pending = JSON.parse(
      readFileSync(join(tmp, '.claude', 'recovery', 'pending-contract.json'), 'utf8'),
    );
    assert.equal(pending.approved, true);

    const finalized = runRecovery(
      ['finalize', '--decision-file', '.claude/recovery/decision.json', '--name', 'ok-finalize'],
      tmp,
    );
    assert.equal(finalized.ok, true);
    assert.equal(finalized.boundaries.ok, true);
    assert.ok(finalized.receipt);
    assert.ok(existsSync(finalized.worktree.path));
  } finally {
    cleanupScenario(tmp);
  }
});

test('editing decision.json after approve makes finalize fail before worktree', () => {
  const { tmp } = setupScenario('auth-service');
  try {
    runRecovery(['capture'], tmp);
    runRecovery(['preview', '--decision-file', '.claude/recovery/decision.json'], tmp);
    runRecovery(['approve', '--decision-file', '.claude/recovery/decision.json'], tmp);

    const decisionPath = join(tmp, '.claude', 'recovery', 'decision.json');
    const decision = JSON.parse(readFileSync(decisionPath, 'utf8'));
    decision.userDecision = `${decision.userDecision} (edited after approve)`;
    writeFileSync(decisionPath, `${JSON.stringify(decision, null, 2)}\n`);

    const failed = runRecoveryExpectFail(
      ['finalize', '--decision-file', '.claude/recovery/decision.json', '--name', 'edited-decision'],
      tmp,
    );
    assert.notEqual(failed.status, 0);
    assert.match(failed.error, /decision\.json changed after approval|Rerun/i);
    assert.equal(existsSync(join(tmp, '.claude', 'recovery-worktrees', 'edited-decision')), false);
  } finally {
    cleanupScenario(tmp);
  }
});

test('changing the approved plan after approve makes finalize fail', () => {
  const { tmp } = setupScenario('auth-service');
  try {
    runRecovery(['capture'], tmp);
    runRecovery(['preview', '--decision-file', '.claude/recovery/decision.json'], tmp);
    runRecovery(['approve', '--decision-file', '.claude/recovery/decision.json'], tmp);

    const decisionPath = join(tmp, '.claude', 'recovery', 'decision.json');
    const decision = JSON.parse(readFileSync(decisionPath, 'utf8'));
    // Keep decision digest identity by rewriting with different keep set after re-approve path:
    // mutate keep files so plan digest changes; also rewrite file so decision digest changes.
    // To isolate plan change with same decision bytes is hard if plan depends on decision.
    // Instead: mutate patches-index / re-capture to change selected patch identities while
    // restoring the exact approved decision bytes after a plan-affecting capture.
    const approvedDecisionBytes = readFileSync(decisionPath);

    // Change discarded file list inside decision → both digests change; still a valid refuse.
    decision.keep.files = ['tests/auth-compat.test.mjs', 'src/auth/provider.mjs'];
    decision.keep.tests = ['tests/auth-compat.test.mjs'];
    writeFileSync(decisionPath, `${JSON.stringify(decision, null, 2)}\n`);

    // Restore exact approved decision bytes after a capture that freezes new patches? Simpler:
    // just assert finalize fails on the changed decision/plan.
    const failed = runRecoveryExpectFail(
      ['finalize', '--decision-file', '.claude/recovery/decision.json', '--name', 'plan-changed'],
      tmp,
    );
    assert.notEqual(failed.status, 0);
    assert.match(failed.error, /changed after approval|Rerun/i);
    assert.equal(existsSync(join(tmp, '.claude', 'recovery-worktrees', 'plan-changed')), false);

    // Restore bytes and mutate plan via patches-index identity change.
    writeFileSync(decisionPath, approvedDecisionBytes);
    const indexPath = join(tmp, '.claude', 'recovery', 'patches-index.json');
    const index = JSON.parse(readFileSync(indexPath, 'utf8'));
    const kept = index.patches.find((p) => p.path === 'tests/auth-compat.test.mjs');
    assert.ok(kept);
    kept.patchFile = `${kept.patchFile}.tampered`;
    writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);

    const failedPlan = runRecoveryExpectFail(
      ['finalize', '--decision-file', '.claude/recovery/decision.json', '--name', 'plan-tampered'],
      tmp,
    );
    assert.notEqual(failedPlan.status, 0);
    assert.match(failedPlan.error, /plan changed after approval|Rerun/i);
    assert.equal(existsSync(join(tmp, '.claude', 'recovery-worktrees', 'plan-tampered')), false);
  } finally {
    cleanupScenario(tmp);
  }
});

test('session hook never injects unapproved pending contract', () => {
  const { tmp } = setupScenario('auth-service');
  try {
    runRecovery(['capture'], tmp);
    runRecovery(['preview', '--decision-file', '.claude/recovery/decision.json'], tmp);

    writeFileSync(
      join(tmp, '.claude', 'recovery', 'pending-contract.json'),
      `${JSON.stringify({
        approved: false,
        contractText: 'should never inject',
      }, null, 2)}\n`,
    );

    const output = createSessionHookOutput(SESSION_HOOK, {
      hook_event_name: 'SessionStart',
      source: 'startup',
      cwd: tmp,
      session_id: 'unapproved',
    });
    assert.equal(output, null);
  } finally {
    cleanupScenario(tmp);
  }
});

test('approved contract injects once', () => {
  const { tmp, cleanBaseSha } = setupScenario('auth-service');
  try {
    runRecovery(['capture'], tmp);
    runRecovery(['approve', '--decision-file', '.claude/recovery/decision.json'], tmp);
    const wt = runRecovery(
      ['create-worktree', '--base', cleanBaseSha, '--name', 'inject-once'],
      tmp,
    );

    const first = createSessionHookOutput(SESSION_HOOK, {
      hook_event_name: 'SessionStart',
      source: 'startup',
      cwd: wt.worktree.path,
      session_id: 'first',
    });
    assert.ok(first);
    assert.match(first.hookSpecificOutput.additionalContext, /Recovery Contract/);
    assert.match(first.hookSpecificOutput.additionalContext, /Session title: recovery:/);

    const second = createSessionHookOutput(SESSION_HOOK, {
      hook_event_name: 'SessionStart',
      source: 'startup',
      cwd: wt.worktree.path,
      session_id: 'second',
    });
    assert.equal(second, null);
  } finally {
    cleanupScenario(tmp);
  }
});

test('create-worktree seeds approved pending contract into recovery worktree cwd', () => {
  const { tmp, cleanBaseSha } = setupScenario('auth-service');
  try {
    runRecovery(['capture'], tmp);
    runRecovery(['approve', '--decision-file', '.claude/recovery/decision.json'], tmp);
    const wt = runRecovery(
      ['create-worktree', '--base', cleanBaseSha, '--name', 'seed-pending'],
      tmp,
    );

    const seededPath = join(wt.worktree.path, '.claude', 'recovery', 'pending-contract.json');
    const seeded = JSON.parse(readFileSync(seededPath, 'utf8'));
    assert.equal(seeded.approved, true);
    assert.match(seeded.contractText, /Do not change the exported AuthProvider interface/);

    const injected = createSessionHookOutput(SESSION_HOOK, {
      hook_event_name: 'SessionStart',
      source: 'startup',
      cwd: wt.worktree.path,
      session_id: 'seeded-wt',
    });
    assert.ok(injected);
    assert.match(
      injected.hookSpecificOutput.additionalContext,
      /Do not change the exported AuthProvider interface/,
    );
    assert.match(injected.hookSpecificOutput.additionalContext, /^Keep/m);

    const instructions = runRecovery(
      ['launch-instructions', '--manifest', '.claude/recovery/recovery-manifest.json'],
      tmp,
    );
    assert.equal(instructions.contractPath, seededPath);
    assert.ok(instructions.hookInjection);
    assert.ok(!instructions.recommendedLaunchCommand.includes(' -p '));
    assert.match(instructions.recommendedLaunchCommandHeadless, / -p /);
    assert.match(instructions.recommendedLaunchCommandHeadless, /cat '/);
    assert.ok(instructions.recommendedLaunchCommandInteractive.includes('claude --plugin-dir'));
    assert.match(instructions.setupNativeHooksCommand, /setup-hooks\.mjs/);
    assert.equal(instructions.developerMustLaunchManually, true);
  } finally {
    cleanupScenario(tmp);
  }
});

test('finalize applies only selected patches and verifies boundaries', () => {
  const { tmp, snapshots } = setupScenario('auth-service');
  try {
    const sourceProviderBefore = readFileSync(join(tmp, 'src/auth/provider.mjs'), 'utf8');
    runRecovery(['capture'], tmp);
    runRecovery(['preview', '--decision-file', '.claude/recovery/decision.json'], tmp);
    runRecovery(['approve', '--decision-file', '.claude/recovery/decision.json'], tmp);
    const finalized = runRecovery(
      ['finalize', '--decision-file', '.claude/recovery/decision.json', '--name', 'boundary-ok'],
      tmp,
    );

    assert.deepEqual(finalized.applied.applied, ['tests/auth-compat.test.mjs']);
    assert.equal(finalized.boundaries.ok, true);

    const wt = finalized.worktree.path;
    const wtProvider = readFileSync(join(wt, 'src/auth/provider.mjs'), 'utf8');
    const baseProvider = git(['show', `${finalized.manifest.baseSha}:src/auth/provider.mjs`], tmp);
    assert.equal(wtProvider.replace(/\r\n/g, '\n').trimEnd(), baseProvider.replace(/\r\n/g, '\n').trimEnd());
    assert.match(wtProvider, /authenticate\(token\)/);
    assert.doesNotMatch(wtProvider, /verifyRequest/);
    assert.ok(existsSync(join(wt, 'tests/auth-compat.test.mjs')));

    const client = readFileSync(join(wt, 'src/clients/api-client.mjs'), 'utf8');
    assert.doesNotMatch(client, /verifyRequest/);

    // Original source worktree unchanged.
    assert.equal(readFileSync(join(tmp, 'src/auth/provider.mjs'), 'utf8'), sourceProviderBefore);
    assert.equal(
      readFileSync(join(tmp, 'src/auth/provider.mjs'), 'utf8'),
      snapshots['src/auth/provider.mjs'],
    );
  } finally {
    cleanupScenario(tmp);
  }
});

test('second finalize with same worktree name fails safely', () => {
  const { tmp } = setupScenario('auth-service');
  try {
    runRecovery(['capture'], tmp);
    runRecovery(['approve', '--decision-file', '.claude/recovery/decision.json'], tmp);
    runRecovery(
      ['finalize', '--decision-file', '.claude/recovery/decision.json', '--name', 'idempotent'],
      tmp,
    );
    const failed = runRecoveryExpectFail(
      ['finalize', '--decision-file', '.claude/recovery/decision.json', '--name', 'idempotent'],
      tmp,
    );
    assert.notEqual(failed.status, 0);
    assert.match(failed.error, /already exists/i);
  } finally {
    cleanupScenario(tmp);
  }
});

test('launch commands: interactive primary, headless uses -p, manual fallback present', () => {
  const { tmp } = setupScenario('auth-service');
  try {
    runRecovery(['capture'], tmp);
    runRecovery(['approve', '--decision-file', '.claude/recovery/decision.json'], tmp);
    const finalized = runRecovery(
      ['finalize', '--decision-file', '.claude/recovery/decision.json', '--name', 'launch-shape'],
      tmp,
    );
    const launch = finalized.launch;
    assert.match(launch.recommendedLaunchCommand, /^cd '.*' && claude --plugin-dir '.*'$/);
    assert.ok(!launch.recommendedLaunchCommand.includes(' -p '));
    assert.ok(launch.recommendedLaunchCommandHeadless.includes(' -p '));
    assert.match(
      launch.recommendedLaunchCommandHeadless,
      /cat '\.claude\/recovery\/recovery-contract\.md'/,
    );
    assert.ok(launch.manualFallback);
    assert.match(launch.manualFallback.instruction, /paste recovery-contract\.md/i);
    assert.equal(launch.recommendedLaunchCommand, launch.recommendedLaunchCommandInteractive);
  } finally {
    cleanupScenario(tmp);
  }
});

test('boundary verification failure exits nonzero with report', () => {
  const { tmp } = setupScenario('auth-service');
  try {
    runRecovery(['capture'], tmp);
    runRecovery(['approve', '--decision-file', '.claude/recovery/decision.json'], tmp);
    const finalized = runRecovery(
      ['finalize', '--decision-file', '.claude/recovery/decision.json', '--name', 'boundary-fail'],
      tmp,
    );
    // Tamper a discarded boundary file in the worktree, then re-verify.
    writeFileSync(
      join(finalized.worktree.path, 'src/auth/provider.mjs'),
      'export class AuthProvider { tampered() {} }\n',
    );
    const failed = runRecoveryExpectFail(
      ['verify-boundaries', '--manifest', '.claude/recovery/recovery-manifest.json'],
      tmp,
    );
    assert.notEqual(failed.status, 0);
    assert.ok(existsSync(join(tmp, '.claude', 'recovery', 'boundary-verification.json')));
    const report = JSON.parse(
      readFileSync(join(tmp, '.claude', 'recovery', 'boundary-verification.json'), 'utf8'),
    );
    assert.equal(report.ok, false);
  } finally {
    cleanupScenario(tmp);
  }
});

test('primary docs label headless -p correctly', async () => {
  const { ROOT } = await import('./harness/scenario-e2e.mjs');
  const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
  const skill = readFileSync(join(ROOT, 'skills/recover/SKILL.md'), 'utf8');
  assert.match(readme, /recommendedLaunchCommandHeadless/);
  assert.match(readme, /Headless \/ non-interactive|non-interactive fallback/i);
  assert.match(skill, /Headless|non-interactive/);
  assert.doesNotMatch(readme, /Prefer \*\*`recommendedLaunchCommand`\*\* \(embeds/);
});

test('compact receipt is scenario-independent and derived from manifest', async () => {
  const { spawnSync } = await import('node:child_process');
  const { ROOT } = await import('./harness/scenario-e2e.mjs');
  const { tmp } = setupScenario('auth-service');
  try {
    runRecovery(['capture'], tmp);
    runRecovery(['approve', '--decision-file', '.claude/recovery/decision.json'], tmp);
    runRecovery(
      ['finalize', '--decision-file', '.claude/recovery/decision.json', '--name', 'receipt-case'],
      tmp,
    );
    const result = runRecovery(
      ['receipt', '--manifest', '.claude/recovery/recovery-manifest.json', '--format', 'json'],
      tmp,
    );
    assert.equal(result.ok, true);
    assert.ok(result.receipt.kept.includes('tests/auth-compat.test.mjs'));
    assert.ok(result.receipt.discarded.includes('src/auth/provider.mjs'));
    assert.equal(result.receipt.boundaryVerification, 'PASS');
    assert.ok(!result.receipt.recommendedLaunchCommand.includes(' -p '));

    const text = spawnSync(
      'node',
      [join(ROOT, 'scripts', 'recovery.mjs'), 'receipt', '--manifest', '.claude/recovery/recovery-manifest.json'],
      { cwd: tmp, encoding: 'utf8' },
    );
    assert.equal(text.status, 0);
    assert.match(text.stdout, /^RECOVERY READY\n/);
    assert.match(text.stdout, /\nKept\ntests\/auth-compat\.test\.mjs\n/);
    assert.match(text.stdout, /\nDiscarded\nsrc\/auth\/provider\.mjs\n/);
    assert.match(text.stdout, /\nBoundary verification\nPASS\n/);
    assert.match(text.stdout, /\nLaunch manually\ncd '/);
    assert.doesNotMatch(text.stdout, / -p /);
  } finally {
    cleanupScenario(tmp);
  }
});
