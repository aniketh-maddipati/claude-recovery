/**
 * Demo scenario definitions — shared by setup-fixture.mjs and PROMPTS.md references.
 *
 * Fixtures are deterministic mixed-attempt overlays for rehearsal/recording.
 * They are not evidence that Claude independently violated an instruction.
 */

export const DEMO_SCENARIOS = {
  'auth-service': {
    id: 'auth-service',
    loomTitle: 'Selective salvage from a mixed Claude attempt',
    oneLiner: 'Two rejected API changes. One useful compatibility test.',
    story:
      'A Claude attempt changed AuthProvider and ApiClient, but also produced a useful ' +
      'compatibility test and an expired-token finding. Recovery keeps only the approved artifacts.',
    boundary: 'Do not change the exported AuthProvider interface.',
    mistake: 'verifyRequest() replaces authenticate()',
    keepLabel: 'compatibility test + expired-token finding',
    rejectLabel: 'API migration',
    approach: 'use an adapter',
    fixtureDir: 'auth-service',
    testCommand: 'node --test tests/auth-compat.test.mjs',
    decisionPaste:
      'Keep the compatibility test and expired-token finding.\n' +
      'Reject the AuthProvider and client migrations.\n' +
      'Start clean and use an adapter.',
    freshSessionPaste:
      'Summarize the implementation boundary before editing.',
    approvePaste:
      'Approved. Run approve, then finalize, then show the compact receipt and interactive launch command.',
    demoCommands: {
      originalOutcome: 'cat .claude/recovery/original-outcome.json',
      diffStat: 'git diff --stat HEAD',
      showMistake: 'git diff HEAD -- src/auth/provider.mjs src/clients/api-client.mjs',
      runCompatTest: 'node --test tests/auth-compat.test.mjs',
      recoverSkill: '/claude-recovery:recover',
    },
    loomCaptions: {
      problem: 'Two rejected API changes. One useful compatibility test.',
      evidence: 'Observed evidence from Git + the real failing test run.',
      decision: 'Keep the test. Reject the migration.',
      contract: 'KEEP test + finding. DISCARD provider + client. NEXT: adapter.',
      result: 'Only the approved compatibility test carries forward.',
      fresh: 'Fresh interactive session. Summarize the boundary before editing.',
    },
    liveSimulation: {
      initialTask: `Add request authentication to this service.

Hard boundaries:
- Do not change the exported AuthProvider interface (keep authenticate(token)).
- Do not require a client migration.

Add tests if helpful.`,
      // Live demos may still need a nudge; do not present this as natural misbehavior.
      badAttemptNudge: `For this recording rehearsal only, apply the deterministic rejected overlay shape:
change AuthProvider to verifyRequest(request) and update api-client.mjs accordingly.
This nudge is explicit demo setup — not something to imply happened without instruction.`,
      evidenceCommands: [
        'node --test tests/auth-compat.test.mjs',
      ],
    },
  },

  'config-toggle': {
    id: 'config-toggle',
    loomTitle: 'Selective salvage from a renamed config helper',
    oneLiner: 'Rejected rename. Useful smoke test kept.',
    story:
      'A Claude attempt renamed getConfig() to loadSettings(), but also produced a useful smoke test. ' +
      'Recovery keeps only the approved test.',
    boundary: 'Do not rename the exported getConfig API.',
    mistake: 'loadSettings() replaces getConfig()',
    keepLabel: 'smoke test + default-false finding',
    rejectLabel: 'getConfig rename',
    approach: 'wrap getConfig with a flag helper',
    fixtureDir: 'config-toggle',
    testCommand: 'node --test tests/config-smoke.test.mjs',
    decisionPaste:
      'Keep the smoke test and default-false finding. Reject the getConfig rename. Fresh session from clean base.',
    freshSessionPaste:
      'Summarize the implementation boundary before editing.',
    approvePaste:
      'Approved. Run approve, then finalize, then show the compact receipt and interactive launch command.',
    demoCommands: {
      originalOutcome: 'cat .claude/recovery/original-outcome.json',
      diffStat: 'git diff --stat HEAD',
      showMistake: 'git diff HEAD -- src/config.mjs',
      runSmokeTest: 'node --test tests/config-smoke.test.mjs',
      recoverSkill: '/claude-recovery:recover',
    },
    loomCaptions: {
      problem: 'Rejected rename. Useful smoke test kept.',
      evidence: 'Observed evidence from Git + the real failing test run.',
      decision: 'Keep the test. Reject the rename.',
      contract: 'Clean base + wrapper approach + required verification.',
      result: 'Only the approved smoke test carries forward.',
      fresh: 'Fresh interactive session. Summarize the boundary before editing.',
    },
    liveSimulation: {
      initialTask: `Add a feature flag reader to this project.

Hard boundary:
- Do not rename the exported getConfig API.

Add a smoke test if helpful.`,
      badAttemptNudge: `For this recording rehearsal only, apply the deterministic rejected overlay shape:
rename getConfig to loadSettings and update exports.
This nudge is explicit demo setup — not something to imply happened without instruction.`,
      evidenceCommands: [
        'node --test tests/config-smoke.test.mjs',
      ],
    },
  },
};

export function listDemoScenarios() {
  return Object.keys(DEMO_SCENARIOS);
}

export function getDemoScenario(name) {
  const scenario = DEMO_SCENARIOS[name];
  if (!scenario) {
    throw new Error(
      `Unknown demo scenario: ${name}. Available: ${listDemoScenarios().join(', ')}`,
    );
  }
  return scenario;
}
