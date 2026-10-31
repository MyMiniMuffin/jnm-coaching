// Receives the public forms that Netlify Forms used to capture
// (POST / with form-name, urlencoded). server.mjs routes them here.
const { neon } = require('@neondatabase/serverless');
const { jsonResponse } = require('./http-utils');

const sql = neon(process.env.NETLIFY_DATABASE_URL);

// Field lists match what Netlify recorded for each form.
const FORMS = {
  'coaching-application': ['name', 'email', 'phone', 'instagram', 'goal', 'why-now'],
  kundeoppstart: [
    'subject', 'name', 'email', 'phone', 'age', 'height', 'weight', 'training-location',
    'training-goals', 'training-days', 'current-activity', 'current-diet', 'other-information',
    'front-photo-url', 'side-photo-url', 'back-photo-url', 'consent'
  ]
};
const MAX_FIELD_LENGTH = 5000;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Metoden er ikke tillatt' }, { Allow: 'POST' });
  }

  const params = new URLSearchParams(event.body || '');
  const fields = FORMS[params.get('form-name')];
  if (!fields) return jsonResponse(404, { error: 'Ukjent skjema' });

  // Honeypot: bots fill the hidden field. Answer like a success so they move on.
  if (params.get('bot-field')) return jsonResponse(200, { ok: true });

  const data = {};
  for (const field of fields) {
    const value = params.get(field);
    if (value) data[field] = value.slice(0, MAX_FIELD_LENGTH);
  }
  if (!data.name || !data.email) {
    return jsonResponse(400, { error: 'Navn og e-post må fylles ut' });
  }

  try {
    await sql`
      INSERT INTO form_submissions (form_name, data)
      VALUES (${params.get('form-name')}, ${JSON.stringify(data)}::jsonb)
    `;
    return jsonResponse(200, { ok: true }, { 'Cache-Control': 'no-store' });
  } catch (error) {
    console.error('Kunne ikke lagre skjema:', error?.message || 'Ukjent feil');
    return jsonResponse(500, { error: 'Kunne ikke sende inn skjemaet' });
  }
};
