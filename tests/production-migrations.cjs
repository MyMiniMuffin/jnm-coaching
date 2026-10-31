const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const scriptDirectory = path.join(__dirname, '../scripts');
const source = fs.readFileSync(path.join(scriptDirectory, 'migrate-production.cjs'), 'utf8');

test('production migrations send separate SQL statements and verify the resulting schema', async () => {
  const queries = [];
  const failures = [];
  const sql = async (query) => {
    const text = typeof query === 'string' ? query : query.join('');
    // Neon HTTP uses the extended query protocol: no multi-command query strings.
    assert.equal(text.split(';').filter(statement => statement.trim()).length, 1);
    queries.push(text);
    if (text.includes('information_schema.columns')) {
      if (text.includes('account_deletion_requests')) return Array.from({ length: 4 }, () => ({}));
      if (text.includes('handled_at')) return [{}];
      if (text.includes('form_submissions')) return Array.from({ length: 3 }, () => ({}));
      if (text.includes('push_subscriptions')) {
        return [
          { column_name: 'platform', is_nullable: 'NO' },
          { column_name: 'p256dh', is_nullable: 'YES' },
          { column_name: 'auth', is_nullable: 'YES' }
        ];
      }
      return [{}];
    }
    return [];
  };
  const context = {
    __dirname: scriptDirectory,
    process: { env: { CONTEXT: 'production', NETLIFY_DATABASE_URL: 'test-only' } },
    console: { log() {}, error: (...args) => failures.push(args) },
    require: (name) => name === '@neondatabase/serverless' ? { neon: () => sql } : require(name)
  };
  await vm.runInNewContext(source, context);
  assert.deepEqual(failures, []);
  assert.equal(context.process.exitCode, undefined);
  const create = queries.findIndex(query => query.includes('CREATE TABLE IF NOT EXISTS account_deletion_requests'));
  const index = queries.findIndex(query => query.includes('CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_pending'));
  assert.ok(create >= 0 && index > create);
  assert.ok(queries.some(query => query.includes('ADD COLUMN IF NOT EXISTS platform')));
  assert.ok(queries.some(query => query.includes('ALTER COLUMN p256dh DROP NOT NULL')));
  assert.ok(queries.some(query => query.includes('ALTER COLUMN auth DROP NOT NULL')));
});
