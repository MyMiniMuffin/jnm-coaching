const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  APNS_ENDPOINT_PREFIX,
  buildCoachPushPayload,
  extractApnsDeviceToken,
  normalizeSubscription
} = require('../netlify/functions/push-delivery');

test('normalizeSubscription accepts web PushManager payloads', () => {
  const normalized = normalizeSubscription({
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
    keys: { p256dh: 'p256', auth: 'auth-key' }
  });
  assert.deepEqual(normalized, {
    platform: 'web',
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
    p256dh: 'p256',
    auth: 'auth-key'
  });
});

test('normalizeSubscription accepts iOS APNs device tokens', () => {
  const token = 'a'.repeat(64);
  const normalized = normalizeSubscription({ deviceToken: token }, 'ios');
  assert.equal(normalized.platform, 'ios');
  assert.equal(normalized.endpoint, `${APNS_ENDPOINT_PREFIX}${token}`);
  assert.equal(normalized.p256dh, null);
  assert.equal(normalized.auth, null);
});

test('normalizeSubscription rejects incomplete web and short iOS tokens', () => {
  assert.equal(normalizeSubscription({ endpoint: 'https://example.com' }), null);
  assert.equal(normalizeSubscription({ deviceToken: 'short' }, 'ios'), null);
});

test('buildCoachPushPayload keeps coach check-in copy and badge count', () => {
  const payload = buildCoachPushPayload({
    athleteId: 42,
    athleteName: 'Ada',
    unreadCount: 2,
    unreadTotal: 5
  });
  assert.equal(payload.title, 'Ny rapport mottatt');
  assert.match(payload.body, /Ada/);
  assert.equal(payload.clientId, 42);
  assert.equal(payload.unreadTotal, 5);
  assert.equal(payload.tag, 'coach-checkin-42');
});

test('extractApnsDeviceToken reads endpoint or explicit token', () => {
  assert.equal(
    extractApnsDeviceToken({ endpoint: `${APNS_ENDPOINT_PREFIX}deadbeef` }),
    'deadbeef'
  );
  assert.equal(
    extractApnsDeviceToken({ deviceToken: 'cafe babe' }),
    'cafebabe'
  );
});

test('push migration SQL files each contain a single statement for Neon HTTP', () => {
  const fs = require('node:fs');
  for (const name of [
    '007_push_subscriptions_platform.sql',
    '008_push_subscriptions_p256dh_nullable.sql',
    '009_push_subscriptions_auth_nullable.sql'
  ]) {
    const text = fs.readFileSync(path.join(__dirname, '../migrations', name), 'utf8');
    const statements = text.split(';').filter((part) => part.trim());
    assert.equal(statements.length, 1, name);
  }
});
