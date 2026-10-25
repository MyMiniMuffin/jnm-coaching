const APNS_ENDPOINT_PREFIX = 'apns:';

const normalizeWebSubscription = (subscription = {}) => {
  const endpoint = typeof subscription.endpoint === 'string' ? subscription.endpoint.trim() : '';
  const keys = subscription.keys || {};
  const p256dh = typeof keys.p256dh === 'string' ? keys.p256dh.trim() : '';
  const auth = typeof keys.auth === 'string' ? keys.auth.trim() : '';

  if (!endpoint || !p256dh || !auth || endpoint.startsWith(APNS_ENDPOINT_PREFIX)) {
    return null;
  }

  return {
    platform: 'web',
    endpoint,
    p256dh,
    auth
  };
};

const normalizeIosSubscription = (subscription = {}) => {
  const rawToken = typeof subscription.deviceToken === 'string'
    ? subscription.deviceToken
    : (typeof subscription.token === 'string' ? subscription.token : '');
  const deviceToken = rawToken.trim().replace(/\s+/g, '');

  if (!deviceToken || deviceToken.length < 32) {
    return null;
  }

  return {
    platform: 'ios',
    endpoint: `${APNS_ENDPOINT_PREFIX}${deviceToken}`,
    p256dh: null,
    auth: null
  };
};

const normalizeSubscription = (subscription = {}, platformHint) => {
  const platform = typeof platformHint === 'string'
    ? platformHint.trim().toLowerCase()
    : (typeof subscription.platform === 'string' ? subscription.platform.trim().toLowerCase() : '');

  if (platform === 'ios' || subscription.deviceToken || subscription.token) {
    return normalizeIosSubscription(subscription);
  }

  return normalizeWebSubscription(subscription);
};

const buildCoachPushPayload = ({ athleteId, athleteName, unreadCount, unreadTotal }) => {
  const title = 'Ny rapport mottatt';
  const body = unreadCount > 1
    ? `${athleteName} har nå ${unreadCount} uleste rapporter.`
    : `${athleteName} har sendt inn en ny rapport.`;
  const badge = Math.max(1, Number(unreadTotal) || Number(unreadCount) || 1);

  return {
    title,
    body,
    url: '/',
    tag: `coach-checkin-${athleteId}`,
    clientId: athleteId,
    icon: '/icon-192.png',
    badgeIcon: '/icon-192.png',
    unreadTotal: badge
  };
};

const getWebPushClient = () => {
  if (!process.env.WEB_PUSH_PUBLIC_KEY || !process.env.WEB_PUSH_PRIVATE_KEY) {
    return null;
  }

  try {
    const webpush = require('web-push');
    webpush.setVapidDetails(
      process.env.WEB_PUSH_SUBJECT || 'mailto:kontakt@perfectmorning.dev',
      process.env.WEB_PUSH_PUBLIC_KEY,
      process.env.WEB_PUSH_PRIVATE_KEY
    );
    return webpush;
  } catch (error) {
    console.error('web-push dependency mangler eller kunne ikke lastes:', error);
    return null;
  }
};

let apnProvider = null;
let apnProviderKey = null;

const getApnProvider = () => {
  const key = process.env.APNS_PRIVATE_KEY;
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  if (!key || !keyId || !teamId) return null;

  const cacheKey = `${keyId}:${teamId}:${process.env.APNS_PRODUCTION !== 'false'}`;
  if (apnProvider && apnProviderKey === cacheKey) return apnProvider;

  try {
    const apn = require('@parse/node-apn');
    apnProvider = new apn.Provider({
      token: {
        key: key.includes('\\n') ? key.replace(/\\n/g, '\n') : key,
        keyId,
        teamId
      },
      production: process.env.APNS_PRODUCTION !== 'false'
    });
    apnProviderKey = cacheKey;
    return apnProvider;
  } catch (error) {
    console.error('APNs-klient kunne ikke lastes:', error);
    return null;
  }
};

const extractApnsDeviceToken = (subscription) => {
  if (typeof subscription?.deviceToken === 'string' && subscription.deviceToken.trim()) {
    return subscription.deviceToken.trim().replace(/\s+/g, '');
  }
  const endpoint = typeof subscription?.endpoint === 'string' ? subscription.endpoint : '';
  if (endpoint.startsWith(APNS_ENDPOINT_PREFIX)) {
    return endpoint.slice(APNS_ENDPOINT_PREFIX.length).replace(/\s+/g, '');
  }
  return '';
};

const sendWebPushNotifications = async (sql, subscriptions, payload) => {
  const webpush = getWebPushClient();
  if (!webpush || !subscriptions.length) return;

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url,
    tag: payload.tag,
    clientId: payload.clientId,
    icon: payload.icon,
    badge: payload.badgeIcon,
    unreadTotal: payload.unreadTotal
  });

  await Promise.allSettled(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth
        }
      }, body);
    } catch (error) {
      const statusCode = error?.statusCode;
      console.error('Web push sending feilet:', statusCode || error?.message || error);
      if (statusCode === 404 || statusCode === 410) {
        await sql`DELETE FROM push_subscriptions WHERE endpoint = ${subscription.endpoint}`;
      }
    }
  }));
};

const sendApnsNotifications = async (sql, subscriptions, payload) => {
  const provider = getApnProvider();
  if (!provider || !subscriptions.length) return;

  const apn = require('@parse/node-apn');
  const topic = process.env.APNS_BUNDLE_ID || 'no.jnmcoaching.app';

  await Promise.allSettled(subscriptions.map(async (subscription) => {
    const deviceToken = extractApnsDeviceToken(subscription);
    if (!deviceToken) return;

    const note = new apn.Notification();
    note.topic = topic;
    note.pushType = 'alert';
    note.priority = 10;
    note.expiry = Math.floor(Date.now() / 1000) + 3600;
    note.badge = payload.unreadTotal;
    note.sound = 'default';
    note.alert = {
      title: payload.title,
      body: payload.body
    };
    note.payload = {
      clientId: payload.clientId,
      url: payload.url,
      tag: payload.tag,
      unreadTotal: payload.unreadTotal
    };
    note.threadId = payload.tag;

    try {
      const result = await provider.send(note, deviceToken);
      const failed = result?.failed || [];
      for (const failure of failed) {
        const status = failure?.status;
        const reason = failure?.response?.reason || failure?.error?.message || 'unknown';
        console.error('APNs sending feilet:', status || reason);
        if (status === 410 || reason === 'BadDeviceToken' || reason === 'Unregistered') {
          await sql`DELETE FROM push_subscriptions WHERE endpoint = ${subscription.endpoint}`;
        }
      }
    } catch (error) {
      console.error('APNs sending feilet:', error?.message || error);
    }
  }));
};

const sendCoachPushNotifications = async (sql, { athleteId, athleteName, unreadCount, unreadTotal }) => {
  try {
    const subscriptions = await sql`
      SELECT ps.endpoint, ps.p256dh, ps.auth, ps.platform
      FROM push_subscriptions ps
      INNER JOIN users u ON u.id = ps.user_id
      WHERE u.role = 'coach' AND COALESCE(u.is_archived, false) = false
    `;

    if (!subscriptions.length) return;

    const payload = buildCoachPushPayload({ athleteId, athleteName, unreadCount, unreadTotal });
    const webSubscriptions = subscriptions.filter((row) => (row.platform || 'web') !== 'ios');
    const iosSubscriptions = subscriptions.filter((row) => row.platform === 'ios');

    await Promise.all([
      sendWebPushNotifications(sql, webSubscriptions, payload),
      sendApnsNotifications(sql, iosSubscriptions, payload)
    ]);
  } catch (error) {
    console.error('Kunne ikke sende coach-pushvarsler:', error);
  }
};

const buildCoachBadgeSyncPayload = (unreadTotal) => ({
  type: 'badge-sync',
  unreadTotal: Math.max(0, Number(unreadTotal) || 0),
  tag: 'coach-badge-sync'
});

const sendWebBadgeSync = async (sql, subscriptions, unreadTotal) => {
  const webpush = getWebPushClient();
  if (!webpush || !subscriptions.length) return;

  const payload = buildCoachBadgeSyncPayload(unreadTotal);
  const body = JSON.stringify(payload);

  await Promise.allSettled(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth
        }
      }, body);
    } catch (error) {
      const statusCode = error?.statusCode;
      console.error('Web badge-sync feilet:', statusCode || error?.message || error);
      if (statusCode === 404 || statusCode === 410) {
        await sql`DELETE FROM push_subscriptions WHERE endpoint = ${subscription.endpoint}`;
      }
    }
  }));
};

const sendApnsBadgeSync = async (sql, subscriptions, unreadTotal) => {
  const provider = getApnProvider();
  if (!provider || !subscriptions.length) return;

  const apn = require('@parse/node-apn');
  const topic = process.env.APNS_BUNDLE_ID || 'no.jnmcoaching.app';
  const badge = Math.max(0, Number(unreadTotal) || 0);

  await Promise.allSettled(subscriptions.map(async (subscription) => {
    const deviceToken = extractApnsDeviceToken(subscription);
    if (!deviceToken) return;

    // Badge-only: oppdater app-ikonet uten banner/lyd etter at coach har lest.
    const note = new apn.Notification();
    note.topic = topic;
    note.pushType = 'alert';
    note.priority = 5;
    note.expiry = Math.floor(Date.now() / 1000) + 3600;
    note.badge = badge;
    note.payload = buildCoachBadgeSyncPayload(badge);
    note.contentAvailable = 1;

    try {
      const result = await provider.send(note, deviceToken);
      const failed = result?.failed || [];
      for (const failure of failed) {
        const status = failure?.status;
        const reason = failure?.response?.reason || failure?.error?.message || 'unknown';
        console.error('APNs badge-sync feilet:', status || reason);
        if (status === 410 || reason === 'BadDeviceToken' || reason === 'Unregistered') {
          await sql`DELETE FROM push_subscriptions WHERE endpoint = ${subscription.endpoint}`;
        }
      }
    } catch (error) {
      console.error('APNs badge-sync feilet:', error?.message || error);
    }
  }));
};

const syncCoachAppBadge = async (sql, unreadTotal) => {
  try {
    const subscriptions = await sql`
      SELECT ps.endpoint, ps.p256dh, ps.auth, ps.platform
      FROM push_subscriptions ps
      INNER JOIN users u ON u.id = ps.user_id
      WHERE u.role = 'coach' AND COALESCE(u.is_archived, false) = false
    `;

    if (!subscriptions.length) return;

    const webSubscriptions = subscriptions.filter((row) => (row.platform || 'web') !== 'ios');
    const iosSubscriptions = subscriptions.filter((row) => row.platform === 'ios');

    await Promise.all([
      sendWebBadgeSync(sql, webSubscriptions, unreadTotal),
      sendApnsBadgeSync(sql, iosSubscriptions, unreadTotal)
    ]);
  } catch (error) {
    console.error('Kunne ikke synke coach-app-badge:', error);
  }
};

module.exports = {
  APNS_ENDPOINT_PREFIX,
  normalizeSubscription,
  buildCoachPushPayload,
  buildCoachBadgeSyncPayload,
  extractApnsDeviceToken,
  sendCoachPushNotifications,
  syncCoachAppBadge
};
