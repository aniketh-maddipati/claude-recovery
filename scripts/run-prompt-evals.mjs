#!/usr/bin/env node
/**
 * Run Claude CLI prompt regressions for /recover.
 *
 * Usage:
 *   node scripts/run-prompt-evals.mjs
 *   node scripts/run-prompt-evals.mjs --case auth-recover-labels
 *   CLAUDE_RECOVERY_EVAL_RECORD=1 node scripts/run-prompt-evals.mjs
 *   CLAUDE_RECOVERY_EVAL_REPLAY=1 node scripts/run-prompt-evals.mjs
 */

import {
  listEvalCases,
  promptEvalAvailability,
  runPromptEvalCase,
} from '../tests/harness/prompt-eval.mjs';

function parseArgs(argv) {
  const options = { caseId: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--case') {
      options.caseId = argv[i + 1];
      i += 1;
    }
  }
  return options;
}

function main() {
  const { caseId } = parseArgs(process.argv.slice(2));
  const availability = promptEvalAvailability();
  const replay = process.env.CLAUDE_RECOVERY_EVAL_REPLAY === '1';

  if (!replay && !availability.ok) {
    console.error(JSON.stringify({ ok: false, skipped: true, reason: availability.reason }, null, 2));
    process.exit(2);
  }

  const cases = listEvalCases().filter(
    ({ caseDef }) => !caseId || caseDef.id === caseId,
  );
  if (cases.length === 0) {
    console.error(JSON.stringify({ ok: false, error: `No eval cases matched: ${caseId}` }, null, 2));
    process.exit(1);
  }

  let failed = 0;
  let skipped = 0;
  const results = [];

  for (const { caseDef } of cases) {
    process.stderr.write(`Running prompt eval: ${caseDef.id}...\n`);
    const result = runPromptEvalCase(caseDef);
    if (result.skipped) {
      skipped += 1;
      results.push({ id: caseDef.id, skipped: true, reason: result.reason });
      continue;
    }
    const ok = result.ok ?? result.score?.ok;
    if (!ok) failed += 1;
    results.push({
      id: caseDef.id,
      ok,
      mode: result.mode,
      failures: result.failures ?? result.score?.failures ?? [],
      preview: (result.text ?? '').slice(0, 400),
    });
  }

  const summary = {
    ok: failed === 0,
    failed,
    skipped,
    total: cases.length,
    results,
  };
  console.log(JSON.stringify(summary, null, 2));
  process.exit(failed === 0 ? 0 : 1);
}

main();
