const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const jwt = require('jsonwebtoken');

process.env.NETLIFY_DATABASE_URL = 'mock';
process.env.JWT_SECRET = 'test-secret-only';
const queries = [];
const originalLoad = Module._load;
Module._load = function (name, ...args) {
  if (name === '@neondatabase/serverless') return { neon: () => async (strings, ...values) => {
    queries.push({ query: strings.join(''), values });
    return [];
  } };
  return originalLoad.call(this, name, ...args);
};
const { handler } = require('../netlify/functions/activity');
Module._load = originalLoad;

test('activity only updates the authenticated user using server time', async () => {
  const token = jwt.sign({ userId: 42, role: 'athlete' }, process.env.JWT_SECRET);
  const result = await handler({
    httpMethod: 'POST', headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ userId: 99, lastActiveAt: '2099-01-01' })
  });
  assert.equal(result.statusCode, 204);
  assert.deepEqual(queries[0].values, [42]);
  assert.match(queries[0].query, /SET last_active_at = NOW\(\)/);
  assert.match(queries[0].query, /INTERVAL '1 minute'/);
});

test('missing authentication and wrong method do not write activity', async () => {
  const before = queries.length;
  assert.equal((await handler({ httpMethod: 'POST', headers: {} })).statusCode, 401);
  assert.equal((await handler({ httpMethod: 'GET', headers: {} })).statusCode, 405);
  assert.equal(queries.length, before);
});
