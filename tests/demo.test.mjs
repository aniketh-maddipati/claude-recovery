import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { setupDemoFixture, DEMO_FIXTURE } from '../demo/setup-fixture.mjs';
import { runRecovery } from './helpers.mjs';

test('demo fixture sets up auth-service sandbox with seeded evidence', () => {
  const result = setupDemoFixture({ reset: true });
  assert.equal(result.ok, true);
  assert.equal(result.fixture, DEMO_FIXTURE);
  assert.ok(existsSync(join(DEMO_FIXTURE, '.git')));
  assert.ok(existsSync(join(DEMO_FIXTURE, '.claude/recovery/original-outcome.json')));
  assert.ok(existsSync(join(DEMO_FIXTURE, '.claude/recovery/commands.jsonl')));
  assert.ok(existsSync(join(DEMO_FIXTURE, '.claude/recovery/evidence.json')));
  assert.ok(existsSync(join(DEMO_FIXTURE, '.claude/recovery/decision.json')));

  const commands = readFileSync(join(DEMO_FIXTURE, '.claude/recovery/commands.jsonl'), 'utf8')
    .trim()
    .split('\n');
  assert.equal(commands.length, 2);
  const tail = commands.map((line) => JSON.parse(line));
  assert.match(tail[0].stdout, /invalid or expired token/);
  assert.match(tail[1].stdout, /fail 1/);
  assert.match(tail[1].command, /node --test tests\/auth-compat\.test\.mjs/);

  const diff = readFileSync(join(DEMO_FIXTURE, 'src/auth/provider.mjs'), 'utf8');
  assert.match(diff, /verifyRequest/);

  const inspect = runRecovery(['inspect'], DEMO_FIXTURE);
  assert.equal(inspect.view.verification.status, 'failing');

  assert.match(result.launchCommand, /claude --plugin-dir/);
  assert.match(result.launchCommand, new RegExp(DEMO_FIXTURE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
