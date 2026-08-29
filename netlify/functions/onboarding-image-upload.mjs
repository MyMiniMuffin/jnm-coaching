import cloudinaryPackage from 'cloudinary';

const cloudinary = cloudinaryPackage.v2;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const POSITIONS = new Set(['front', 'side', 'back']);
const DATA_URL_PATTERN = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

const jsonResponse = (status, payload) => Response.json(payload, {
  status,
  headers: {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  }
});

const getDataUrlSize = (base64) => {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
};

const isSameOriginRequest = (request) => {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');

  if (!origin || !host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
};

export default async (request) => {
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method Not Allowed' });
  }

  if (!isSameOriginRequest(request)) {
    return jsonResponse(403, { error: 'Ugyldig opplastingskilde.' });
  }

  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error('Onboarding upload: Cloudinary-miljøvariabler mangler');
    return jsonResponse(500, { error: 'Bildeopplasting er ikke konfigurert.' });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: 'Ugyldig forespørsel.' });
  }

  if (body?.botField) {
    return jsonResponse(200, { ignored: true, url: '' });
  }

  if (!POSITIONS.has(body?.position) || typeof body?.image !== 'string') {
    return jsonResponse(400, { error: 'Mangler gyldig bilde eller bildeposisjon.' });
  }

  const match = body.image.match(DATA_URL_PATTERN);
  if (!match) {
    return jsonResponse(400, { error: 'Kun JPG-, PNG- og WebP-bilder er tillatt.' });
  }

  if (getDataUrlSize(match[2]) > MAX_IMAGE_BYTES) {
    return jsonResponse(413, { error: 'Bildet er for stort etter komprimering.' });
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });

  try {
    const result = await cloudinary.uploader.upload(body.image, {
      type: 'authenticated',
      folder: 'jnm_coaching/onboarding',
      resource_type: 'image',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      max_bytes: MAX_IMAGE_BYTES,
      format: 'jpg',
      use_filename: false,
      unique_filename: true,
      overwrite: false,
      tags: ['onboarding', `position_${body.position}`],
      transformation: [
        { width: 1600, height: 1600, crop: 'limit', quality: 'auto:good' }
      ]
    });

    const signedUrl = cloudinary.url(result.public_id, {
      secure: true,
      sign_url: true,
      type: 'authenticated',
      version: result.version,
      format: result.format
    });

    return jsonResponse(200, {
      url: signedUrl,
      publicId: result.public_id,
      position: body.position
    });
  } catch (error) {
    console.error('Onboarding upload error:', error?.message || 'Ukjent feil');
    return jsonResponse(500, { error: 'Bildet kunne ikke lastes opp. Prøv igjen.' });
  }
};

export const config = {
  path: '/api/onboarding-image-upload',
  rateLimit: {
    windowLimit: 6,
    windowSize: 180,
    aggregateBy: ['ip', 'domain']
  }
};
