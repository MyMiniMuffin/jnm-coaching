const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

process.env.NETLIFY_DATABASE_URL = 'mock';
process.env.JWT_SECRET = 'test-secret-only';
let user;
let loseRace = false;
const originalLoad = Module._load;
Module._load = function (name, ...args) {
  if (name === '@neondatabase/serverless') return { neon: () => async (strings, ...values) => {
    if (strings.join('').includes('SELECT')) return [{ ...user }];
    if (loseRace) return [];
    user.password = values[0];
    user.must_change_password = false;
    return [{ id: user.id }];
  } };
  return originalLoad.call(this, name, ...args);
};
const { handler } = require('../netlify/functions/auth');
Module._load = originalLoad;
const login = async (password, newPassword) => {
  const result = await handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ username: 'athlete', password, newPassword }) });
  return { status: result.statusCode, data: JSON.parse(result.body) };
};

test('first login requires password change before issuing a session', async () => {
  user = { id: 1, username: 'athlete', role: 'athlete', password: await bcrypt.hash('temporary', 4), must_change_password: true };
  assert.equal((await login('wrong')).status, 401);
  const initial = await login('temporary');
  assert.deepEqual(initial.data, { mustChangePassword: true });
  assert.equal((await login('temporary', 'short')).status, 400);
  assert.equal((await login('temporary', 'temporary')).status, 400);
  assert.equal((await login('temporary', 'ø'.repeat(37))).status, 400);
  loseRace = true;
  assert.equal((await login('temporary', 'my-new-password')).status, 401);
  loseRace = false;
  const changed = await login('temporary', 'my-new-password');
  assert.equal(changed.status, 200);
  assert.equal(jwt.verify(changed.data.token, process.env.JWT_SECRET).userId, 1);
  assert.equal(user.must_change_password, false);
  assert.equal(await bcrypt.compare('my-new-password', user.password), true);
  assert.equal((await login('temporary')).status, 401);
  assert.ok((await login('my-new-password')).data.token);
});
