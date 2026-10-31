// Coach view of the public form submissions (coaching application, onboarding).
// GET lists them newest first; PATCH marks one handled or open again.
const { neon } = require('@neondatabase/serverless');
const { requireAuth } = require('./auth-middleware');
const { jsonResponse, parseJsonBody } = require('./http-utils');

if (!process.env.NETLIFY_DATABASE_URL) throw new Error('Missing database configuration');
const sql = neon(process.env.NETLIFY_DATABASE_URL);
const reply = (status, body) => jsonResponse(status, body, { 'Cache-Control': 'no-store' });

exports.handler = async (event) => {
  const auth = requireAuth(event);
  if (!auth.success) return { statusCode: auth.statusCode, body: auth.body };
  try {
    // Check the role in the database, not only the token (as account-deletion does).
    const [user] = await sql`SELECT id, role FROM users WHERE id = ${auth.userId}`;
    if (!user || user.role !== auth.role) return reply(401, { error: 'Logg inn på nytt.' });
    if (user.role !== 'coach') return reply(403, { error: 'Kun coach kan se henvendelser.' });

    if (event.httpMethod === 'GET') {
      const submissions = await sql`
        SELECT id, form_name AS "formName", data, created_at AS "createdAt",
               handled_at AS "handledAt", source
        FROM form_submissions
        ORDER BY created_at DESC
        LIMIT 500
      `;
      return reply(200, submissions);
    }

    if (event.httpMethod === 'PATCH') {
      const parsed = parseJsonBody(event);
      if (!parsed.ok) return parsed.response;
      const { id, handled } = parsed.data;
      if (!Number.isSafeInteger(id) || id <= 0 || typeof handled !== 'boolean') {
        return reply(400, { error: 'Ugyldig forespørsel.' });
      }
      const rows = handled
        ? await sql`UPDATE form_submissions SET handled_at = COALESCE(handled_at, NOW()) WHERE id = ${id} RETURNING id, handled_at AS "handledAt"`
        : await sql`UPDATE form_submissions SET handled_at = NULL WHERE id = ${id} RETURNING id, handled_at AS "handledAt"`;
      if (!rows.length) return reply(404, { error: 'Fant ikke henvendelsen.' });
      return reply(200, rows[0]);
    }

    return reply(405, { error: 'Metode ikke tillatt.' });
  } catch (error) {
    console.error('[Form submissions] Request failed:', error.code || 'unknown');
    return reply(500, { error: 'Kunne ikke hente henvendelsene. Prøv igjen.' });
  }
};
