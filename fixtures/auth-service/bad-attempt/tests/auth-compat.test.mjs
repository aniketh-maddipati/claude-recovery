import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthProvider } from '../src/auth/provider.mjs';

test('AuthProvider preserves authenticate(token) interface for clients', () => {
  const provider = new AuthProvider('secret');
  assert.equal(typeof provider.authenticate, 'function');
  const valid = provider.authenticate('valid-token');
  assert.equal(valid.ok, true);
});
