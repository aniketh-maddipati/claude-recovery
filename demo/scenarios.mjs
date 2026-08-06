/**
 * Demo scenario definitions — shared by setup-fixture.mjs and PROMPTS.md references.
 */

import { join } from 'node:path';

export const DEMO_SCENARIOS = {
  'auth-service': {
    id: 'auth-service',
    loomTitle: 'Claude renamed your login API',
    oneLiner: 'Add auth checks without breaking existing callers.',
    story:
      'You asked Claude to add request authentication. It renamed authenticate() to verifyRequest() and updated the client — breaking every existing integration.',
    boundary: 'Do not change the exported AuthProvider interface.',
    mistake: 'verifyRequest() replaces authenticate()',
    keepLabel: 'compatibility test + expired-token finding',
    rejectLabel: 'API migration',
    approach: 'use an adapter',
    fixtureDir: 'auth-service',
    testCommand: 'node --test tests/auth-compat.test.mjs',
    decisionPaste:
      'Keep the compatibility test and expired-token discovery. The API migration is rejected. Start from the clean base and use an adapter. Do not resume this session.',
    freshSessionPaste:
      'Use the Recovery Contract. Add request authentication with an adapter around AuthProvider. Do not change AuthProvider or api-client.mjs. Before claiming completion run: node --test tests/auth-compat.test.mjs',
    approvePaste: 'Approved. Run finalize and print the launch command only.',
    demoCommands: {
      originalOutcome: 'cat .claude/recovery/original-outcome.json',
      diffStat: 'git diff --stat HEAD',
      showMistake: 'git diff HEAD -- src/auth/provider.mjs src/clients/api-client.mjs',
      evidenceTail: 'tail -n 2 .claude/recovery/commands.jsonl',
      recoverSkill: '/claude-recovery:recover',
    },
    loomCaptions: {
      problem: 'AuthProvider changed despite a no-migration boundary.',
      evidence: 'Useful evidence exists inside a rejected attempt.',
      decision: 'Keep the test. Reject the migration.',
      contract: 'Clean base + adapter approach + required verification.',
      result: 'Only the approved compatibility test carries forward.',
      fresh: 'Fresh context. Same boundary. No reconstruction.',
    },
    seedCommandsEvidence(recoveryDir, writeFileSync) {
      const commandsPath = join(recoveryDir, 'commands.jsonl');
      const expiredTokenCommand =
        "node -e \"import('./src/auth/provider.mjs').then(({AuthProvider})=>{const p=new AuthProvider('secret');console.log(JSON.stringify(p.verifyRequest({headers:{authorization:'Bearer expired-abc'}})));})\"";
      const testCommand = 'node --test tests/auth-compat.test.mjs';
      const records = [
        {
          label: 'Observed evidence',
          phase: 'post',
          timestamp: '2026-07-31T04:12:01.120Z',
          sessionId: 'demo-auth-service',
          command: expiredTokenCommand,
          stdout: '{"ok":false,"reason":"invalid or expired token"}\n',
          stderr: '',
          interrupted: false,
          durationMs: 42,
        },
        {
          label: 'Observed evidence',
          phase: 'post',
          timestamp: '2026-07-31T04:12:08.210Z',
          sessionId: 'demo-auth-service',
          command: testCommand,
          stdout: [
            'TAP version 13',
            '# Subtest: AuthProvider preserves authenticate(token) interface for clients',
            'not ok 1 - AuthProvider preserves authenticate(token) interface for clients',
            '  ---',
            '  error: |-',
            "    Expected values to be strictly equal:",
            "    + 'undefined'",
            "    - 'function'",
            '  ...',
            '# tests 1',
            '# pass 0',
            '# fail 1',
          ].join('\n'),
          stderr: '',
          interrupted: false,
          durationMs: 43,
        },
      ];
      writeFileSync(commandsPath, records.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
    },
    liveSimulation: {
      initialTask: `Add request authentication to this service.

Hard boundaries:
- Do not change the exported AuthProvider interface (keep authenticate(token)).
- Do not require a client migration.

Add tests if helpful.`,
      badAttemptNudge: `Implement authentication by changing AuthProvider to verifyRequest(request) and update api-client.mjs to use it. Commit the changes.`,
      evidenceCommands: [
        "node -e \"import('./src/auth/provider.mjs').then(({AuthProvider})=>{const p=new AuthProvider('secret');console.log(JSON.stringify(p.verifyRequest({headers:{authorization:'Bearer expired-abc'}})));})\"",
        'node --test tests/auth-compat.test.mjs',
      ],
    },
  },

  'config-toggle': {
    id: 'config-toggle',
    loomTitle: 'Claude renamed your config helper',
    oneLiner: 'Add feature flags without renaming getConfig().',
    story:
      'You asked Claude to add feature flags. It renamed getConfig() to loadSettings() — a breaking change every caller would notice immediately.',
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
      'Use the Recovery Contract. Add a feature flag reader without renaming getConfig. Run: node --test tests/config-smoke.test.mjs',
    approvePaste: 'Approved. Run finalize and print the launch command only.',
    demoCommands: {
      originalOutcome: 'cat .claude/recovery/original-outcome.json',
      diffStat: 'git diff --stat HEAD',
      showMistake: 'git diff HEAD -- src/config.mjs',
      evidenceTail: 'tail -n 2 .claude/recovery/commands.jsonl',
      recoverSkill: '/claude-recovery:recover',
    },
    loomCaptions: {
      problem: 'getConfig was renamed despite a no-rename boundary.',
      evidence: 'The smoke test caught the breaking change.',
      decision: 'Keep the test. Reject the rename.',
      contract: 'Clean base + wrapper approach + required verification.',
      result: 'Only the approved smoke test carries forward.',
      fresh: 'Fresh context. Same boundary. No reconstruction.',
    },
    seedCommandsEvidence(recoveryDir, writeFileSync) {
      const commandsPath = join(recoveryDir, 'commands.jsonl');
      const manualCheck =
        "node -e \"import('./src/config.mjs').then((m)=>console.log(typeof m.getConfig))\"";
      const testCommand = 'node --test tests/config-smoke.test.mjs';
      const records = [
        {
          label: 'Observed evidence',
          phase: 'post',
          timestamp: '2026-07-31T04:20:01.120Z',
          sessionId: 'demo-config-toggle',
          command: manualCheck,
          stdout: 'undefined\n',
          stderr: '',
          interrupted: false,
          durationMs: 38,
        },
        {
          label: 'Observed evidence',
          phase: 'post',
          timestamp: '2026-07-31T04:20:08.210Z',
          sessionId: 'demo-config-toggle',
          command: testCommand,
          stdout: [
            'TAP version 13',
            '# Subtest: getConfig remains the exported API',
            'not ok 1 - getConfig remains the exported API',
            '  ---',
            '  error: |-',
            "    Expected values to be strictly equal:",
            "    + 'undefined'",
            "    - 'function'",
            '  ...',
            '# tests 1',
            '# pass 0',
            '# fail 1',
          ].join('\n'),
          stderr: '',
          interrupted: false,
          durationMs: 41,
        },
      ];
      writeFileSync(commandsPath, records.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
    },
    liveSimulation: {
      initialTask: `Add a feature flag reader to this project.

Hard boundary:
- Do not rename the exported getConfig API.

Add a smoke test if helpful.`,
      badAttemptNudge: `Refactor config.mjs: rename getConfig to loadSettings and update exports. Commit the changes.`,
      evidenceCommands: [
        "node -e \"import('./src/config.mjs').then((m)=>console.log(typeof m.getConfig))\"",
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
