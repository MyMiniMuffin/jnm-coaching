const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { neon } = require('@neondatabase/serverless');

async function main() {
  if (process.env.CONTEXT !== 'production') {
    console.log('Database migration: skipped outside production deployment.');
    return;
  }
  if (!process.env.NETLIFY_DATABASE_URL) throw new Error('Missing database configuration');
  const sql = neon(process.env.NETLIFY_DATABASE_URL);
  const migration = readFileSync(join(__dirname, '../migrations/003_require_password_change.sql'), 'utf8');
  await sql(migration);
  const columns = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users'
      AND column_name = 'must_change_password' AND data_type = 'boolean'
      AND is_nullable = 'NO'
  `;
  if (columns.length !== 1) throw new Error('Password-change column verification failed');
  console.log('Database migration 003: applied and verified.');
}
main().catch(() => {
  console.error('Database migration failed; deployment stopped. Check database configuration and migration 003.');
  process.exitCode = 1;
});
