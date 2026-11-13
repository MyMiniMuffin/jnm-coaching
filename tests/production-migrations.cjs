const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const scriptDirectory = path.join(__dirname, '../scripts');
const source = fs.readFileSync(path.join(scriptDirectory, 'migrate-production.cjs'), 'utf8');

// Behaves like @neondatabase/serverless 1.x: sql`...` is allowed, sql('string') throws,
// raw SQL text must go through sql.query(text, params?, opts?).
function createNeon1Mock() {
  const queries = [];
  const queryCalls = [];
  const run = (text) => {
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
  const sql = async (strings, ...values) => {
    if (!Array.isArray(strings)) {
      throw new Error('This function can now be called only as a tagged-template, use sql.query(text, params)');
    }
    return run(strings.reduce((text, part, i) => text + part + (i < values.length ? `$${i + 1}` : ''), ''));
  };
  sql.query = async (text, params, opts) => {
    assert.equal(typeof text, 'string');
    queryCalls.push(text);
    return run(text);
  };
  return { sql, queries, queryCalls };
}

async function runScript(code, sql) {
  const failures = [];
  const context = {
    __dirname: scriptDirectory,
    process: { env: { CONTEXT: 'production', NETLIFY_DATABASE_URL: 'test-only' } },
    console: { log() {}, error: (...args) => failures.push(args) },
    require: (name) => name === '@neondatabase/serverless' ? { neon: () => sql } : require(name)
  };
  await vm.runInNewContext(code, context);
  return { context, failures };
}

test('production migrations send separate SQL statements and verify the resulting schema', async () => {
  const { sql, queries } = createNeon1Mock();
  const { context, failures } = await runScript(source, sql);
  assert.deepEqual(failures, []);
  assert.equal(context.process.exitCode, undefined);
  const create = queries.findIndex(query => query.includes('CREATE TABLE IF NOT EXISTS account_deletion_requests'));
  const index = queries.findIndex(query => query.includes('CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_pending'));
  assert.ok(create >= 0 && index > create);
  assert.ok(queries.some(query => query.includes('ADD COLUMN IF NOT EXISTS platform')));
  assert.ok(queries.some(query => query.includes('ALTER COLUMN p256dh DROP NOT NULL')));
  assert.ok(queries.some(query => query.includes('ALTER COLUMN auth DROP NOT NULL')));
});

test('migration script runs every migration file 003-011 through sql.query', async () => {
  const { sql, queryCalls } = createNeon1Mock();
  const { failures } = await runScript(source, sql);
  assert.deepEqual(failures, []);
  const migrationsDirectory = path.join(__dirname, '../migrations');
  const files = fs.readdirSync(migrationsDirectory)
    .filter(name => /^0(0[3-9]|1[01])_.*\.sql$/.test(name))
    .sort();
  assert.equal(files.length, 9);
  const expected = files.map(name => fs.readFileSync(path.join(migrationsDirectory, name), 'utf8'));
  assert.deepEqual(queryCalls, expected);
});

test('a migration script calling sql(string) directly fails under Neon 1.x semantics', async () => {
  const { sql } = createNeon1Mock();
  const legacySource = source.split('sql.query(').join('sql(');
  assert.notEqual(legacySource, source);
  const { context, failures } = await runScript(legacySource, sql);
  assert.equal(context.process.exitCode, 1);
  assert.equal(failures.length, 1);
  assert.match(failures[0][0], /Database migration failed/);
});
