// Health check funksjon for å verifisere miljøvariabler
// Bruk denne for å sjekke at alle nødvendige variabler er satt
// URL: /.netlify/functions/health-check

exports.handler = async (event) => {
  // Bare tillat GET-forespørsler
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const checks = {
    timestamp: new Date().toISOString(),
    environment: process.env.CONTEXT || 'unknown',
    checks: {}
  };

  // Sjekk JWT_SECRET
  if (process.env.JWT_SECRET) {
    checks.checks.JWT_SECRET = {
      status: '✅ OK',
      length: process.env.JWT_SECRET.length,
      warning: process.env.JWT_SECRET === 'CHANGE_THIS_IN_PRODUCTION'
        ? '⚠️ Bruker default-verdi - bytt til en sikker verdi!'
        : null
    };
  } else {
    checks.checks.JWT_SECRET = {
      status: '❌ MANGLER',
      error: 'Miljøvariabelen er ikke satt'
    };
  }

  // Sjekk NETLIFY_DATABASE_URL
  if (process.env.NETLIFY_DATABASE_URL) {
    const dbUrl = process.env.NETLIFY_DATABASE_URL;
    checks.checks.NETLIFY_DATABASE_URL = {
      status: '✅ OK',
      valid: dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://'),
      hasSsl: dbUrl.includes('sslmode=require')
    };
    if (!checks.checks.NETLIFY_DATABASE_URL.hasSsl) {
      checks.checks.NETLIFY_DATABASE_URL.warning = '⚠️ SSL mode ikke aktivert - legg til ?sslmode=require';
    }
  } else {
    checks.checks.NETLIFY_DATABASE_URL = {
      status: '❌ MANGLER',
      error: 'Miljøvariabelen er ikke satt'
    };
  }

  // Sjekk CLOUDINARY_CLOUD_NAME
  if (process.env.CLOUDINARY_CLOUD_NAME) {
    checks.checks.CLOUDINARY_CLOUD_NAME = {
      status: '✅ OK',
      length: process.env.CLOUDINARY_CLOUD_NAME.length
    };
  } else {
    checks.checks.CLOUDINARY_CLOUD_NAME = {
      status: '❌ MANGLER',
      error: 'Miljøvariabelen er ikke satt'
    };
  }

  // Sjekk CLOUDINARY_API_KEY
  if (process.env.CLOUDINARY_API_KEY) {
    checks.checks.CLOUDINARY_API_KEY = {
      status: '✅ OK',
      length: process.env.CLOUDINARY_API_KEY.length
    };
  } else {
    checks.checks.CLOUDINARY_API_KEY = {
      status: '❌ MANGLER',
      error: 'Miljøvariabelen er ikke satt'
    };
  }

  // Sjekk CLOUDINARY_API_SECRET
  if (process.env.CLOUDINARY_API_SECRET) {
    checks.checks.CLOUDINARY_API_SECRET = {
      status: '✅ OK',
      length: process.env.CLOUDINARY_API_SECRET.length
    };
  } else {
    checks.checks.CLOUDINARY_API_SECRET = {
      status: '❌ MANGLER',
      error: 'Miljøvariabelen er ikke satt'
    };
  }

  // Oppsummering
  const allChecks = Object.values(checks.checks);
  const okCount = allChecks.filter(c => c.status === '✅ OK').length;
  const totalCount = allChecks.length;

  checks.summary = {
    total: totalCount,
    ok: okCount,
    missing: totalCount - okCount,
    allOk: okCount === totalCount
  };

  if (checks.summary.allOk) {
    checks.message = '✅ Alle miljøvariabler er satt!';
  } else {
    checks.message = `⚠️ ${checks.summary.missing} av ${totalCount} miljøvariabler mangler`;
  }

  return {
    statusCode: checks.summary.allOk ? 200 : 500,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(checks, null, 2)
  };
};
