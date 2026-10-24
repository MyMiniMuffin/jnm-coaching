const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const jwt = require('jsonwebtoken');

process.env.NETLIFY_DATABASE_URL = 'mock';
process.env.JWT_SECRET = 'test-secret-only';

const queries = [];
let targetRole = 'athlete';
let listCalls = 0;

const sql = (strings, ...values) => {
  const text = strings.join('?');
  queries.push({ text, values });
  return {
    text,
    values,
    then(resolve, reject) {
      let rows = [];
      if (text.includes('SELECT role FROM users')) {
        rows = targetRole ? [{ role: targetRole }] : [];
      } else if (text.includes('FROM users u')) {
        listCalls += 1;
        rows = [
          { id: 5, username: 'athlete1', name: 'Ada', role: 'athlete', is_archived: true, unreadCheckins: 0 }
        ];
      }
      return Promise.resolve(rows).then(resolve, reject);
    }
  };
};

const originalLoad = Module._load;
Module._load = function (name, ...args) {
  if (name === '@neondatabase/serverless') return { neon: () => sql };
  return originalLoad.call(this, name, ...args);
};
const { handler } = require('../netlify/functions/users');
Module._load = originalLoad;

const patchUser = async (body, role = 'coach') => handler({
  httpMethod: 'PATCH',
  headers: { authorization: `Bearer ${jwt.sign({ userId: 1, role }, process.env.JWT_SECRET)}` },
  body: JSON.stringify(body)
});

test('archive-only PATCH returns the change without rebuilding the users list', async () => {
  queries.length = 0;
  listCalls = 0;
  targetRole = 'athlete';

  const response = await patchUser({ id: 5, is_archived: true });
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['Cache-Control'], 'no-store');
  assert.deepEqual(body, { id: 5, is_archived: true });
  assert.equal(listCalls, 0);
  assert.ok(queries.some(query => query.text.includes('UPDATE users SET is_archived')));
});

test('restore-only PATCH returns the change without rebuilding the users list', async () => {
  queries.length = 0;
  listCalls = 0;
  targetRole = 'athlete';

  const response = await patchUser({ id: 5, is_archived: false });
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(body, { id: 5, is_archived: false });
  assert.equal(listCalls, 0);
});

test('password reset still returns the full users list', async () => {
  queries.length = 0;
  listCalls = 0;
  targetRole = 'athlete';

  const response = await patchUser({ id: 5, new_password: 'nyttpass' });
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(listCalls, 1);
  assert.ok(Array.isArray(body));
  assert.equal(body[0].username, 'athlete1');
});

test('cannot archive another coach', async () => {
  queries.length = 0;
  listCalls = 0;
  targetRole = 'coach';

  const response = await patchUser({ id: 2, is_archived: true });
  assert.equal(response.statusCode, 403);
  assert.equal(listCalls, 0);
});
