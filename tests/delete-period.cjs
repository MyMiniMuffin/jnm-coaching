const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const jwt = require('jsonwebtoken');

process.env.NETLIFY_DATABASE_URL = 'mock';
process.env.JWT_SECRET = 'test-secret-only';

let ownedPeriod = true;
let archived = false;
let transactionQueries = null;
const sql = (strings, ...values) => {
  const text = strings.join('');
  return {
    text,
    values,
    then(resolve, reject) {
      let rows = [];
      if (text.includes('SELECT role, is_archived')) {
        rows = [{ role: 'athlete', is_archived: archived, current_period_id: 17 }];
      } else if (text.includes('SELECT id FROM coaching_periods')) {
        rows = ownedPeriod ? [{ id: 17 }] : [];
      }
      return Promise.resolve(rows).then(resolve, reject);
    }
  };
};
sql.transaction = async (queries) => {
  transactionQueries = queries;
  return [[], [], []];
};

const originalLoad = Module._load;
Module._load = function (name, ...args) {
  if (name === '@neondatabase/serverless') return { neon: () => sql };
  return originalLoad.call(this, name, ...args);
};
const { handler } = require('../netlify/functions/data');
Module._load = originalLoad;

const removePeriod = async (role, userId = 5, periodId = 17) => handler({
  httpMethod: 'POST',
  headers: { authorization: `Bearer ${jwt.sign({ userId: role === 'coach' ? 1 : userId, role }, process.env.JWT_SECRET)}` },
  body: JSON.stringify({ userId, type: 'delete_period', data: { periodId } })
});

test('coach deletes a client round while retaining linked reports', async () => {
  transactionQueries = null;
  const response = await removePeriod('coach');
  assert.equal(response.statusCode, 200);
  assert.equal(transactionQueries.length, 3);
  assert.match(transactionQueries[0].text, /UPDATE users SET current_period_id = NULL, starting_weight = NULL/);
  assert.match(transactionQueries[1].text, /UPDATE checkins SET period_id = NULL/);
  assert.match(transactionQueries[2].text, /DELETE FROM coaching_periods/);
  for (const query of transactionQueries) assert.ok(query.values.includes(17));
});

test('athletes cannot delete rounds', async () => {
  transactionQueries = null;
  assert.equal((await removePeriod('athlete')).statusCode, 403);
  assert.equal(transactionQueries, null);
});

test('round must belong to the selected client', async () => {
  ownedPeriod = false;
  transactionQueries = null;
  assert.equal((await removePeriod('coach')).statusCode, 404);
  assert.equal(transactionQueries, null);
  ownedPeriod = true;
});

test('archived client rounds cannot be deleted', async () => {
  archived = true;
  transactionQueries = null;
  assert.equal((await removePeriod('coach')).statusCode, 403);
  assert.equal(transactionQueries, null);
  archived = false;
});
