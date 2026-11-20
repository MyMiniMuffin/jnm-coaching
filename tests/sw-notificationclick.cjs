const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../public/sw.js'), 'utf8');

const loadWorker = (windowClients) => {
  const listeners = {};
  const opened = [];
  const self = {
    addEventListener: (type, fn) => { listeners[type] = fn; },
    registration: {},
    location: { origin: 'https://example.test' },
    clients: {
      claim: async () => {},
      matchAll: async () => windowClients,
      openWindow: async (url) => { opened.push(url); return {}; }
    },
    skipWaiting() {}
  };
  vm.runInNewContext(source, { self, URL, caches: {}, fetch: async () => ({}) });
  return { listeners, opened };
};

const makeClient = (url) => {
  const calls = [];
  return {
    url,
    calls,
    focus: async () => { calls.push(['focus']); },
    navigate: async (target) => { calls.push(['navigate', target]); },
    postMessage: (message) => calls.push(['postMessage', JSON.parse(JSON.stringify(message))])
  };
};

const click = async (listeners, data) => {
  let pending;
  let closed = false;
  listeners.notificationclick({
    notification: { data, close: () => { closed = true; } },
    waitUntil: (promise) => { pending = promise; }
  });
  await pending;
  return closed;
};

test('notification click messages the open app window and focuses it without reloading', async () => {
  const app = makeClient('https://example.test/app/');
  const { listeners, opened } = loadWorker([app]);
  assert.equal(await click(listeners, { url: '/app/', clientId: 42, clientName: 'Ada' }), true);
  assert.deepEqual(app.calls, [
    ['postMessage', { type: 'jnm-open-client', clientId: 42, clientName: 'Ada' }],
    ['focus']
  ]);
  assert.deepEqual(opened, []);
});

test('notification click opens a deep link to the athlete when no app window exists', async () => {
  const { listeners, opened } = loadWorker([makeClient('https://example.test/coaching/')]);
  await click(listeners, { url: '/app/', clientId: 42, clientName: 'Ada Lovelace' });
  assert.deepEqual(opened, ['/app/?client=42&name=Ada%20Lovelace']);
});

test('notification click without a client id just opens or focuses the app', async () => {
  const app = makeClient('https://example.test/app/');
  const first = loadWorker([app]);
  await click(first.listeners, { url: '/app/', clientId: null });
  assert.deepEqual(app.calls, [['focus']]);
  const second = loadWorker([]);
  await click(second.listeners, { url: '/app/', clientId: null });
  assert.deepEqual(second.opened, ['/app/']);
});
