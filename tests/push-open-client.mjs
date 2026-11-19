/**
 * Coach-appen mot et mocket API: varsel-trykk åpner riktig utøver, og «lest» sendes bare
 * etter at ferske data faktisk er lastet.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let server;
let browser;
let base;

before(async () => {
    server = await createServer({
        root: ROOT,
        configFile: join(ROOT, 'vite.config.js'),
        logLevel: 'error',
        server: { host: '127.0.0.1', port: 0, strictPort: false },
    });
    await server.listen();
    base = server.resolvedUrls.local[0].replace(/\/$/, '');
    browser = await chromium.launch();
});

after(async () => {
    await browser?.close();
    await server?.close();
});

const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const openCoachApp = async ({ path = '/', dataStatus = 200 } = {}) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const dataGets = [];
    const marks = [];
    await page.addInitScript(() => {
        localStorage.setItem('jnm_session', JSON.stringify({
            user: { id: 1, username: 'coach', name: 'Coach', role: 'coach', is_archived: false },
            token: 'test-token',
            expiresAt: Date.now() + 86400000,
            savedAt: Date.now(),
        }));
    });
    await page.route('**/.netlify/functions/**', (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.pathname.endsWith('/users')) {
            return json(route, [{ id: 7, username: 'ada', name: 'Ada Lovelace', role: 'athlete', unreadCheckins: 1, is_archived: false }]);
        }
        if (url.pathname.endsWith('/data') && request.method() === 'GET') {
            dataGets.push(url.searchParams.get('id'));
            if (dataStatus !== 200) return json(route, { error: 'feil' }, dataStatus);
            return json(route, { checkins: [{ id: 30, date: '2026-01-05', timestamp: 1, weight: 80 }, { id: 22, date: '2025-12-29', timestamp: 0, weight: 81 }], periods: [], galleryImages: [] });
        }
        if (url.pathname.endsWith('/data') && request.method() === 'POST') {
            const body = request.postDataJSON();
            if (body.type === 'mark_checkins_read') marks.push(body);
            return json(route, { success: true, unreadTotal: 0 });
        }
        return json(route, {});
    });
    await page.goto(`${base}${path}`);
    return { context, page, dataGets, marks };
};

const openedAthlete = (dataGets) => dataGets.includes('7');

test('a service worker message opens the athlete and marks only the seen reports as read', async () => {
    const { context, page, dataGets, marks } = await openCoachApp();
    await page.getByText('Ada Lovelace').first().waitFor();
    await page.evaluate(() => navigator.serviceWorker.dispatchEvent(
        new MessageEvent('message', { data: { type: 'jnm-open-client', clientId: 7, clientName: 'Ada Lovelace' } })
    ));
    await page.waitForFunction(() => document.body.innerText.includes('Ada Lovelace'));
    await new Promise((resolve) => setTimeout(resolve, 800));
    assert.ok(openedAthlete(dataGets), 'GET /data?id=7 skal være kalt');
    assert.equal(marks.length, 1);
    assert.equal(marks[0].userId, 7);
    assert.equal(marks[0].data.upToId, 30);
    await context.close();
});

test('the deep link opens the athlete and is removed from the address bar', async () => {
    const { context, page, dataGets } = await openCoachApp({ path: '/?client=7&name=Ada%20Lovelace' });
    await page.waitForFunction(() => !location.search.includes('client='));
    await new Promise((resolve) => setTimeout(resolve, 800));
    assert.ok(openedAthlete(dataGets), 'GET /data?id=7 skal være kalt');
    await context.close();
});

test('a failed fresh load does not mark the reports as read', async () => {
    const { context, page, dataGets, marks } = await openCoachApp({ dataStatus: 500 });
    await page.getByText('Ada Lovelace').first().click();
    await new Promise((resolve) => setTimeout(resolve, 1500));
    assert.ok(openedAthlete(dataGets));
    assert.deepEqual(marks, []);
    await context.close();
});
