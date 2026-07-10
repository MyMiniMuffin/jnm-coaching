const cloudinary = require('cloudinary').v2;
const { neon } = require('@neondatabase/serverless');
const { requireOwnership } = require('./auth-middleware');
const { parseJsonBody } = require('./http-utils');

if (!process.env.NETLIFY_DATABASE_URL) {
  throw new Error('NETLIFY_DATABASE_URL miljøvariabel er ikke satt');
}

const sql = neon(process.env.NETLIFY_DATABASE_URL);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // Sjekk at Cloudinary er konfigurert
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      console.error('Upload: Cloudinary miljøvariabler mangler');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Cloudinary er ikke konfigurert. Vennligst kontakt administrator.' })
      };
    }

    const parsedBody = parseJsonBody(event);
    if (!parsedBody.ok) return parsedBody.response;
    const { image, userId, purpose } = parsedBody.data;

    if (!userId || !['checkin', 'gallery'].includes(purpose)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Mangler opplastingskontekst' })
      };
    }

    const authResult = requireOwnership(event, userId);
    if (!authResult.success) {
      console.error('Upload: Autentisering feilet', authResult);
      return { statusCode: authResult.statusCode, body: authResult.body };
    }

    const targetUserResult = await sql`
      SELECT role, is_archived
      FROM users
      WHERE id = ${userId}
      LIMIT 1
    `;

    const targetUser = targetUserResult[0];
    if (!targetUser) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Brukeren ble ikke funnet' }) };
    }

    if (targetUser.role !== 'athlete') {
      return { statusCode: 400, body: JSON.stringify({ error: 'Opplasting kan bare knyttes til utøvere.' }) };
    }

    if (targetUser.is_archived) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Kontoen er arkivert og kan ikke endres.' }) };
    }

    if (purpose === 'checkin' && (authResult.role !== 'athlete' || parseInt(authResult.userId, 10) !== parseInt(userId, 10))) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Kun utøveren selv kan laste opp rapportbilder.' }) };
    }

    if (purpose === 'gallery' && authResult.role !== 'coach') {
      return { statusCode: 403, body: JSON.stringify({ error: 'Kun coach kan laste opp galleribilder.' }) };
    }

    if (!image || typeof image !== 'string') {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Mangler bilde-data' })
      };
    }

    // Valider at det er en base64-encoded bilde med gyldig MIME-type
    if (!/^data:image\/(jpeg|jpg|png|webp|gif);base64,/.test(image)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Ugyldig bildeformat — kun JPEG, PNG, WebP og GIF er tillatt' })
      };
    }

    // Sjekk filstørrelse før sending (~75% av base64-lengde = faktisk filstørrelse)
    const approxSizeBytes = image.length * 0.75;
    if (approxSizeBytes > 10485760) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Bildet er for stort (maks 10 MB)' })
      };
    }

    console.log('Upload: Starter opplasting til Cloudinary...');

    // Last opp til Cloudinary med signed upload
    const result = await cloudinary.uploader.upload(image, {
      folder: 'jnm_coaching',
      resource_type: 'image',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
      max_bytes: 10485760, // 10MB max
      transformation: [
        { width: 1200, height: 1200, crop: 'limit', quality: 'auto:good' }
      ]
    });

    console.log('Upload: Opplasting fullført:', result.secure_url);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: result.secure_url,
        publicId: result.public_id
      })
    };

  } catch (error) {
    console.error('Upload error:', error.message || 'Ukjent feil');

    // Returner generisk feilmelding til klient (full feil logges over)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Feil under opplasting av bilde. Prøv igjen.' })
    };
  }
};
