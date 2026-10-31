const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const jwt = require('jsonwebtoken');

process.env.NETLIFY_DATABASE_URL = 'mock';
process.env.JWT_SECRET = 'test-secret-only';
process.env.CLOUDINARY_CLOUD_NAME = 'demo';
process.env.CLOUDINARY_API_KEY = 'key';
process.env.CLOUDINARY_API_SECRET = 'secret';
const queries = [];
const destroyed = [];
let destroyResult = 'ok';
let dbRole = 'coach';
const photo = (path) => `https://res.cloudinary.com/demo/image/authenticated/s--Sig_1--/v1730000000/${path}.jpg`;
const STORED = {
  10: { id: '10', handled_at: null, data: { name: 'Ny' } },
  11: { id: '11', handled_at: '2026-10-31', data: { name: 'Ada', 'front-photo-url': photo('jnm_coaching/onboarding/front1'), 'back-photo-url': photo('jnm_coaching/onboarding/back1') } },
  12: { id: '12', handled_at: '2026-10-31', data: { name: 'Bo', 'front-photo-url': photo('jnm_coaching/users/9/private'), 'side-photo-url': 'https://evil.example/x.jpg' } }
};
const originalLoad = Module._load;
Module._load = function (name, ...args) {
  if (name === '@neondatabase/serverless') return { neon: () => async (strings, ...values) => {
    const query = strings.join('');
    queries.push({ query, values });
    if (query.includes('FROM users')) return [{ id: values[0], role: dbRole }];
    if (query.includes('SELECT id, data, handled_at')) return STORED[values[0]] ? [STORED[values[0]]] : [];
    if (query.includes('DELETE FROM form_submissions')) return [{ id: String(values[0]) }];
    if (query.includes('SELECT id, form_name')) return [{ id: '1', formName: 'kundeoppstart', data: { name: 'Ada' } }];
    if (query.includes('UPDATE form_submissions')) return values[0] === 404 ? [] : [{ id: values[0], handledAt: query.includes('NULL WHERE') ? null : '2026-10-31T12:00:00Z' }];
    return [];
  } };
  if (name === 'cloudinary') return { v2: { config() {}, uploader: { destroy: async (publicId, options) => {
    destroyed.push({ publicId, options });
    return { result: destroyResult };
  } } } };
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
  assert.equal((await handler({ httpMethod: 'PUT', headers: auth() })).statusCode, 405);
});

const del = (id) => handler({ httpMethod: 'DELETE', headers: auth(), body: JSON.stringify({ id }) });

test('new submissions cannot be deleted before they are handled', async () => {
  dbRole = 'coach'; queries.length = 0; destroyed.length = 0;
  assert.equal((await del(10)).statusCode, 409);
  assert.equal((await del(999)).statusCode, 404);
  assert.equal((await del('11')).statusCode, 400);
  assert.equal(destroyed.length, 0);
  assert.ok(!queries.some((q) => q.query.includes('DELETE FROM')));
});

test('deleting a handled onboarding removes its Cloudinary photos first', async () => {
  dbRole = 'coach'; queries.length = 0; destroyed.length = 0; destroyResult = 'ok';
  const result = await del(11);
  assert.equal(result.statusCode, 200);
  assert.deepEqual(JSON.parse(result.body), { id: '11', photosDeleted: 2 });
  assert.deepEqual(destroyed.map((d) => d.publicId), ['jnm_coaching/onboarding/front1', 'jnm_coaching/onboarding/back1']);
  assert.equal(destroyed[0].options.type, 'authenticated');
  assert.match(queries.at(-1).query, /DELETE FROM form_submissions WHERE id = .* AND handled_at IS NOT NULL/s);
});

test('photos outside the onboarding folder are never destroyed', async () => {
  dbRole = 'coach'; destroyed.length = 0; destroyResult = 'ok';
  assert.equal((await del(12)).statusCode, 200);
  assert.equal(destroyed.length, 0);
});

test('keeps the submission when Cloudinary fails to delete a photo', async () => {
  dbRole = 'coach'; queries.length = 0; destroyed.length = 0; destroyResult = 'error';
  assert.equal((await del(11)).statusCode, 502);
  assert.ok(!queries.some((q) => q.query.includes('DELETE FROM')));
  destroyResult = 'not found'; // already gone in Cloudinary is fine
  assert.equal((await del(11)).statusCode, 200);
});

test('athletes cannot delete submissions', async () => {
  dbRole = 'athlete'; destroyed.length = 0;
  const result = await handler({ httpMethod: 'DELETE', headers: auth('athlete'), body: JSON.stringify({ id: 11 }) });
  assert.equal(result.statusCode, 403);
  assert.equal(destroyed.length, 0);
});
