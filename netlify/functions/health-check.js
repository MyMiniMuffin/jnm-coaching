// Health check funksjon for å verifisere miljøvariabler
// Bruk denne for å sjekke at alle nødvendige variabler er satt
// URL: /.netlify/functions/health-check

const { requireAuth } = require('./auth-middleware');

exports.handler = async (event) => {
  // Bare tillat GET-forespørsler
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Krev autentisering (kun coach bør ha tilgang)
  const authResult = requireAuth(event);
  if (!authResult.success) {
    return { statusCode: authResult.statusCode, body: authResult.body };
  }
  if (authResult.role !== 'coach') {
    return { statusCode: 403, body: JSON.stringify({ error: 'Kun coach har tilgang' }) };
  }

  const checks = {
    timestamp: new Date().toISOString(),
    environment: process.env.CONTEXT || 'unknown',
    checks: {}
  };

  // Sjekk alle nødvendige miljøvariabler (uten å lekke verdier)
  const requiredVars = ['JWT_SECRET', 'NETLIFY_DATABASE_URL', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];

  requiredVars.forEach(varName => {
    checks.checks[varName] = process.env[varName]
      ? { status: '✅ OK' }
      : { status: '❌ MANGLER', error: 'Miljøvariabelen er ikke satt' };
  });

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
    statusCode: checks.summary.allOk ? 200 : 503,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(checks, null, 2)
  };
};
