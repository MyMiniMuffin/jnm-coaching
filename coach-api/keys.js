/**
 * Coach API keys: `jnmc_<prefix>_<secret>`.
 *
 * Only the prefix and a SHA-256 hash of the whole key are stored
 * (table coach_api_keys, migration 012). The key itself is shown once
 * when it is created and is never logged.
 */
const crypto = require('node:crypto');

const KEY_PATTERN = /^jnmc_([0-9a-f]{12})_([0-9a-f]{64})$/;
const SCOPE_COACH = 'coach';
const UNAUTHORIZED_MESSAGE = 'Mangler eller ugyldig API-nøkkel.';
// Compared against when the prefix is unknown, so the response time does not reveal it.
const DUMMY_HASH = crypto.createHash('sha256').update('jnmc-dummy').digest('hex');

const hashKey = (key) => crypto.createHash('sha256').update(key, 'utf8').digest('hex');

const generateKey = () => {
  const prefix = crypto.randomBytes(6).toString('hex');
  const secret = crypto.randomBytes(32).toString('hex');
  const key = `jnmc_${prefix}_${secret}`;
  return { key, prefix, hash: hashKey(key) };
};

const parseKey = (key) => {
  const match = typeof key === 'string' ? KEY_PATTERN.exec(key) : null;
  return match ? { prefix: match[1] } : null;
};

/** Reads `Authorization: Bearer <key>`. Returns the key or null. */
const readBearer = (authorization) => {
  if (Array.isArray(authorization)) authorization = authorization[0];
  if (typeof authorization !== 'string') return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(authorization);
  return match ? match[1] : null;
};

const hashesMatch = (expectedHex, actualHex) => {
  const expected = Buffer.from(String(expectedHex || ''), 'hex');
  const actual = Buffer.from(actualHex, 'hex');
  if (expected.length !== actual.length || expected.length === 0) {
    crypto.timingSafeEqual(actual, actual);
    return false;
  }
  return crypto.timingSafeEqual(expected, actual);
};

const deny = (statusCode, error) => ({ ok: false, statusCode, error });

/**
 * Validates the Authorization header against coach_api_keys.
 * 401: missing, malformed, unknown, wrong or revoked key. 403: valid key without coach access.
 */
const authenticateCoachKey = async (sql, authorization) => {
  const key = readBearer(authorization);
  const parsed = key && parseKey(key);
  if (!parsed) return deny(401, UNAUTHORIZED_MESSAGE);

  const rows = await sql`
    SELECT k.id, k.name, k.scope, k.key_hash, k.revoked_at, k.coach_user_id,
           u.role AS coach_role
    FROM coach_api_keys k
    LEFT JOIN users u ON u.id = k.coach_user_id
    WHERE k.prefix = ${parsed.prefix}
    LIMIT 1
  `;
  const row = rows[0];
  const matches = hashesMatch(row ? row.key_hash : DUMMY_HASH, hashKey(key));
  if (!row || !matches || row.revoked_at) return deny(401, UNAUTHORIZED_MESSAGE);
  if (row.scope !== SCOPE_COACH || !row.coach_user_id || row.coach_role !== 'coach') {
    return deny(403, 'API-nøkkelen har ikke tilgang til coach-API-et.');
  }

  // Throttled in SQL so polling does not write on every request.
  await sql`
    UPDATE coach_api_keys SET last_used_at = NOW()
    WHERE id = ${row.id} AND (last_used_at IS NULL OR last_used_at < NOW() - INTERVAL '1 minute')
  `;

  return {
    ok: true,
    key: {
      id: Number(row.id),
      name: row.name,
      prefix: parsed.prefix,
      scope: row.scope,
      coachUserId: Number(row.coach_user_id)
    }
  };
};

module.exports = {
  SCOPE_COACH,
  UNAUTHORIZED_MESSAGE,
  authenticateCoachKey,
  generateKey,
  hashKey,
  parseKey,
  readBearer
};
