/**
 * Atferd for bølgeovergangen etter innsending, målt i Chromium bilde for bilde.
 * Ukesrapporten kjører i den syntetiske verten tests/fixtures/checkin-draft,
 * oppstartsskjemaet på /oppstart/ med innsendingen fanget lokalt. Ingen produksjon.
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
    browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
});

after(async () => {
    await browser?.close();
    await server?.close();
});

async function open(path, reducedMotion) {
    const context = await browser.newContext({ viewport: { width: 880, height: 760 }, reducedMotion });
    await context.route((u) => !['127.0.0.1', 'localhost'].includes(u.hostname), (route) => route.abort());
    await context.route(`${base}/`, (route) => (route.request().method() === 'POST'
        ? route.fulfill({ status: 200, body: 'ok' })
        : route.continue()));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${base}${path}`);
    return { context, page, errors };
}

async function fillWeekly(page) {
    await page.locator('#checkin-weight').fill('80');
    return page.getByRole('button', { name: /Send rapport/ });
}

async function fillOnboarding(page) {
    await page.locator('#name').fill('Demo Nord');
    for (const [id, value] of Object.entries({ email: 'demo@example.invalid', age: '30', height: '175', weight: '74.5' })) {
        await page.locator(`#${id}`).fill(value);
    }
    for (let step = 0; step < 6 && await page.getByRole('button', { name: 'Neste' }).count(); step++) {
        for (const field of await page.locator('textarea[required]').all()) await field.fill('To rolige økter i uken.');
        for (const field of await page.locator('select[required]').all()) await field.selectOption({ index: 1 });
        await page.getByRole('button', { name: 'Neste' }).click();
    }
    await page.locator('#current-diet').fill('Vanlige måltider hjemme.');
    await page.locator('#other-information').fill('Nei.');
    await page.locator('input[name=consent]').check();
    return page.getByRole('button', { name: 'Send svarene' });
}

// Samler ett utvalg per bilde fra klikket til bølgens rot er borte fra siden.
async function recordTransition(page, send, barSelector) {
    await send.scrollIntoViewIfNeeded();
    const formHeightBefore = await page.evaluate(() => document.querySelector('[data-dw-layer=content]').getBoundingClientRect().height);
    await page.evaluate((barSel) => {
        window.__frames = [];
        const opacity = (el) => (el ? Number(getComputedStyle(el).opacity) : null);
        const frame = (t) => {
            const content = document.querySelector('[data-dw-layer=content]');
            const revealed = document.querySelector('[data-dw-layer=revealed]');
            const bar = document.querySelector(barSel);
            window.__frames.push({
                t,
                root: Boolean(document.querySelector('[data-distortion-wave]')),
                revealed: revealed ? Number(revealed.style.opacity === '' ? 1 : revealed.style.opacity) : null,
                form: opacity(content?.firstElementChild),
                formHeight: content ? content.getBoundingClientRect().height : null,
                bar: opacity(bar),
                barClicks: bar ? getComputedStyle(bar).pointerEvents : null,
            });
            requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
    }, barSelector);
    await send.click();
    await page.waitForFunction(() => window.__frames.some((f) => f.revealed > 0));
    await page.waitForFunction(() => !document.querySelector('[data-distortion-wave]'), null, { timeout: 8000 });
    await page.waitForTimeout(500);
    return { frames: await page.evaluate(() => window.__frames), formHeightBefore };
}

function revealWindow(frames) {
    const first = frames.findIndex((f) => f.revealed > 0);
    const last = frames.findIndex((f, i) => i > first && !f.root);
    return frames.slice(first, last);
}

for (const motion of ['no-preference', 'reduce']) {
    test(`ukesrapport (${motion}): skjemaet er usynlig før kvitteringen er en fjerdedel synlig`, async () => {
        const { context, page, errors } = await open('/tests/fixtures/checkin-draft/index.html', motion);
        try {
            const send = await fillWeekly(page);
            const { frames } = await recordTransition(page, send, '.plan-save-bar');
            const during = revealWindow(frames);
            assert.ok(during.length > 3, `for få bilder i overgangen: ${during.length}`);
            assert.equal(frames.find((f) => f.root).form, 1, 'skjemaet er fullt synlig før innsending');
            const overlapping = during.filter((f) => f.revealed >= 0.25 && f.form > 0);
            assert.deepEqual(overlapping, [], 'skjema og kvittering vises oppå hverandre');
            assert.equal(await page.getByText('Rapport sendt').count() > 0, true);
            assert.deepEqual(errors, []);
        } finally {
            await context.close();
        }
    });
}

test('ukesrapport: send-linjen glir ut, er ikke klikkbar og skjemaet hopper ikke før bølgen', async () => {
    const { context, page, errors } = await open('/tests/fixtures/checkin-draft/index.html', 'no-preference');
    try {
        const send = await fillWeekly(page);
        const { frames, formHeightBefore } = await recordTransition(page, send, '.plan-save-bar');
        const during = revealWindow(frames);
        const beforeReveal = frames.slice(0, frames.findIndex((f) => f.revealed > 0));
        assert.deepEqual([...new Set(beforeReveal.map((f) => Math.round(f.formHeight)))], [Math.round(formHeightBefore)],
            'skjemaet endrer høyde mellom klikk og bølge');
        const barFrames = frames.filter((f) => f.bar !== null);
        assert.equal(barFrames[0].bar, 1, 'send-linjen er synlig når du klikker Send');
        const fading = barFrames.filter((f) => f.bar > 0 && f.bar < 1);
        assert.ok(fading.length > 0, 'send-linjen forsvinner brått, uten noe bilde med toning');
        assert.deepEqual([...new Set(fading.map((f) => f.barClicks))], ['none'], 'send-linjen tar ikke klikk mens den tones ut');
        const elapsed = during.at(-1).t - during[0].t;
        assert.ok(elapsed < 2500, `bølgen bruker ${Math.round(elapsed)} ms`);
        assert.deepEqual(errors, []);
    } finally {
        await context.close();
    }
});

for (const [motion, shrinks] of [['no-preference', true], ['reduce', false]]) {
    test(`oppstart (${motion}): kortet ${shrinks ? 'krymper mykt' : 'bytter uten animasjon'} til kvitteringen`, async () => {
        const { context, page, errors } = await open('/oppstart/', motion);
        try {
            const send = await fillOnboarding(page);
            await send.scrollIntoViewIfNeeded();
            await page.evaluate(() => {
                window.__cardHeights = [];
                const frame = () => {
                    const card = document.querySelector('.onboarding-card');
                    if (card && !card.matches('[data-distortion-wave]')) window.__cardHeights.push(card.getBoundingClientRect().height);
                    requestAnimationFrame(frame);
                };
                requestAnimationFrame(frame);
            });
            await send.click();
            await page.getByRole('heading', { name: 'Takk, Demo.' }).waitFor({ timeout: 8000 });
            await page.waitForFunction(() => !document.querySelector('[data-distortion-wave]'), null, { timeout: 8000 });
            await page.waitForTimeout(700);
            const heights = (await page.evaluate(() => window.__cardHeights)).map(Math.round);
            const final = heights.at(-1);
            const between = heights.filter((h) => h > final + 2);
            if (shrinks) {
                assert.ok(between.length > 0, `kortet hopper rett til ${final} px`);
                assert.deepEqual(between, [...between].sort((a, b) => b - a), 'høyden synker jevnt');
            } else {
                assert.deepEqual(between, [], 'ingen krympeanimasjon ved Reduser bevegelse');
            }
            assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Takk, Demo.', 'fokus på overskriften');
            assert.deepEqual(errors, []);
        } finally {
            await context.close();
        }
    });
}
