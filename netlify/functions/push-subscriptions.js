const { neon } = require('@neondatabase/serverless');
const { requireAuth } = require('./auth-middleware');
const { getHeader, parseJsonBody } = require('./http-utils');
const { normalizeSubscription } = require('./push-delivery');

if (!process.env.NETLIFY_DATABASE_URL) {
  throw new Error('NETLIFY_DATABASE_URL miljøvariabel er ikke satt');
}

const sql = neon(process.env.NETLIFY_DATABASE_URL);

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
      const parsedBody = parseJsonBody(event);
      if (!parsedBody.ok) return parsedBody.response;
      const subscription = normalizeSubscription(
        parsedBody.data.subscription || parsedBody.data,
        parsedBody.data.platform
      );
      if (!subscription) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Ugyldig push-abonnement' }) };
      }

      await sql`
        INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, platform, user_agent, updated_at)
        VALUES (
          ${authResult.userId},
          ${subscription.endpoint},
          ${subscription.p256dh},
          ${subscription.auth},
          ${subscription.platform},
          ${getHeader(event, 'user-agent') || null},
          NOW()
        )
        ON CONFLICT (endpoint)
        DO UPDATE SET
          user_id = EXCLUDED.user_id,
          p256dh = EXCLUDED.p256dh,
          auth = EXCLUDED.auth,
          platform = EXCLUDED.platform,
          user_agent = EXCLUDED.user_agent,
          updated_at = NOW()
      `;

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, platform: subscription.platform })
      };
    }

    if (event.httpMethod === 'DELETE') {
      const parsedBody = parseJsonBody(event, { allowEmpty: true });
      if (!parsedBody.ok) return parsedBody.response;
      const endpoint = typeof parsedBody.data.endpoint === 'string' ? parsedBody.data.endpoint.trim() : '';
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
