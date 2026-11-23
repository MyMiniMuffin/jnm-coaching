const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const jwt = require('jsonwebtoken');

process.env.NETLIFY_DATABASE_URL = 'mock';
process.env.JWT_SECRET = 'test-secret-only';

let insertQuery = null;
const sql = (strings, ...values) => {
  const text = strings.join('');
  return {
    text,
    values,
    then(resolve, reject) {
      let rows = [];
      if (text.includes('SELECT role, is_archived')) {
        rows = [{ role: 'athlete', is_archived: false, name: 'Test Athlete', current_period_id: null, password_changed_at: null }];
      } else if (text.includes('INSERT INTO gallery_images')) {
        insertQuery = { text, values };
        rows = [{ id: 42 }];
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
const { handler } = require('../netlify/functions/data');
Module._load = originalLoad;

const addGalleryImage = async (label, includeLabel = true) => {
  insertQuery = null;
  const data = {
    imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/progress.jpg',
    date: '2026-10-01',
    weight: 78.5
  };
  if (includeLabel) data.label = label;
  return handler({
    httpMethod: 'POST',
    headers: { authorization: `Bearer ${jwt.sign({ userId: 1, role: 'coach' }, process.env.JWT_SECRET)}` },
    body: JSON.stringify({ userId: 5, type: 'add_gallery_image', data })
  });
};

test('empty label inserts empty string instead of Startbilde', async () => {
  const response = await addGalleryImage('');
  assert.equal(response.statusCode, 200);
  assert.ok(insertQuery);
  assert.equal(insertQuery.values[2], '');
});

test('whitespace-only label inserts empty string', async () => {
  const response = await addGalleryImage('   ');
  assert.equal(response.statusCode, 200);
  assert.ok(insertQuery);
  assert.equal(insertQuery.values[2], '');
});

test('omitted label inserts empty string', async () => {
  const response = await addGalleryImage(undefined, false);
  assert.equal(response.statusCode, 200);
  assert.ok(insertQuery);
  assert.equal(insertQuery.values[2], '');
});

test('custom label is trimmed before insert', async () => {
  const response = await addGalleryImage('  Uke 4 forfra  ');
  assert.equal(response.statusCode, 200);
  assert.ok(insertQuery);
  assert.equal(insertQuery.values[2], 'Uke 4 forfra');
});

test('over-200-char label is trimmed and capped at 200 characters', async () => {
  const longLabel = `  ${'a'.repeat(210)}  `;
  const response = await addGalleryImage(longLabel);
  assert.equal(response.statusCode, 200);
  assert.ok(insertQuery);
  assert.equal(insertQuery.values[2], 'a'.repeat(200));
  assert.equal(insertQuery.values[2].length, 200);
});
