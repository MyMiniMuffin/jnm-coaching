const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  APNS_ENDPOINT_PREFIX,
  buildCoachBadgeSyncPayload,
  buildCoachPushPayload,
  extractApnsDeviceToken,
  getWebPushClient,
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
  assert.equal(payload.title, 'Ny ukesrapport');
  assert.match(payload.body, /Ada/);
  assert.match(payload.body, /ukesrapport/);
  assert.equal(payload.clientId, 42);
  assert.equal(payload.unreadTotal, 5);
  assert.equal(payload.tag, 'coach-checkin-42');
});

test('buildCoachBadgeSyncPayload syncs badge without alert copy', () => {
  assert.deepEqual(buildCoachBadgeSyncPayload(3), {
    type: 'badge-sync',
    unreadTotal: 3,
    tag: 'coach-badge-sync'
  });
  assert.deepEqual(buildCoachBadgeSyncPayload(0), {
    type: 'badge-sync',
    unreadTotal: 0,
    tag: 'coach-badge-sync'
  });
  assert.deepEqual(buildCoachBadgeSyncPayload(-2), {
    type: 'badge-sync',
    unreadTotal: 0,
    tag: 'coach-badge-sync'
  });
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

const withWebPushEnv = (env, fn) => {
  const keys = ['WEB_PUSH_PUBLIC_KEY', 'WEB_PUSH_PRIVATE_KEY', 'WEB_PUSH_SUBJECT'];
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const originalError = console.error;
  const errorCalls = [];
  console.error = (...args) => errorCalls.push(args);
  try {
    for (const key of keys) {
      if (env[key] === undefined) delete process.env[key];
      else process.env[key] = env[key];
    }
    return fn(errorCalls);
  } finally {
    console.error = originalError;
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
};

test('web-push 4 loads via require() on this Node', () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'node_modules', 'web-push', 'package.json'), 'utf8')
  );
  assert.ok(pkg.version.startsWith('4.'), `unexpected web-push version ${pkg.version}`);
  const webpush = require('web-push');
  assert.equal(typeof webpush.setVapidDetails, 'function');
  assert.equal(typeof webpush.sendNotification, 'function');
});

test('Node version supports require(esm) (>=22.12)', () => {
  const [major, minor] = process.versions.node.split('.').map(Number);
  assert.ok(major > 22 || (major === 22 && minor >= 12), `Node ${process.versions.node} is too old`);
});

test('getWebPushClient returns a working client without silent fallback', () => {
  const keys = require('web-push').generateVAPIDKeys();
  withWebPushEnv(
    {
      WEB_PUSH_PUBLIC_KEY: keys.publicKey,
      WEB_PUSH_PRIVATE_KEY: keys.privateKey,
      WEB_PUSH_SUBJECT: 'mailto:test@example.com'
    },
    (errorCalls) => {
      const client = getWebPushClient();
      assert.notEqual(client, null);
      assert.equal(typeof client.sendNotification, 'function');
      assert.equal(errorCalls.length, 0, 'console.error should not have been called');
    }
  );
});

test('getWebPushClient returns null when keys are absent', () => {
  withWebPushEnv({}, () => {
    assert.equal(getWebPushClient(), null);
  });
});
