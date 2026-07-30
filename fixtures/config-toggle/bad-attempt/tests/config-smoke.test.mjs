import test from 'node:test';
import assert from 'node:assert/strict';
import { getConfig } from '../src/config.mjs';

test('getConfig remains the exported API', () => {
  assert.equal(typeof getConfig, 'function');
  assert.equal(getConfig('enabled', { enabled: false }), false);
});
