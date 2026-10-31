const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

process.env.NETLIFY_DATABASE_URL = 'mock';
const queries = [];
const originalLoad = Module._load;
Module._load = function (name, ...args) {
  if (name === '@neondatabase/serverless') return { neon: () => async (strings, ...values) => {
    queries.push({ query: strings.join(''), values });
    return [];
  } };
  return originalLoad.call(this, name, ...args);
};
const { handler } = require('../netlify/functions/forms');
Module._load = originalLoad;

const post = (fields) => handler({
  httpMethod: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(fields).toString()
});

test('forms stores a coaching application with only known fields', async () => {
  queries.length = 0;
  const result = await post({
    'form-name': 'coaching-application',
    name: 'Ada', email: 'ada@example.com', goal: 'Sterkere', injected: 'nope', 'bot-field': ''
  });
  assert.equal(result.statusCode, 200);
  assert.equal(queries.length, 1);
  assert.match(queries[0].query, /INSERT INTO form_submissions/);
  assert.equal(queries[0].values[0], 'coaching-application');
  assert.deepEqual(JSON.parse(queries[0].values[1]), { name: 'Ada', email: 'ada@example.com', goal: 'Sterkere' });
});

test('forms stores kundeoppstart with photo URLs', async () => {
  queries.length = 0;
  const result = await post({
    'form-name': 'kundeoppstart', name: 'Ada', email: 'ada@example.com',
    'front-photo-url': 'https://res.cloudinary.com/x/front.jpg', consent: 'Ja'
  });
  assert.equal(result.statusCode, 200);
  const data = JSON.parse(queries[0].values[1]);
  assert.equal(data['front-photo-url'], 'https://res.cloudinary.com/x/front.jpg');
  assert.equal(data.consent, 'Ja');
});

test('forms answers bots with success but stores nothing', async () => {
  queries.length = 0;
  const result = await post({ 'form-name': 'coaching-application', name: 'Bot', email: 'b@x.no', 'bot-field': 'spam' });
  assert.equal(result.statusCode, 200);
  assert.equal(queries.length, 0);
});

test('forms rejects unknown forms, missing fields and other methods', async () => {
  queries.length = 0;
  assert.equal((await post({ 'form-name': 'other', name: 'A', email: 'a@x.no' })).statusCode, 404);
  assert.equal((await post({ 'form-name': 'coaching-application', name: 'A' })).statusCode, 400);
  assert.equal((await handler({ httpMethod: 'GET', headers: {} })).statusCode, 405);
  assert.equal(queries.length, 0);
});
