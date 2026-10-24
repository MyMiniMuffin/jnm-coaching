const { neon } = require('@neondatabase/serverless');
const { requireAuth } = require('./auth-middleware');
const { jsonResponse } = require('./http-utils');

const sql = neon(process.env.NETLIFY_DATABASE_URL);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Metoden er ikke tillatt' }, { Allow: 'POST' });
  }
  const auth = requireAuth(event);
  if (!auth.success) return { statusCode: auth.statusCode, body: auth.body };

  try {
    // Bruk tokenets identitet og serverens klokke, aldri en innsendt bruker-ID.
    // RETURNING/SELECT i samme runde gir også fersk is_archived, slik at utøvere
    // får arkivstatus uten å måtte logge inn på nytt.
    const rows = await sql`
      WITH bumped AS (
        UPDATE users SET last_active_at = NOW()
        WHERE id = ${auth.userId}
          AND (last_active_at IS NULL OR last_active_at < NOW() - INTERVAL '1 minute')
        RETURNING id
      )
      SELECT COALESCE(is_archived, false) AS is_archived
      FROM users
      WHERE id = ${auth.userId}
    `;

    return jsonResponse(200, {
      isArchived: Boolean(rows[0]?.is_archived)
    }, { 'Cache-Control': 'no-store' });
  } catch (error) {
    console.error('Kunne ikke registrere aktivitet:', error);
    return jsonResponse(500, { error: 'Kunne ikke registrere aktivitet' });
  }
};
