/**
 * Regresjon: etter innsendt ukesrapport (bølge ferdig) og sletting av rapporten
 * skal autolagring av utkastet gjenopptas og overleve omlasting.
 *
 * Bruker en lokal syntetisk React-vert (tests/fixtures/checkin-draft) via Vite dev-server
 * og Playwright Chromium. Ingen produksjon, ingen nettverk utover localhost.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DRAFT_KEY = 'jnm_checkin_draft_fixture';

test('autolagring gjenopptas etter send → bølge ferdig → slett → skriv → omlast', async () => {
    const server = await createServer({
        root: ROOT,
        configFile: join(ROOT, 'vite.config.js'),
        logLevel: 'error',
        server: { host: '127.0.0.1', port: 0, strictPort: false },
    });
    await server.listen();
    const base = server.resolvedUrls.local[0].replace(/\/$/, '');
    const url = `${base}/tests/fixtures/checkin-draft/index.html`;
    let browser;
    try {
        browser = await chromium.launch();
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
        // Hold alt lokalt: blokker alt som ikke er localhost.
        await context.route((u) => !['127.0.0.1', 'localhost'].includes(u.hostname), (route) => route.abort());
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        const draft = () => page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY);

        await page.goto(url);
        const weight = page.locator('#checkin-weight');
        await weight.waitFor();

        // Send
        await weight.fill('80');
        await page.getByRole('button', { name: /Send rapport/ }).click();
        // Vent til bølgen er ferdig: kvittering i vanlig visning med slett-knapp.
        const del = page.getByRole('button', { name: 'Slett rapport' });
        await del.waitFor({ timeout: 15000 });
        await page.getByText('Rapport sendt').first().waitFor({ state: 'attached' });
        assert.equal(await page.evaluate(() => window.__submitted), 1);
        assert.equal(await draft(), null, 'innsendt utkast skal ikke gjenopprettes');

        // Slett via parent-callback (bekreftelsesdialog)
        await del.click();
        await page.getByRole('button', { name: 'Slett', exact: true }).click();
        await weight.waitFor({ timeout: 5000 });
        assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem('fixture_reports')).length), 0);

        // Skriv i det nye skjemaet: utkastet må lagres
        await weight.fill('77.5');
        const deadline = Date.now() + 3000;
        while (Date.now() < deadline && !(await draft() || '').includes('77.5')) await page.waitForTimeout(100);
        assert.match(await draft() || '', /77\.5/, 'utkastet lagres etter at rapporten er slettet');

        // Omlast: utkastet gjenopprettes
        await page.reload();
        await weight.waitFor();
        assert.equal(await weight.inputValue(), '77.5');
        assert.equal(await page.getByText('Utkast', { exact: false }).count() > 0, true, 'utkastvarsel vises');
        assert.deepEqual(errors, []);
    } finally {
        await browser?.close();
        await server.close();
    }
});
