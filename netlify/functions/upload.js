const cloudinary = require('cloudinary').v2;
const { requireAuth } = require('./auth-middleware');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Verifiser autentisering
  const authResult = requireAuth(event);
  if (!authResult.success) {
    return { statusCode: authResult.statusCode, body: authResult.body };
  }

  try {
    const { image } = JSON.parse(event.body);

    if (!image) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Mangler bilde-data' })
      };
    }

    // Valider at det er en base64-encoded bilde
    if (!image.startsWith('data:image/')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Ugyldig bildeformat' })
      };
    }

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

    return {
      statusCode: 200,
      body: JSON.stringify({
        url: result.secure_url,
        publicId: result.public_id
      })
    };

  } catch (error) {
    console.error('Upload error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Feil under opplasting av bilde: ' + error.message })
    };
  }
};
