import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { setupDemoFixture, demoFixturePath, stripDemoSessionArtifacts, assertHonestDemoFixture } from '../demo/setup-fixture.mjs';
import { setupLiveFixture } from '../demo/setup-live.mjs';
import { listDemoScenarios } from '../demo/scenarios.mjs';
import { ROOT, setupFixtureSandbox, cleanupScenario } from './harness/scenario-e2e.mjs';
import { runRecovery } from './helpers.mjs';
import { buildPluginZip } from '../scripts/build-plugin-zip.mjs';
import { buildSkillZip, skillMarkdownForUpload, skillMarkdownForCli, installSkillToCli, diagnoseSkillInstall } from '../scripts/build-skill-zip.mjs';

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

test('skill install copies recover skill to cli skills dir', () => {
  const target = join(ROOT, '.tmp-test', `skill-install-${Date.now()}`);
  mkdirSync(target, { recursive: true });
  try {
    const installed = installSkillToCli({ targetDir: target, quiet: true });
    assert.ok(existsSync(join(installed.path, 'SKILL.md')));
    assert.ok(existsSync(join(installed.path, 'scripts', 'recovery.mjs')));
    const md = readFileSync(join(installed.path, 'SKILL.md'), 'utf8');
    assert.match(md, /\$\{CLAUDE_SKILL_DIR\}\/scripts\//);
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
});

test('skill upload zip has recover/SKILL.md at folder root', () => {
  const result = buildSkillZip({ quiet: true });
  assert.match(result.path, /Downloads/);
  const listing = spawnSync('unzip', ['-l', result.path], { encoding: 'utf8' });
  assert.equal(listing.status, 0, listing.stderr);
  assert.match(listing.stdout, /recover\/SKILL\.md/);
  assert.doesNotMatch(listing.stdout, /skills\/recover\/SKILL\.md/);
  const md = skillMarkdownForUpload();
  assert.match(md, /scripts\/recovery\.mjs capture/);
  assert.doesNotMatch(md, /\$\{CLAUDE_PLUGIN_ROOT\}/);
});

test('CLI skill markdown uses CLAUDE_SKILL_DIR', () => {
  const md = skillMarkdownForCli();
  assert.match(md, /\$\{CLAUDE_SKILL_DIR\}\/scripts\/recovery\.mjs capture/);
});

test('plugin zip contains recover skill and lands in Downloads', () => {
  const result = buildPluginZip({ quiet: true });
  assert.match(result.path, /Downloads/);
  const listing = spawnSync('unzip', ['-l', result.path], { encoding: 'utf8' });
  assert.equal(listing.status, 0, listing.stderr);
  const out = listing.stdout;
  assert.match(out, /\.claude-plugin\/plugin\.json/);
  assert.match(out, /skills\/recover\/SKILL\.md/);
  assert.match(out, /commands\/recover\.md/);
  assert.match(out, /scripts\/recovery\.mjs/);
});

test('demo-cmd prints fixture path', () => {
  const result = spawnSync('node', [join(ROOT, 'demo/demo-cmd.mjs'), 'fixture'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\.demo\/auth-service/);
});

test('recover is available as skill and command', () => {
  const skill = readFileSync(join(ROOT, 'skills', 'recover', 'SKILL.md'), 'utf8');
  const command = readFileSync(join(ROOT, 'commands', 'recover.md'), 'utf8');
  assert.match(skill, /recovery\.mjs capture/);
  assert.match(command, /skills\/recover\/SKILL\.md/);
});

test('PROMPTS.md is the teleprompter with say, paste, and see cues', () => {
  const prompts = readFileSync(join(ROOT, 'demo/PROMPTS.md'), 'utf8');
  const recording = readFileSync(join(ROOT, 'demo/RECORDING.md'), 'utf8');
  const script = readFileSync(join(ROOT, 'demo/SCRIPT.md'), 'utf8');
  assert.match(prompts, /Demo teleprompter/);
  assert.match(prompts, /Commands \(copy or type\)/);
  assert.match(prompts, /\*\*SAY:\*\*/);
  assert.match(prompts, /Run compat test and git diff --stat/);
  assert.match(prompts, /claude --plugin-dir/);
  assert.match(prompts, /demo-cmd\.mjs worktree/);
  assert.match(prompts, /\/claude-recovery:recover/);
  assert.match(prompts, /Reject AuthProvider and ApiClient migration/);
  assert.match(prompts, /Approve and finalize separately/i);
  assert.match(prompts, /Summarize boundary and verification before editing/);
  assert.match(recording, /demo\/PROMPTS\.md/);
  assert.match(script, /demo\/PROMPTS\.md/);
});

test('npm run demo prints short type prompts', () => {
  const result = spawnSync('npm', ['run', 'demo'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  const out = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  assert.match(out, /Run compat test and git diff --stat/);
  assert.match(out, /\/claude-recovery:recover/);
  assert.match(out, /demo-cmd\.mjs worktree/);
  assert.match(out, /CLAUDE_RECOVERY_PLUGIN_DIR/);
});

test('demo/record.sh --help points at PROMPTS.md', () => {
  const result = spawnSync('bash', [join(ROOT, 'demo/record.sh'), '--help'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  const out = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  assert.match(out, /demo\/PROMPTS\.md/);
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
