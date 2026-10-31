const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const jwt = require('jsonwebtoken');

process.env.NETLIFY_DATABASE_URL = 'mock';
process.env.JWT_SECRET = 'test-secret-only';
const queries = [];
let dbRole = 'coach';
const originalLoad = Module._load;
Module._load = function (name, ...args) {
  if (name === '@neondatabase/serverless') return { neon: () => async (strings, ...values) => {
    const query = strings.join('');
    queries.push({ query, values });
    if (query.includes('FROM users')) return [{ id: values[0], role: dbRole }];
    if (query.includes('SELECT id, form_name')) return [{ id: '1', formName: 'kundeoppstart', data: { name: 'Ada' } }];
    if (query.includes('UPDATE form_submissions')) return values[0] === 404 ? [] : [{ id: values[0], handledAt: query.includes('NULL WHERE') ? null : '2026-10-31T12:00:00Z' }];
    return [];
  } };
  return originalLoad.call(this, name, ...args);
};
const { handler } = require('../netlify/functions/form-submissions');
Module._load = originalLoad;

const auth = (role = 'coach', userId = 1) => ({ Authorization: `Bearer ${jwt.sign({ userId, role }, process.env.JWT_SECRET)}` });

test('coach lists form submissions newest first, never cached', async () => {
  dbRole = 'coach'; queries.length = 0;
  const result = await handler({ httpMethod: 'GET', headers: auth() });
  assert.equal(result.statusCode, 200);
  assert.equal(result.headers['Cache-Control'], 'no-store');
  assert.equal(JSON.parse(result.body)[0].data.name, 'Ada');
  assert.match(queries[1].query, /ORDER BY created_at DESC/);
});

test('athletes and stale coach tokens cannot read submissions', async () => {
  dbRole = 'athlete';
  assert.equal((await handler({ httpMethod: 'GET', headers: auth('athlete') })).statusCode, 403);
  // Token says coach, database says athlete (role changed): log in again.
  assert.equal((await handler({ httpMethod: 'GET', headers: auth('coach') })).statusCode, 401);
  assert.equal((await handler({ httpMethod: 'GET', headers: {} })).statusCode, 401);
});

test('coach marks a submission handled and open again', async () => {
  dbRole = 'coach'; queries.length = 0;
  const done = await handler({ httpMethod: 'PATCH', headers: auth(), body: JSON.stringify({ id: 5, handled: true }) });
  assert.equal(done.statusCode, 200);
  assert.match(queries[1].query, /COALESCE\(handled_at, NOW\(\)\)/);
  const reopened = await handler({ httpMethod: 'PATCH', headers: auth(), body: JSON.stringify({ id: 5, handled: false }) });
  assert.equal(JSON.parse(reopened.body).handledAt, null);
});

test('PATCH validates input and reports unknown submissions', async () => {
  dbRole = 'coach';
  for (const body of [{ id: '5', handled: true }, { id: 0, handled: true }, { id: 5, handled: 'yes' }]) {
    assert.equal((await handler({ httpMethod: 'PATCH', headers: auth(), body: JSON.stringify(body) })).statusCode, 400);
  }
  assert.equal((await handler({ httpMethod: 'PATCH', headers: auth(), body: JSON.stringify({ id: 404, handled: true }) })).statusCode, 404);
  assert.equal((await handler({ httpMethod: 'DELETE', headers: auth() })).statusCode, 405);
});
