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
    for (let step = 0; step < 10 && await page.getByRole('button', { name: 'Neste' }).count(); step++) {
        for (const field of await page.locator('textarea[required]').all()) await field.fill('To rolige økter i uken.');
        for (const field of await page.locator('select[required]').all()) await field.selectOption({ index: 1 });
        await page.getByRole('button', { name: 'Neste' }).click();
    }
    assert.equal(await page.getByRole('button', { name: 'Neste' }).count(), 0, 'kom til siste steg');
    await page.locator('#current-diet').fill('Vanlige måltider hjemme.');
    await page.locator('#other-information').fill('Nei.');
    await page.locator('input[name=consent]').check();
    return page.getByRole('button', { name: 'Send svarene' });
}

// Samler det som ble tegnet i hvert bilde, fra klikket til bølgens rot er borte fra siden.
// Utvalget tas i en oppgave rett etter bildet, ikke i requestAnimationFrame: der kan
// det lese en mellomtilstand før mikrooppgavene i bildet har kjørt.
async function recordTransition(page, send, barSelector, cardSelector) {
    await send.scrollIntoViewIfNeeded();
    const formHeightBefore = await page.evaluate(() => document.querySelector('[data-dw-layer=content]').getBoundingClientRect().height);
    await page.evaluate(([barSel, cardSel]) => {
        window.__frames = [];
        const channel = new MessageChannel();
        const sample = () => {
            const t = performance.now();
            const root = document.querySelector('[data-distortion-wave]');
            const content = document.querySelector('[data-dw-layer=content]');
            const revealed = document.querySelector('[data-dw-layer=revealed]');
            const bar = document.querySelector(barSel);
            const card = cardSel ? document.querySelector(cardSel) : null;
            window.__frames.push({
                t,
                root: Boolean(root),
                canvas: Boolean(root?.querySelector('canvas') && root.querySelector('canvas').style.display === 'block'),
                revealed: revealed ? Number(revealed.style.opacity === '' ? 1 : revealed.style.opacity) : null,
                form: content ? Number(getComputedStyle(content.firstElementChild).opacity) : null,
                formHeight: content ? content.getBoundingClientRect().height : null,
                bar: bar ? Number(getComputedStyle(bar).opacity) : null,
                barClicks: bar ? getComputedStyle(bar).pointerEvents : null,
                card: card && !root ? card.getBoundingClientRect().height : null,
            });
        };
        channel.port1.onmessage = sample;
        const frame = () => {
            channel.port2.postMessage(0);
            requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
    }, [barSelector, cardSelector]);
    await send.click();
    await page.waitForFunction(() => window.__frames.some((f) => f.revealed > 0), null, { timeout: 8000 });
    await page.waitForFunction(() => !document.querySelector('[data-distortion-wave]'), null, { timeout: 8000 });
    await page.waitForTimeout(700);
    const frames = await page.evaluate(() => window.__frames);
    const first = frames.findIndex((f) => f.revealed > 0);
    const last = frames.findIndex((f, i) => i > first && !f.root);
    assert.ok(first > 0 && last > first, `fant ikke overgangen i opptaket: ${first}..${last}`);
    return { frames, before: frames.slice(0, first), during: frames.slice(first, last), after: frames.slice(last), formHeightBefore };
}

function assertSharedBehavior({ frames, before, during }, motion) {
    assert.equal(frames[0].form, 1, 'skjemaet er fullt synlig når du klikker Send');
    assert.deepEqual(during.filter((f) => f.revealed >= 0.25 && f.form > 0), [], 'skjema og kvittering vises oppå hverandre');
    const barFrames = frames.filter((f) => f.bar !== null);
    assert.equal(barFrames[0].bar, 1, 'send-linjen er synlig når du klikker Send');
    const fading = barFrames.filter((f) => f.bar > 0 && f.bar < 1);
    assert.ok(fading.length > 0, 'send-linjen forsvinner brått, uten noe bilde med toning');
    assert.deepEqual([...new Set(fading.map((f) => f.barClicks))], ['none'], 'send-linjen tar ikke klikk mens den tones ut');
    const waved = during.some((f) => f.canvas);
    assert.equal(waved, motion === 'no-preference', motion === 'reduce' ? 'bølgen kjører selv om Reduser bevegelse er på' : 'WebGL-bølgen kjørte ikke');
    if (waved) {
        const elapsed = during.at(-1).t - during[0].t;
        assert.ok(elapsed < 2500, `bølgen bruker ${Math.round(elapsed)} ms`);
    }
    return before;
}

for (const motion of ['no-preference', 'reduce']) {
    test(`ukesrapport (${motion}): én tekst om gangen, send-linjen tones ut og skjemaet står stille`, async () => {
        const { context, page, errors } = await open('/tests/fixtures/checkin-draft/index.html', motion);
        try {
            const send = await fillWeekly(page);
            const run = await recordTransition(page, send, '.plan-save-bar');
            const before = assertSharedBehavior(run, motion);
            assert.deepEqual([...new Set(before.map((f) => Math.round(f.formHeight)))], [Math.round(run.formHeightBefore)],
                'skjemaet endrer høyde mellom klikk og overgang');
            assert.equal(await page.getByText('Rapport sendt').count() > 0, true);
            assert.deepEqual(errors, []);
        } finally {
            await context.close();
        }
    });

    test(`oppstart (${motion}): én tekst om gangen, og kortet ${motion === 'reduce' ? 'bytter høyde uten animasjon' : 'krymper mykt'}`, async () => {
        const { context, page, errors } = await open('/oppstart/', motion);
        try {
            const send = await fillOnboarding(page);
            const run = await recordTransition(page, send, '.onboarding-actions', '.onboarding-card');
            assertSharedBehavior(run, motion);
            const heights = run.after.map((f) => f.card).filter((h) => h !== null).map(Math.round);
            assert.ok(heights.length > 3, `for få bilder etter overgangen: ${heights.length}`);
            const final = heights.at(-1);
            const between = heights.filter((h) => h > final + 2);
            if (motion === 'reduce') {
                assert.deepEqual(between, [], 'kortet animeres selv om Reduser bevegelse er på');
            } else {
                assert.ok(between.length > 0, `kortet hopper rett til ${final} px`);
                assert.deepEqual(between, [...between].sort((a, b) => b - a), 'høyden synker jevnt');
            }
            assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Takk, Demo.', 'fokus på overskriften');
            assert.deepEqual(errors, []);
        } finally {
            await context.close();
        }
    });
}
