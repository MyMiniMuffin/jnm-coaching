/**
 * Fraunces på overskrifter og Allo på resten, lastet fra appen selv på hver side.
 * Kjører Vite lokalt og Chromium. Alt utenfor localhost blokkeres og registreres.
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

for (const [name, path, heading] of [
    ['innlogging', '/', 'JNM Coaching'],
    ['oppstart', '/oppstart/', 'La oss bygge et godt utgangspunkt'],
    ['landingsside', '/coaching/', 'En plan du kan følge'],
    ['personvern', '/personvern/', 'Personvern'],
]) {
    test(`${name}: overskriften er Fraunces, teksten Allo, og begge lastes lokalt`, async () => {
        const context = await browser.newContext({ viewport: { width: 1265, height: 820 } });
        const external = [];
        await context.route((u) => !['127.0.0.1', 'localhost'].includes(u.hostname), (route) => {
            external.push(route.request().url());
            return route.abort();
        });
        const fontResponses = [];
        const page = await context.newPage();
        page.on('response', (r) => { if (r.request().resourceType() === 'font') fontResponses.push([new URL(r.url()).pathname, r.status()]); });
        try {
            await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
            const h = page.getByRole('heading', { level: 1, name: heading });
            await h.waitFor();
            const result = await page.evaluate(async (text) => {
                await document.fonts.ready;
                const h1 = [...document.querySelectorAll('h1')].find((el) => el.textContent.replace(/\s+/g, ' ').trim() === text);
                const first = (el) => getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim();
                const loaded = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, ''));
                return { heading: first(h1), body: first(document.body), loaded: [...new Set(loaded)].sort() };
            }, heading);
            assert.deepEqual(result, { heading: 'Fraunces', body: 'Allo', loaded: ['Allo', 'Fraunces'] });
            assert.deepEqual(fontResponses.filter(([, status]) => status !== 200), [], 'en font lastet ikke');
            assert.deepEqual(external.filter((u) => /fonts\.(googleapis|gstatic)\.com/.test(u)), [], 'siden henter fonter fra Google');
        } finally {
            await context.close();
        }
    });
}
