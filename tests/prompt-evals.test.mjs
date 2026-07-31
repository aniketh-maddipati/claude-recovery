import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listEvalCases,
  promptEvalAvailability,
  runPromptEvalCase,
  scorePromptResult,
} from './harness/prompt-eval.mjs';

test('prompt-eval scorer catches missing and forbidden fragments', () => {
  const score = scorePromptResult(
    'Observed evidence\nWhat should the next attempt keep, reject, or change?',
    {
      mustInclude: ['Observed evidence', 'What should the next attempt keep, reject, or change?'],
      mustNotInclude: ['I automatically rewound'],
    },
  );
  assert.equal(score.ok, true);

  const bad = scorePromptResult('I automatically rewound the session', {
    mustInclude: ['Observed evidence'],
    mustNotInclude: ['I automatically rewound'],
  });
  assert.equal(bad.ok, false);
  assert.ok(bad.failures.some((f) => f.includes('missing required fragment')));
  assert.ok(bad.failures.some((f) => f.includes('forbidden fragment')));
});

test('prompt-eval cases are loadable and reference known scenarios', () => {
  const cases = listEvalCases();
  assert.ok(cases.length >= 2);
  for (const { caseDef } of cases) {
    assert.ok(caseDef.id);
    assert.ok(caseDef.scenario);
    assert.ok(caseDef.expect);
    assert.ok(Array.isArray(caseDef.prompt) || typeof caseDef.prompt === 'string');
  }
  assert.ok(cases.some(({ caseDef }) => caseDef.scenario === 'auth-service'));
});

const availability = promptEvalAvailability();
const forceSkip = process.env.CLAUDE_RECOVERY_EVAL_SKIP === '1';
const replay = process.env.CLAUDE_RECOVERY_EVAL_REPLAY === '1';

for (const { caseDef } of listEvalCases()) {
  test(`prompt eval: ${caseDef.id}`, { timeout: 240_000 }, async (t) => {
    if (forceSkip) {
      t.skip('CLAUDE_RECOVERY_EVAL_SKIP=1');
      return;
    }

    if (!replay && !availability.ok) {
      t.skip(availability.reason);
      return;
    }

    const result = runPromptEvalCase(caseDef);
    if (result.skipped) {
      t.skip(result.reason);
      return;
    }

    assert.equal(
      result.ok ?? result.score?.ok,
      true,
      (result.failures ?? result.score?.failures ?? []).join('\n') || 'prompt eval failed',
    );
  });
}
