#!/usr/bin/env node
/**
 * Manage coach API keys (table coach_api_keys, migration 012).
 *
 *   npm run coach-key -- create --name grok [--coach <username>]
 *   npm run coach-key -- list
 *   npm run coach-key -- rotate <prefix>
 *   npm run coach-key -- revoke <prefix>
 *
 * Uses NETLIFY_DATABASE_URL. The full key is printed once on create/rotate;
 * only its prefix and SHA-256 hash are stored.
 */
const { generateKey, SCOPE_COACH } = require('../coach-api/keys');

const USAGE = `Bruk:
  npm run coach-key -- create --name <navn> [--coach <brukernavn>]
  npm run coach-key -- list
  npm run coach-key -- rotate <prefix>
  npm run coach-key -- revoke <prefix>`;

class UsageError extends Error {}

const parseArgs = (argv) => {
  const [command, ...rest] = argv;
  const options = {};
  const positional = [];
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg.startsWith('--')) {
      const [name, inline] = arg.slice(2).split('=', 2);
      const value = inline ?? rest[i + 1];
      if (inline === undefined) i += 1;
      if (value === undefined || value.startsWith('--')) throw new UsageError(`Mangler verdi for --${name}`);
      options[name] = value;
    } else {
      positional.push(arg);
    }
  }
  return { command, options, positional };
};

const normalizePrefix = (value) => {
  // Accept the prefix alone or a pasted full key/"jnmc_<prefix>" (only the prefix is used).
  const match = /^(?:jnmc_)?([0-9a-f]{12})(?:_.*)?$/.exec(String(value || '').trim());
  if (!match) throw new UsageError('Ugyldig prefix (12 heksadesimale tegn, se "list")');
  return match[1];
};

const resolveCoach = async (sql, username) => {
  const coaches = username
    ? await sql`SELECT id, username FROM users WHERE role = 'coach' AND LOWER(username) = LOWER(${username})`
    : await sql`SELECT id, username FROM users WHERE role = 'coach' ORDER BY id`;
  if (coaches.length === 1) return coaches[0];
  if (username) throw new UsageError(`Fant ingen coach med brukernavn "${username}"`);
  if (!coaches.length) throw new UsageError('Fant ingen coach-bruker i databasen');
  throw new UsageError(`Flere coacher finnes; velg med --coach (${coaches.map((coach) => coach.username).join(', ')})`);
};

const printKey = (log, key, row) => {
  log(`Ny API-nøkkel for "${row.name}" (prefix ${row.prefix}, coach ${row.coach_username}):`);
  log('');
  log(`  ${key}`);
  log('');
  log('Nøkkelen vises bare denne ene gangen. Lagre den nå (f.eks. i Grok sin MCP-connector).');
};

const commands = {
  async create(sql, { options }, log) {
    const name = String(options.name || '').trim();
    if (!name || name.length > 100) throw new UsageError('Oppgi --name <navn> (maks 100 tegn)');
    const coach = await resolveCoach(sql, options.coach);
    const { key, prefix, hash } = generateKey();
    await sql`
      INSERT INTO coach_api_keys (prefix, key_hash, name, scope, coach_user_id)
      VALUES (${prefix}, ${hash}, ${name}, ${SCOPE_COACH}, ${coach.id})
    `;
    printKey(log, key, { name, prefix, coach_username: coach.username });
    return { key, prefix };
  },

  async list(sql, _args, log) {
    const rows = await sql`
      SELECT k.prefix, k.name, k.scope, u.username AS coach_username,
             k.created_at, k.last_used_at, k.revoked_at
      FROM coach_api_keys k
      LEFT JOIN users u ON u.id = k.coach_user_id
      ORDER BY k.created_at DESC
    `;
    if (!rows.length) {
      log('Ingen API-nøkler.');
      return rows;
    }
    const iso = (value) => (value ? new Date(value).toISOString().replace('.000Z', 'Z') : '-');
    for (const row of rows) {
      const status = row.revoked_at ? `tilbakekalt ${iso(row.revoked_at)}` : 'aktiv';
      log(`${row.prefix}  ${row.name}  scope=${row.scope}  coach=${row.coach_username || '-'}  opprettet=${iso(row.created_at)}  sist brukt=${iso(row.last_used_at)}  ${status}`);
    }
    return rows;
  },

  async rotate(sql, { positional }, log) {
    const oldPrefix = normalizePrefix(positional[0]);
    const existing = await sql`
      SELECT k.id, k.name, k.scope, k.coach_user_id, u.username AS coach_username
      FROM coach_api_keys k
      LEFT JOIN users u ON u.id = k.coach_user_id
      WHERE k.prefix = ${oldPrefix} AND k.revoked_at IS NULL
    `;
    if (!existing[0]) throw new UsageError(`Fant ingen aktiv nøkkel med prefix ${oldPrefix}`);
    const old = existing[0];
    const { key, prefix, hash } = generateKey();
    // Revoke the old key and create the new one together.
    await sql.transaction([
      sql`UPDATE coach_api_keys SET revoked_at = NOW() WHERE id = ${old.id} AND revoked_at IS NULL`,
      sql`
        INSERT INTO coach_api_keys (prefix, key_hash, name, scope, coach_user_id)
        VALUES (${prefix}, ${hash}, ${old.name}, ${old.scope}, ${old.coach_user_id})
      `
    ]);
    log(`Nøkkel ${oldPrefix} er tilbakekalt.`);
    printKey(log, key, { name: old.name, prefix, coach_username: old.coach_username || '-' });
    return { key, prefix };
  },

  async revoke(sql, { positional }, log) {
    const prefix = normalizePrefix(positional[0]);
    const rows = await sql`
      UPDATE coach_api_keys SET revoked_at = NOW()
      WHERE prefix = ${prefix} AND revoked_at IS NULL
      RETURNING name
    `;
    if (!rows[0]) throw new UsageError(`Fant ingen aktiv nøkkel med prefix ${prefix}`);
    log(`Nøkkel ${prefix} ("${rows[0].name}") er tilbakekalt.`);
    return { prefix };
  }
};

const run = async (argv, { sql, log = console.log } = {}) => {
  const args = parseArgs(argv);
  const command = commands[args.command];
  if (!command) throw new UsageError(args.command ? `Ukjent kommando "${args.command}"` : 'Mangler kommando');
  return command(sql, args, log);
};

if (require.main === module) {
  (async () => {
    try {
      const { getSql } = require('../coach-api/db');
      await run(process.argv.slice(2), { sql: getSql() });
    } catch (error) {
      console.error(error instanceof UsageError ? `${error.message}\n\n${USAGE}` : `Feil: ${error?.message || error}`);
      process.exitCode = 1;
    }
  })();
}

module.exports = { run, UsageError };
