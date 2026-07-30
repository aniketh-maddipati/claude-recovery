import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  cleanupScenario,
  listScenarios,
  runScenarioE2E,
  setupScenario,
  SESSION_HOOK,
} from './harness/scenario-e2e.mjs';
import { createSessionHookOutput, runRecovery } from './helpers.mjs';

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
