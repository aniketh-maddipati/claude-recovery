import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { setupDemoFixture, demoFixturePath } from '../demo/setup-fixture.mjs';
import { setupLiveFixture } from '../demo/setup-live.mjs';
import { listDemoScenarios } from '../demo/scenarios.mjs';
import { ROOT } from './harness/scenario-e2e.mjs';
import { runRecovery } from './helpers.mjs';

for (const scenarioName of listDemoScenarios()) {
  test(`demo fixture sets up ${scenarioName} with seeded evidence`, () => {
    const result = setupDemoFixture({ scenario: scenarioName, reset: true });
    const fixture = demoFixturePath(scenarioName);

    assert.equal(result.ok, true);
    assert.equal(result.fixture, fixture);
    assert.ok(existsSync(join(fixture, '.git')));
    assert.ok(existsSync(join(fixture, '.claude/recovery/original-outcome.json')));
    assert.ok(existsSync(join(fixture, '.claude/recovery/commands.jsonl')));
    assert.ok(existsSync(join(fixture, '.claude/recovery/evidence.json')));
    assert.ok(existsSync(join(fixture, '.claude/recovery/decision.json')));

    const commands = readFileSync(join(fixture, '.claude/recovery/commands.jsonl'), 'utf8')
      .trim()
      .split('\n');
    assert.equal(commands.length, 2);
    const records = commands.map((line) => JSON.parse(line));
    assert.match(records[1].stdout, /fail 1/);

    const inspect = runRecovery(['inspect'], fixture);
    assert.equal(inspect.view.verification.status, 'failing');
    assert.match(result.launchCommand, /claude --plugin-dir/);
  });
}

test('live demo fixture starts clean without bad attempt', () => {
  const result = setupLiveFixture({ scenario: 'config-toggle', reset: true });
  assert.equal(result.mode, 'live');
  assert.ok(existsSync(join(result.fixture, 'src/config.mjs')));
  const content = readFileSync(join(result.fixture, 'src/config.mjs'), 'utf8');
  assert.match(content, /getConfig/);
  assert.doesNotMatch(content, /loadSettings/);
});

test('PROMPTS.md documents all demo scenarios', () => {
  const prompts = readFileSync(join(ROOT, 'demo/PROMPTS.md'), 'utf8');
  for (const name of listDemoScenarios()) {
    assert.match(prompts, new RegExp(name));
  }
});
