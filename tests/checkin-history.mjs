/**
 * Når «Tidligere rapporter» vises i ukesrapporten, for utøver og coach.
 * Syntetisk vert i tests/fixtures/checkin-draft, med rapporter i sessionStorage.
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

const isoDaysAgo = (days) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
};
const report = (id, daysAgo, weight) => ({
    id, date: isoDaysAgo(daysAgo), timestamp: Date.now() - daysAgo * 86400000, weight: String(weight),
    energy: '5', sleep: '5', accuracy: '5', strengthSessions: '0', cardioSessions: '0',
    stepsReached: false, takenSupplements: false, comment: '', images: [],
});

async function view(reports, { readonly = false } = {}) {
    const context = await browser.newContext({ viewport: { width: 880, height: 900 } });
    await context.route((u) => !['127.0.0.1', 'localhost'].includes(u.hostname), (route) => route.abort());
    const page = await context.newPage();
    await page.addInitScript((data) => sessionStorage.setItem('fixture_reports', JSON.stringify(data)), reports);
    await page.goto(`${base}/tests/fixtures/checkin-draft/index.html${readonly ? '?readonly' : ''}`);
    await page.locator('#root > *').first().waitFor();
    await page.waitForTimeout(300);
    const text = await page.locator('#root').innerText();
    await context.close();
    return {
        history: text.includes('Tidligere rapporter'),
        empty: text.includes('Ingen ukesrapporter ennå'),
        count: (text.match(/\n(\d+) rapport(?:er)?\n/) || [])[1] ?? null,
    };
}

test('utøver uten rapporter: bare skjemaet, ingen historikk', async () => {
    assert.deepEqual(await view([]), { history: false, empty: false, count: null });
});

test('utøver med rapport denne uken og to eldre: historikk med antall', async () => {
    assert.deepEqual(await view([report('a', 0, 80), report('b', 7, 80.6), report('c', 14, 81.2)]), { history: true, empty: false, count: '2' });
});

test('utøver med bare rapport denne uken: ingen tom historikk', async () => {
    assert.deepEqual(await view([report('a', 0, 80)]), { history: false, empty: false, count: null });
});

test('coach, profil uten rapporter: tomtilstand uten overskrift', async () => {
    assert.deepEqual(await view([], { readonly: true }), { history: false, empty: true, count: null });
});

test('coach, én rapport fra en tidligere uke: kortet, uten «Ingen ukesrapporter ennå»', async () => {
    assert.deepEqual(await view([report('b', 9, 80.6)], { readonly: true }), { history: false, empty: false, count: null });
});
