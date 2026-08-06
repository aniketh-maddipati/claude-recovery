import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { setupDemoFixture, demoFixturePath, stripDemoSessionArtifacts, assertHonestDemoFixture } from '../demo/setup-fixture.mjs';
import { setupLiveFixture } from '../demo/setup-live.mjs';
import { listDemoScenarios } from '../demo/scenarios.mjs';
import { ROOT, setupFixtureSandbox, cleanupScenario } from './harness/scenario-e2e.mjs';
import { runRecovery } from './helpers.mjs';

for (const scenarioName of listDemoScenarios()) {
  test(`demo fixture ${scenarioName} is honest (diff + test, no seeded decision/commands)`, () => {
    const result = setupDemoFixture({ scenario: scenarioName, reset: true });
    const fixture = demoFixturePath(scenarioName);

    assert.equal(result.ok, true);
    assert.equal(result.fixture, fixture);
    assert.ok(existsSync(join(fixture, '.git')));
    assert.ok(existsSync(join(fixture, '.claude/recovery/original-outcome.json')));
    assert.equal(existsSync(join(fixture, '.claude/recovery/decision.json')), false);
    assert.equal(
      existsSync(join(fixture, '.claude/recovery/commands.jsonl')) &&
        readFileSync(join(fixture, '.claude/recovery/commands.jsonl'), 'utf8').trim() !== '',
      false,
    );
    assert.equal(existsSync(join(fixture, '.claude/recovery/recovery-manifest.json')), false);
    assert.equal(existsSync(join(fixture, '.claude/recovery/pending-contract.json')), false);

    const status = spawnSync('git', ['diff', '--stat', 'HEAD'], { cwd: fixture, encoding: 'utf8' });
    assert.ok(status.stdout.trim().length > 0, 'rejected Git diff must be present');

    if (scenarioName === 'auth-service') {
      assert.ok(existsSync(join(fixture, 'tests/auth-compat.test.mjs')));
      const provider = readFileSync(join(fixture, 'src/auth/provider.mjs'), 'utf8');
      assert.doesNotMatch(provider, /BAD ATTEMPT/);
      assert.match(provider, /verifyRequest/);
    }
    if (scenarioName === 'config-toggle') {
      assert.ok(existsSync(join(fixture, 'tests/config-smoke.test.mjs')));
      const config = readFileSync(join(fixture, 'src/config.mjs'), 'utf8');
      assert.doesNotMatch(config, /BAD ATTEMPT/);
    }

    assert.match(result.launchCommand, /claude --plugin-dir/);
    assert.match(result.note ?? '', /[Dd]eterministic/);
  });
}

test('fixture source contains no BAD ATTEMPT marker', () => {
  const files = [
    'fixtures/auth-service/bad-attempt/src/auth/provider.mjs',
    'fixtures/auth-service/bad-attempt/src/clients/api-client.mjs',
    'fixtures/config-toggle/bad-attempt/src/config.mjs',
  ];
  for (const rel of files) {
    const content = readFileSync(join(ROOT, rel), 'utf8');
    assert.doesNotMatch(content, /BAD ATTEMPT/);
  }
});

test('test harness can still seed decision without seeding commands', () => {
  const dest = join(ROOT, '.tmp-test', `seed-opts-${Date.now()}`);
  try {
    setupFixtureSandbox('auth-service', dest, {
      withRejectedAttempt: true,
      seedDecision: true,
      seedCommandEvidence: false,
    });
    assert.ok(existsSync(join(dest, '.claude/recovery/decision.json')));
    assert.equal(existsSync(join(dest, '.claude/recovery/commands.jsonl')), false);
  } finally {
    cleanupScenario(dest);
  }
});

test('live demo fixture starts clean without bad attempt', () => {
  const result = setupLiveFixture({ scenario: 'config-toggle', reset: true });
  assert.equal(result.mode, 'live');
  assert.ok(existsSync(join(result.fixture, 'src/config.mjs')));
  const content = readFileSync(join(result.fixture, 'src/config.mjs'), 'utf8');
  assert.match(content, /getConfig/);
  assert.doesNotMatch(content, /loadSettings/);
});

test('setupDemoFixture strips stale commands.jsonl from a previous rehearsal', () => {
  const result = setupDemoFixture({ scenario: 'auth-service', reset: true });
  writeFileSync(join(result.fixture, '.claude/recovery/commands.jsonl'), '{"rehearsal":true}\n');
  stripDemoSessionArtifacts(result.fixture);
  assert.doesNotThrow(() => assertHonestDemoFixture(result.fixture));
});

test('PROMPTS.md and RECORDING.md match the implemented flow', () => {
  const prompts = readFileSync(join(ROOT, 'demo/PROMPTS.md'), 'utf8');
  const recording = readFileSync(join(ROOT, 'demo/RECORDING.md'), 'utf8');
  const script = readFileSync(join(ROOT, 'demo/SCRIPT.md'), 'utf8');
  for (const name of listDemoScenarios()) {
    assert.match(prompts, new RegExp(name));
  }
  assert.match(recording, /45–75s|45-75s/);
  assert.match(recording, /What viewers should see/i);
  assert.match(prompts, /Before editing, summarize the implementation boundary/);
  assert.match(recording, /Before editing, summarize the implementation boundary/);
  assert.match(prompts, /Run approve and finalize as separate steps/i);
  assert.match(prompts, /Reject the AuthProvider interface change and ApiClient migration/);
  assert.match(prompts, /Do not pre-seed|commands\.jsonl.*absent|start absent/i);
  assert.match(recording, /waits trimmed/i);
  assert.match(recording, /The implementation direction is rejected\. The test is useful\./);
  assert.match(script, /YOU SAY/);
  assert.match(script, /YOU PASTE/);
  assert.match(script, /VIEWERS SHOULD SEE/);
  assert.match(script, /Directory map/);
  assert.match(script, /\*\*FIXTURE\*\*/);
  assert.match(script, /\*\*WORKTREE\*\*/);
  assert.match(script, /Steps 1–17/);
  assert.match(script, /Step 1 — SAY/);
  assert.match(script, /Step 4 — PASTE/);
  assert.match(script, /Step 19 — TYPE/);
  assert.match(script, /Step 23 — PASTE/);
  assert.match(script, /Write\/edit code.*0/);
  assert.match(script, /login checker/);
  assert.match(script, /fake mini app/);
  assert.match(script, /I built claude-recovery for a recovery case rewind/);
  assert.match(script, /Quick context — this is a fake mini app/);
  assert.match(script, /Same boundary, clean tree, useful test kept/);
  assert.match(script, /Loom/);
  assert.match(script, /asciinema/);
  assert.match(script, /demo\/record\.sh|npm run demo:record/);
  assert.doesNotMatch(recording, /tail -n 2 \.claude\/recovery\/commands\.jsonl/);
  assert.doesNotMatch(prompts, /seedCommandsEvidence|hardcoded fake timestamps/i);
});

test('npm run demo prints the complete primary sequence', () => {
  const result = spawnSync('npm', ['run', 'demo'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  const out = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  assert.match(out, /Complete interactive sequence/);
  assert.match(out, /\/claude-recovery:recover/);
  assert.match(out, /Reject the AuthProvider interface change and ApiClient migration/);
  assert.match(out, /Run approve and finalize as separate steps/);
  assert.match(out, /Before editing, summarize the implementation boundary/);
  assert.match(out, /Do not edit anything\. Stop after reporting/);
  assert.match(out, /demo:record|demo\/record\.sh/);
  assert.match(out, /Scenario \(plain English/);
  assert.match(out, /login checker/);
  assert.match(out, /Fake mini app/i);
  assert.match(out, /demo\/SCRIPT\.md/);
  assert.match(out, /Loom/);
});

test('demo/record.sh --help documents Loom setup', () => {
  const result = spawnSync('bash', [join(ROOT, 'demo/record.sh'), '--help'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  const out = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  assert.match(out, /Loom/);
  assert.match(out, /asciinema/);
  assert.match(out, /demo\/SCRIPT\.md/);
});

test('preflight fails clearly when a required executable is missing', () => {
  const nodeDir = dirname(process.execPath);
  const result = spawnSync(
    process.execPath,
    [join(ROOT, 'demo', 'preflight.mjs')],
    {
      cwd: ROOT,
      encoding: 'utf8',
      env: {
        ...process.env,
        // Keep Node on PATH; omit git/claude so those checks fail clearly.
        PATH: nodeDir,
        CLAUDE_RECOVERY_PREFLIGHT_SKIP_TESTS: '1',
      },
    },
  );
  assert.notEqual(result.status, 0);
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  assert.match(output, /FAIL/);
  assert.match(output, /git|claude|not found/i);
});

test('preflight performs no global settings writes', () => {
  const settingsDir = mkdtempSync(join(tmpdir(), 'claude-recovery-settings-probe-'));
  const settingsPath = join(settingsDir, 'settings.json');
  writeFileSync(settingsPath, '{}\n');
  const before = readFileSync(settingsPath, 'utf8');
  try {
    spawnSync('node', [join(ROOT, 'demo', 'preflight.mjs')], {
      cwd: ROOT,
      encoding: 'utf8',
      env: {
        ...process.env,
        CLAUDE_RECOVERY_SETTINGS_PATH: settingsPath,
        CLAUDE_RECOVERY_PREFLIGHT_SKIP_TESTS: '1',
        // Keep PATH so node/git work; claude may still fail.
      },
    });
    assert.equal(readFileSync(settingsPath, 'utf8'), before);
  } finally {
    rmSync(settingsDir, { recursive: true, force: true });
  }
});

test('receipt command works after finalize in a non-auth-service naming way', () => {
  const dest = join(ROOT, '.tmp-test', `receipt-demo-${Date.now()}`);
  try {
    setupFixtureSandbox('config-toggle', dest, {
      withRejectedAttempt: true,
      seedDecision: true,
      seedCommandEvidence: false,
    });
    runRecovery(['capture'], dest);
    runRecovery(['approve', '--decision-file', '.claude/recovery/decision.json'], dest);
    runRecovery(
      ['finalize', '--decision-file', '.claude/recovery/decision.json', '--name', 'cfg-receipt'],
      dest,
    );
    const receipt = spawnSync(
      'node',
      [join(ROOT, 'scripts', 'recovery.mjs'), 'receipt', '--manifest', '.claude/recovery/recovery-manifest.json'],
      { cwd: dest, encoding: 'utf8' },
    );
    assert.equal(receipt.status, 0);
    assert.match(receipt.stdout, /RECOVERY READY/);
    assert.match(receipt.stdout, /tests\/config-smoke\.test\.mjs/);
    assert.doesNotMatch(receipt.stdout, /auth-compat/);
  } finally {
    cleanupScenario(dest);
  }
});
