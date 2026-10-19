const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const { requireAuth } = require('./auth-middleware');
const { jsonResponse, parseJsonBody } = require('./http-utils');

if (!process.env.NETLIFY_DATABASE_URL) throw new Error('Missing database configuration');
const sql = neon(process.env.NETLIFY_DATABASE_URL);
const reply = (status, body) => jsonResponse(status, body, { 'Cache-Control': 'no-store' });

exports.handler = async (event) => {
  const auth = requireAuth(event);
  if (!auth.success) return { statusCode: auth.statusCode, body: auth.body };
  try {
    // Deleted accounts must not continue using an otherwise unexpired JWT here.
    const [user] = await sql`SELECT id, role, password FROM users WHERE id = ${auth.userId}`;
    if (!user || user.role !== auth.role) return reply(401, { error: 'Logg inn på nytt.' });

    if (event.httpMethod === 'GET') {
      if (event.queryStringParameters?.scope === 'assets') {
        if (user.role !== 'coach') return reply(403, { error: 'Kun coach kan se bildeadresser.' });
        const id = Number(event.queryStringParameters.requestId);
        if (!Number.isSafeInteger(id) || id <= 0) return reply(400, { error: 'Ugyldig forespørsel.' });
        const [target] = await sql`SELECT user_id FROM account_deletion_requests WHERE id = ${id} AND completed_at IS NULL`;
        if (!target?.user_id) return reply(409, { error: 'Hent og ta vare på bildelisten før kontoen slettes.' });
        const [reports, gallery] = await Promise.all([
          sql`SELECT image_url, images FROM checkins WHERE user_id = ${target.user_id}`,
          sql`SELECT image_url FROM gallery_images WHERE user_id = ${target.user_id}`
        ]);
        const urls = new Set();
        for (const record of [...reports, ...gallery]) {
          let images = record.images;
          if (typeof images === 'string') images = JSON.parse(images);
          for (const url of [record.image_url, ...(Array.isArray(images) ? images : [])]) {
            if (typeof url === 'string' && url.startsWith('https://res.cloudinary.com/')) urls.add(url);
          }
        }
        return reply(200, { folder: `jnm_coaching/users/${target.user_id}`, urls: [...urls] });
      }

      if (event.queryStringParameters?.scope === 'pending') {
        if (user.role !== 'coach') return reply(403, { error: 'Kun coach kan se sletteforespørsler.' });
        const requests = await sql`
          SELECT r.id, r.user_id AS "userId", r.contact_email AS "contactEmail",
                 r.requested_at AS "requestedAt", r.requested_at + INTERVAL '30 days' AS "dueAt",
                 u.name, u.username, u.role
          FROM account_deletion_requests r LEFT JOIN users u ON u.id = r.user_id
          WHERE r.completed_at IS NULL ORDER BY r.requested_at ASC
        `;
        return reply(200, requests);
      }
      const requests = await sql`
        SELECT id, requested_at AS "requestedAt", requested_at + INTERVAL '30 days' AS "dueAt", contact_email AS "contactEmail"
        FROM account_deletion_requests WHERE user_id = ${user.id} AND completed_at IS NULL
      `;
      return reply(200, requests[0] || null);
    }

    if (event.httpMethod === 'POST') {
      const parsed = parseJsonBody(event);
      if (!parsed.ok) return parsed.response;
      const { password, contactEmail = '' } = parsed.data;
      if (typeof password !== 'string' || !password || password.length > 1024) {
        return reply(400, { error: 'Oppgi ditt nåværende passord.' });
      }
      if (typeof contactEmail !== 'string' || contactEmail.length > 254 || (contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim()))) {
        return reply(400, { error: 'Kontroller e-postadressen.' });
      }
      if (!await bcrypt.compare(password, user.password)) return reply(403, { error: 'Passordet er ikke riktig.' });
      // Never accept a user ID from the body. Repeated requests retain the original deadline.
      const [request] = await sql`
        INSERT INTO account_deletion_requests (user_id, contact_email)
        VALUES (${user.id}, ${contactEmail.trim() || null})
        ON CONFLICT (user_id) DO UPDATE SET contact_email = EXCLUDED.contact_email
        RETURNING id, requested_at AS "requestedAt", requested_at + INTERVAL '30 days' AS "dueAt", contact_email AS "contactEmail"
      `;
      return reply(200, request);
    }

    if (event.httpMethod === 'PATCH') {
      if (user.role !== 'coach') return reply(403, { error: 'Kun coach kan fullføre sletteforespørsler.' });
      const parsed = parseJsonBody(event);
      if (!parsed.ok) return parsed.response;
      const { id, imagesRemoved, confirmationSent } = parsed.data;
      if (!Number.isSafeInteger(id) || id <= 0 || imagesRemoved !== true || confirmationSent !== true) {
        return reply(400, { error: 'Bekreft sletting av bilder og at brukeren har fått beskjed.' });
      }
      // Account deletion must have happened first. ON DELETE SET NULL is the receipt.
      const results = await sql`
        UPDATE account_deletion_requests SET completed_at = NOW(), contact_email = NULL
        WHERE id = ${id} AND user_id IS NULL AND completed_at IS NULL RETURNING id
      `;
      if (!results.length) return reply(409, { error: 'Kontoen må slettes før forespørselen kan fullføres.' });
      return reply(200, { success: true });
    }
    return reply(405, { error: 'Metode ikke tillatt.' });
  } catch (error) {
    console.error('[Account deletion] Request failed:', error.code || 'unknown');
    return reply(500, { error: 'Kunne ikke behandle forespørselen. Prøv igjen eller kontakt kontakt@perfectmorning.dev.' });
  }
};
