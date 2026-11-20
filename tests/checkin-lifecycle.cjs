const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const jwt = require('jsonwebtoken');

process.env.NETLIFY_DATABASE_URL = 'mock';
process.env.JWT_SECRET = 'test-secret-only';

const NEVER = new Promise(() => {});
let log;
let state;
const resetState = () => {
  log = [];
  state = {
    userExists: true,
    passwordChangedAt: null,
    pushHangs: false,
    existingByKey: null,
    wasRead: true,
    deletedIsRead: false
  };
};
resetState();

const row = { id: 9, date: '2026-01-05', weight: 80, sleep: 5, energy: 5, accuracy: 5, strengthSessions: 0, cardioSessions: 0, stepsReached: false, takenSupplements: false, comment: '', images: '[]', timestamp: '2026-01-05T08:00:00Z', periodId: null, isRead: false };

const sql = (strings, ...values) => {
  const text = strings.join('?');
  log.push({ text, values });
  let rows = [];
  if (text.includes('FROM push_subscriptions')) return state.pushHangs ? NEVER : Promise.resolve([]);
  if (text.includes('SELECT role, is_archived')) rows = [{ role: 'athlete', is_archived: false, name: 'Ada', current_period_id: null, password_changed_at: state.passwordChangedAt }];
  else if (text.includes('password_changed_at') && text.includes('SELECT')) rows = state.userExists ? [{ password_changed_at: state.passwordChangedAt, is_archived: false }] : [];
  else if (text.includes('INSERT INTO checkins')) rows = state.existingByKey ? [] : [row];
  else if (text.includes('FROM checkins') && text.includes('idempotency_key')) rows = state.existingByKey ? [state.existingByKey] : [];
  else if (text.includes('UPDATE checkins SET\n')) rows = [{ ...row, wasRead: state.wasRead }];
  else if (text.includes('UPDATE checkins SET is_read')) rows = [];
  else if (text.includes('DELETE FROM checkins')) rows = [{ id: 9, is_read: state.deletedIsRead }];
  else if (text.includes('COUNT(*)')) rows = [{ count: 1, total: 3 }];
  else if (text.includes('FROM users')) rows = [{}];
  return Promise.resolve(rows);
};
sql.transaction = async () => [];

const originalLoad = Module._load;
Module._load = function (name, ...args) {
  if (name === '@neondatabase/serverless') return { neon: () => sql };
  return originalLoad.call(this, name, ...args);
};
const { handler } = require('../netlify/functions/data');
const { handler: activity } = require('../netlify/functions/activity');
Module._load = originalLoad;

beforeEach(resetState);

const nowSec = () => Math.floor(Date.now() / 1000);
const token = (role, userId, iat = nowSec()) => jwt.sign({ userId, role, iat }, process.env.JWT_SECRET);
const post = (role, userId, type, data, iat) => handler({
  httpMethod: 'POST',
  headers: { authorization: `Bearer ${token(role, role === 'coach' ? 1 : userId, iat)}` },
  body: JSON.stringify({ userId, type, data })
});
const get = (role, userId, iat) => handler({
  httpMethod: 'GET',
  queryStringParameters: { id: String(userId) },
  headers: { authorization: `Bearer ${token(role, role === 'coach' ? 1 : userId, iat)}` }
});
const validCheckin = { date: '2026-01-05', weight: 80, sleep: 5, energy: 5, accuracy: 5 };
const countTrue = (query) => query.values.filter(v => v === true).length;
const settled = (promise, ms) => Promise.race([promise, new Promise(resolve => setTimeout(() => resolve('timeout'), ms))]);

test('mark_checkins_read only marks reports up to the id the coach saw', async () => {
  const res = await post('coach', 5, 'mark_checkins_read', { upToId: 41 });
  assert.equal(res.statusCode, 200);
  const update = log.find(q => q.text.includes('UPDATE checkins SET is_read = true'));
  assert.match(update.text, /id <=/);
  assert.ok(update.values.includes(41));
});

test('mark_checkins_read accepts upToCreatedAt and stays backwards compatible without a bound', async () => {
  await post('coach', 5, 'mark_checkins_read', { upToCreatedAt: '2026-01-05T08:00:00Z' });
  const bounded = log.find(q => q.text.includes('UPDATE checkins SET is_read = true'));
  assert.match(bounded.text, /created_at </);
  assert.ok(bounded.values.includes('2026-01-05T08:00:00.000Z'));

  log.length = 0;
  const res = await post('coach', 5, 'mark_checkins_read', {});
  assert.equal(res.statusCode, 200);
  const unbounded = log.find(q => q.text.includes('UPDATE checkins SET is_read = true'));
  assert.ok(!unbounded.values.some(v => typeof v === 'string' && v.startsWith('2026')));
});

test('new_checkin responds within the push time bound when push hangs', async () => {
  state.pushHangs = true;
  const outcome = await settled(post('athlete', 5, 'new_checkin', validCheckin), 6000);
  assert.notEqual(outcome, 'timeout');
  assert.equal(outcome.statusCode, 200);
  assert.equal(JSON.parse(outcome.body).checkin.id, 9);
});

test('new_checkin with a repeated idempotency key returns the stored report and sends no push', async () => {
  state.existingByKey = { ...row, id: 77 };
  const res = await post('athlete', 5, 'new_checkin', { ...validCheckin, idempotencyKey: 'draft-key-0001' });
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).checkin.id, 77);
  const insert = log.find(q => q.text.includes('INSERT INTO checkins'));
  assert.match(insert.text, /ON CONFLICT/);
  assert.ok(insert.values.includes('draft-key-0001'));
  assert.ok(!log.some(q => q.text.includes('FROM push_subscriptions')));
});

test('new_checkin rejects a malformed idempotency key', async () => {
  const res = await post('athlete', 5, 'new_checkin', { ...validCheckin, idempotencyKey: 'x' });
  assert.equal(res.statusCode, 400);
});

test('GET /data returns 401 when the token user no longer exists', async () => {
  state.userExists = false;
  const res = await get('athlete', 5);
  assert.equal(res.statusCode, 401);
  assert.match(JSON.parse(res.body).error, /logg inn på nytt/);
});

test('GET /data rejects tokens issued before the last password change and accepts later ones', async () => {
  state.passwordChangedAt = new Date('2026-03-01T12:00:00Z');
  const changed = Math.floor(state.passwordChangedAt.getTime() / 1000);
  assert.equal((await get('athlete', 5, changed - 60)).statusCode, 401);
  assert.equal((await get('athlete', 5, changed)).statusCode, 200);
  assert.equal((await get('athlete', 5, changed + 60)).statusCode, 200);
});

test('GET /data returns all reports without a row limit', async () => {
  await get('athlete', 5);
  const query = log.find(q => q.text.includes('FROM checkins') && q.text.includes('ORDER BY created_at DESC'));
  assert.doesNotMatch(query.text, /LIMIT/);
});

test('POST rejects an athlete token issued before a password change', async () => {
  state.passwordChangedAt = new Date('2026-03-01T12:00:00Z');
  const changed = Math.floor(state.passwordChangedAt.getTime() / 1000);
  const res = await post('athlete', 5, 'update_checkin', { checkinId: 9, comment: 'x' }, changed - 60);
  assert.equal(res.statusCode, 401);
});

test('activity returns 401 when the token user no longer exists', async () => {
  state.userExists = false;
  const res = await activity({ httpMethod: 'POST', headers: { authorization: `Bearer ${token('athlete', 5)}` } });
  assert.equal(res.statusCode, 401);
});

test('update_checkin by the athlete marks the report unread and notifies the coach when it was read', async () => {
  const res = await post('athlete', 5, 'update_checkin', { checkinId: 9, comment: 'rettet' });
  assert.equal(res.statusCode, 200);
  const update = log.find(q => q.text.includes('UPDATE checkins SET\n'));
  assert.match(update.text, /is_read = CASE WHEN/);
  assert.equal(countTrue(update), 2);
  assert.ok(log.some(q => q.text.includes('FROM push_subscriptions')));
});

test('update_checkin by the coach leaves is_read alone and sends no push', async () => {
  const res = await post('coach', 5, 'update_checkin', { checkinId: 9, comment: 'rettet' });
  assert.equal(res.statusCode, 200);
  const update = log.find(q => q.text.includes('UPDATE checkins SET\n'));
  assert.equal(countTrue(update), 1);
  assert.ok(!log.some(q => q.text.includes('FROM push_subscriptions')));
});

test('update_checkin on an already unread report does not push again', async () => {
  state.wasRead = false;
  await post('athlete', 5, 'update_checkin', { checkinId: 9, comment: 'rettet' });
  assert.ok(!log.some(q => q.text.includes('FROM push_subscriptions')));
});

test('delete_checkin of an unread report syncs the coach badge', async () => {
  state.deletedIsRead = false;
  const res = await post('athlete', 5, 'delete_checkin', { checkinId: 9 });
  assert.equal(res.statusCode, 200);
  assert.ok(log.some(q => q.text.includes('FROM push_subscriptions')));
});

test('delete_checkin of a read report does not sync the badge', async () => {
  state.deletedIsRead = true;
  await post('athlete', 5, 'delete_checkin', { checkinId: 9 });
  assert.ok(!log.some(q => q.text.includes('FROM push_subscriptions')));
});
