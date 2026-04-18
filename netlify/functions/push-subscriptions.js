const { neon } = require('@neondatabase/serverless');
const { requireAuth } = require('./auth-middleware');

if (!process.env.NETLIFY_DATABASE_URL) {
  throw new Error('NETLIFY_DATABASE_URL miljøvariabel er ikke satt');
}

const sql = neon(process.env.NETLIFY_DATABASE_URL);

const normalizeSubscription = (subscription = {}) => {
  const endpoint = typeof subscription.endpoint === 'string' ? subscription.endpoint.trim() : '';
  const keys = subscription.keys || {};
  const p256dh = typeof keys.p256dh === 'string' ? keys.p256dh.trim() : '';
  const auth = typeof keys.auth === 'string' ? keys.auth.trim() : '';

  if (!endpoint || !p256dh || !auth) {
    return null;
  }

  return {
    endpoint,
    p256dh,
    auth
  };
};

exports.handler = async (event) => {
  const authResult = requireAuth(event);
  if (!authResult.success) {
    return { statusCode: authResult.statusCode, body: authResult.body };
  }

  if (authResult.role !== 'coach') {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Kun coach kan administrere push-varsler.' })
    };
  }

  try {
    if (event.httpMethod === 'POST') {
      let parsed;
      try {
        parsed = JSON.parse(event.body || '');
      } catch (error) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Ugyldig JSON i request body' }) };
      }

      const subscription = normalizeSubscription(parsed.subscription);
      if (!subscription) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Ugyldig push-abonnement' }) };
      }

      await sql`
        INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, updated_at)
        VALUES (
          ${authResult.userId},
          ${subscription.endpoint},
          ${subscription.p256dh},
          ${subscription.auth},
          ${event.headers['user-agent'] || event.headers['User-Agent'] || null},
          NOW()
        )
        ON CONFLICT (endpoint)
        DO UPDATE SET
          user_id = EXCLUDED.user_id,
          p256dh = EXCLUDED.p256dh,
          auth = EXCLUDED.auth,
          user_agent = EXCLUDED.user_agent,
          updated_at = NOW()
      `;

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true })
      };
    }

    if (event.httpMethod === 'DELETE') {
      let parsed = {};
      try {
        parsed = event.body ? JSON.parse(event.body) : {};
      } catch (error) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Ugyldig JSON i request body' }) };
      }

      const endpoint = typeof parsed.endpoint === 'string' ? parsed.endpoint.trim() : '';
      if (!endpoint) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Mangler endpoint' }) };
      }

      await sql`
        DELETE FROM push_subscriptions
        WHERE user_id = ${authResult.userId} AND endpoint = ${endpoint}
      `;

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true })
      };
    }

    return { statusCode: 405, body: JSON.stringify({ error: 'Metode ikke tillatt' }) };
  } catch (error) {
    console.error('push-subscriptions error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Serverfeil' }) };
  }
};
