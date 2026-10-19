const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

process.env.NETLIFY_DATABASE_URL = 'mock';
process.env.JWT_SECRET = 'test-secret-only';
const passwordHash = bcrypt.hashSync('correct-password', 4);
let queries = [];
let role = 'athlete';
let exists = true;
let completionAllowed = false;
let inventoryTarget = null;
const originalLoad = Module._load;
Module._load = function (name, ...args) {
  if (name === '@neondatabase/serverless') return { neon: () => async (strings, ...values) => {
    const query = strings.join('');
    queries.push({ query, values });
    if (query.includes('SELECT id, role, password')) return exists ? [{ id: 42, role, password: passwordHash }] : [];
    if (query.includes('SELECT user_id FROM account_deletion_requests')) return inventoryTarget ? [{ user_id: inventoryTarget }] : [];
    if (query.includes('FROM checkins')) return [{ image_url: 'https://res.cloudinary.com/demo/image/upload/v1/legacy.jpg', images: JSON.stringify(['https://res.cloudinary.com/demo/image/upload/v1/report.jpg']) }];
    if (query.includes('FROM gallery_images')) return [{ image_url: 'https://res.cloudinary.com/demo/image/upload/v1/legacy.jpg' }];
    if (query.includes('INSERT INTO account_deletion_requests')) return [{ id: 7, requestedAt: '2026-10-19T12:00:00Z', dueAt: '2026-11-18T12:00:00Z' }];
    if (query.includes('UPDATE account_deletion_requests')) return completionAllowed ? [{ id: 7 }] : [];
    return [];
  } };
  return originalLoad.call(this, name, ...args);
};
const { handler } = require('../netlify/functions/account-deletion');
Module._load = originalLoad;
const event = (method, body, tokenRole = role) => ({
  httpMethod: method,
  headers: { Authorization: `Bearer ${jwt.sign({ userId: 42, role: tokenRole }, process.env.JWT_SECRET)}` },
  ...(body === undefined ? {} : { body: JSON.stringify(body) })
});
const reset = () => { queries = []; role = 'athlete'; exists = true; completionAllowed = false; inventoryTarget = null; };

test('a deletion request belongs to the authenticated user, ignoring injected target IDs', async () => {
  reset();
  const response = await handler(event('POST', { userId: 999, password: 'correct-password', contactEmail: ' person@example.com ' }));
  assert.equal(response.statusCode, 200);
  const insert = queries.find(q => q.query.includes('INSERT'));
  assert.deepEqual(insert.values, [42, 'person@example.com']);
  assert.match(insert.query, /ON CONFLICT \(user_id\) DO UPDATE SET contact_email/);
  assert.doesNotMatch(insert.query, /SET requested_at/);
  assert.equal(response.headers['Cache-Control'], 'no-store');
});

test('missing/incorrect passwords and invalid emails do not create deletion requests', async () => {
  for (const [body, status] of [
    [{ password: '' }, 400],
    [{ password: 'wrong-password' }, 403],
    [{ password: 'correct-password', contactEmail: 'invalid' }, 400]
  ]) {
    reset();
    assert.equal((await handler(event('POST', body))).statusCode, status);
    assert.ok(!queries.some(q => q.query.includes('INSERT')));
  }
});

test('deleted accounts and tokens with a stale role cannot make requests', async () => {
  reset(); exists = false;
  assert.equal((await handler(event('POST', { password: 'correct-password' }))).statusCode, 401);
  reset();
  assert.equal((await handler(event('POST', { password: 'correct-password' }, 'coach'))).statusCode, 401);
  assert.ok(!queries.some(q => q.query.includes('INSERT')));
});

test('athletes cannot enumerate or complete other users deletion requests', async () => {
  reset();
  const read = event('GET'); read.queryStringParameters = { scope: 'pending' };
  assert.equal((await handler(read)).statusCode, 403);
  assert.equal((await handler(event('PATCH', { id: 7, imagesRemoved: true, confirmationSent: true }))).statusCode, 403);
  assert.ok(!queries.some(q => q.query.includes('LEFT JOIN') || q.query.includes('UPDATE')));
});

test('coaches cannot complete a request until the account is deleted and cleanup is confirmed', async () => {
  reset(); role = 'coach';
  assert.equal((await handler(event('PATCH', { id: 7 }))).statusCode, 400);
  assert.equal((await handler(event('PATCH', { id: 7, imagesRemoved: true, confirmationSent: true }))).statusCode, 409);
  completionAllowed = true;
  assert.equal((await handler(event('PATCH', { id: 7, imagesRemoved: true, confirmationSent: true }))).statusCode, 200);
  const query = queries.find(q => q.query.includes('UPDATE'));
  assert.match(query.query, /user_id IS NULL AND completed_at IS NULL/);
  assert.match(query.query, /contact_email = NULL/);
});

test('unauthenticated requests and malformed JSON do not write requests', async () => {
  reset();
  assert.equal((await handler({ httpMethod: 'POST', headers: {}, body: '{}' })).statusCode, 401);
  const malformed = event('POST'); malformed.body = '{';
  assert.equal((await handler(malformed)).statusCode, 400);
  assert.ok(!queries.some(q => q.query.includes('INSERT')));
});

test('image inventory is restricted to coaches and a pending request', async () => {
  reset();
  const request = event('GET'); request.queryStringParameters = { scope: 'assets', requestId: '7' };
  assert.equal((await handler(request)).statusCode, 403);
  reset(); role = 'coach';
  const coachRequest = event('GET'); coachRequest.queryStringParameters = { scope: 'assets', requestId: '../7' };
  assert.equal((await handler(coachRequest)).statusCode, 400);
  coachRequest.queryStringParameters.requestId = '7';
  assert.equal((await handler(coachRequest)).statusCode, 409);
  assert.ok(!queries.some(q => q.query.includes('FROM checkins') || q.query.includes('FROM gallery_images')));
});


test('image inventory includes all reports and legacy image fields, with unique URLs', async () => {
  reset(); role = 'coach'; inventoryTarget = 99;
  const request = event('GET'); request.queryStringParameters = { scope: 'assets', requestId: '7', userId: '1000' };
  const response = await handler(request);
  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.folder, 'jnm_coaching/users/99');
  assert.equal(body.urls.length, 2);
  const query = queries.find(q => q.query.includes('FROM checkins'));
  assert.deepEqual(query.values, [99]);
  assert.doesNotMatch(query.query, /LIMIT/);
});
