// Coach view of the public form submissions (coaching application, onboarding).
// GET lists them newest first; PATCH marks one handled or open again;
// DELETE removes a handled one together with its onboarding photos.
const { neon } = require('@neondatabase/serverless');
const cloudinary = require('cloudinary').v2;
const { requireAuth } = require('./auth-middleware');
const { jsonResponse, parseJsonBody } = require('./http-utils');

if (!process.env.NETLIFY_DATABASE_URL) throw new Error('Missing database configuration');
const sql = neon(process.env.NETLIFY_DATABASE_URL);
const reply = (status, body) => jsonResponse(status, body, { 'Cache-Control': 'no-store' });

const PHOTO_FIELDS = ['front-photo-url', 'side-photo-url', 'back-photo-url'];
// Signed delivery URL from onboarding-image-upload:
// .../image/authenticated/s--SIG--/v123/jnm_coaching/onboarding/<id>.jpg
const ONBOARDING_PHOTO = /\/image\/authenticated\/(?:s--[^/]+--\/)?(?:v\d+\/)?(jnm_coaching\/onboarding\/[^/?#]+?)(?:\.[a-z]+)?(?:[?#].*)?$/i;

/** Cloudinary public IDs of the onboarding photos in a submission (never other folders). */
const onboardingPhotoIds = (data) => PHOTO_FIELDS
  .map((field) => (typeof data?.[field] === 'string' ? data[field].match(ONBOARDING_PHOTO)?.[1] : null))
  .filter(Boolean);

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

    if (event.httpMethod === 'DELETE') {
      const parsed = parseJsonBody(event);
      if (!parsed.ok) return parsed.response;
      const { id } = parsed.data;
      if (!Number.isSafeInteger(id) || id <= 0) return reply(400, { error: 'Ugyldig forespørsel.' });

      const [submission] = await sql`SELECT id, data, handled_at FROM form_submissions WHERE id = ${id}`;
      if (!submission) return reply(404, { error: 'Fant ikke henvendelsen.' });
      // New submissions cannot disappear by a mistap: handle first, then delete.
      if (!submission.handled_at) return reply(409, { error: 'Marker henvendelsen som behandlet før du sletter den.' });

      // Remove the photos first. If Cloudinary fails the row stays, so no photo
      // is left behind without a submission pointing to it.
      const photoIds = onboardingPhotoIds(submission.data);
      if (photoIds.length) {
        if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
          return reply(500, { error: 'Bildesletting er ikke konfigurert.' });
        }
        cloudinary.config({
          cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
          api_key: process.env.CLOUDINARY_API_KEY,
          api_secret: process.env.CLOUDINARY_API_SECRET
        });
        for (const publicId of photoIds) {
          const result = await cloudinary.uploader.destroy(publicId, { type: 'authenticated', resource_type: 'image', invalidate: true });
          if (result?.result !== 'ok' && result?.result !== 'not found') {
            console.error('[Form submissions] Photo delete failed:', result?.result || 'unknown');
            return reply(502, { error: 'Bildene kunne ikke slettes. Prøv igjen.' });
          }
        }
      }

      const deleted = await sql`DELETE FROM form_submissions WHERE id = ${id} AND handled_at IS NOT NULL RETURNING id`;
      if (!deleted.length) return reply(409, { error: 'Henvendelsen er endret. Last inn på nytt.' });
      return reply(200, { id: deleted[0].id, photosDeleted: photoIds.length });
    }

    return reply(405, { error: 'Metode ikke tillatt.' });
  } catch (error) {
    console.error('[Form submissions] Request failed:', error.code || 'unknown');
    return reply(500, { error: 'Kunne ikke hente henvendelsene. Prøv igjen.' });
  }
};
