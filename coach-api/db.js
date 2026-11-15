const { neon } = require('@neondatabase/serverless');

let sql;
/** Neon connection for the coach API, created on first use (same env var as the functions). */
const getSql = () => {
  if (!sql) {
    if (!process.env.NETLIFY_DATABASE_URL) throw new Error('NETLIFY_DATABASE_URL miljøvariabel er ikke satt');
    sql = neon(process.env.NETLIFY_DATABASE_URL);
  }
  return sql;
};

module.exports = { getSql };
