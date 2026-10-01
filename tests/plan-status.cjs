const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const jwt = require('jsonwebtoken');

process.env.NETLIFY_DATABASE_URL = 'mock';
process.env.JWT_SECRET = 'test-secret-only';

let lastUpdate;
const sql = async (strings, ...values) => {
  const query = strings.join('');
  if (query.includes('SELECT role, is_archived')) {
    return [{ role: 'athlete', is_archived: false, current_period_id: null }];
  }
  if (query.includes('SELECT start_date, paused_at')) {
    return [{ start_date: '2026-09-01T00:00:00.000Z', paused_at: '2026-09-15T00:00:00.000Z' }];
  }
  if (query.includes('UPDATE users SET is_paused = true')) {
    lastUpdate = 'pause';
    return [{ startDate: '2026-09-01T00:00:00.000Z', isPaused: true, pausedAt: values[0] }];
  }
  if (query.includes('UPDATE users SET start_date =')) {
    lastUpdate = 'resume';
    return [{ startDate: values[0], isPaused: false, pausedAt: null }];
  }
  throw new Error(`Unexpected query: ${query}`);
};

const originalLoad = Module._load;
Module._load = function (name, ...args) {
  if (name === '@neondatabase/serverless') return { neon: () => sql };
  return originalLoad.call(this, name, ...args);
};
const { handler } = require('../netlify/functions/data');
Module._load = originalLoad;

const updateStatus = async (action) => handler({
  httpMethod: 'POST',
  headers: { authorization: `Bearer ${jwt.sign({ userId: 1, role: 'coach' }, process.env.JWT_SECRET)}` },
  body: JSON.stringify({ userId: 5, type: 'plan_update', data: { action } })
});

test('pause returns the stored plan status', async () => {
  const response = await updateStatus('pause');
  assert.equal(response.statusCode, 200);
  assert.equal(lastUpdate, 'pause');
  const body = JSON.parse(response.body);
  assert.equal(body.isPaused, true);
  assert.ok(body.pausedAt);
  assert.equal(body.startDate, '2026-09-01T00:00:00.000Z');
});

test('resume returns the shifted start date from the database', async () => {
  const response = await updateStatus('resume');
  assert.equal(response.statusCode, 200);
  assert.equal(lastUpdate, 'resume');
  const body = JSON.parse(response.body);
  assert.equal(body.isPaused, false);
  assert.equal(body.pausedAt, null);
  assert.notEqual(body.startDate, '2026-09-01T00:00:00.000Z');
});
