import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

test('modal clearance and iOS date intrinsic sizing CSS', async () => {
    const css = await readFile(join(ROOT, 'src/index.css'), 'utf8');
    assert.match(css, /html\[data-shell="rail"\] \.modal-backdrop,[^{]*\{[^}]*padding-right: max\(1rem, var\(--app-rail-reserve\)\)/);
    assert.match(css, /html\[data-shell="narrow"\] \.modal-backdrop\s*\{[^}]*padding-bottom: max\(1rem, var\(--app-bottom-nav-reserve\)\)/);
    assert.match(css, /html\[data-native-rail="true"\] \.modal-backdrop/);
    assert.match(css, /html\[data-device="duo"\] \.modal-backdrop\s*\{[^}]*safe-area-inset-right/);
    assert.match(css, /\.text-field:has\(input\[type="date"\]\)[^{]*\{[^}]*min-inline-size: 0/);
    assert.match(css, /\.text-field > div:has\(> input\[type="date"\]\)\s*\{[^}]*overflow: hidden/);
    for (const pseudo of ['-webkit-datetime-edit', '-webkit-date-and-time-value']) {
        const block = css.slice(css.indexOf('input[type="date"]::' + pseudo)).split('}')[0];
        assert.match(block, /min-width: 0/);
        assert.match(block, /margin: 0/);
        assert.match(block, /text-align: left/);
        assert.match(block, /max-width: 100%/);
    }
});

function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i += 1) {
        crc ^= buf[i];
        for (let j = 0; j < 8; j += 1) {
            const mask = -(crc & 1);
            crc = (crc >>> 1) ^ (0xedb88320 & mask);
        }
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
    const typeBuf = Buffer.from(type);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
    return Buffer.concat([len, typeBuf, data, crc]);
}

function buildProgressPng() {
    const width = 64;
    const height = 64;
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;
    ihdr[9] = 2;
    const rows = [];
    for (let y = 0; y < height; y += 1) {
        rows.push(Buffer.from([0]));
        rows.push(Buffer.alloc(width * 3, 180));
    }
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        pngChunk('IHDR', ihdr),
        pngChunk('IDAT', deflateSync(Buffer.concat(rows))),
        pngChunk('IEND', Buffer.alloc(0)),
    ]);
}

const PROGRESS_PNG = buildProgressPng();

const COACH = {
    id: 1,
    username: 'coach_test',
    name: 'Coach Test',
    role: 'coach',
    is_archived: false,
};

const ATHLETE = {
    id: 5,
    username: 'gallery_athlete',
    name: 'Galleri Utøver',
    role: 'athlete',
    is_archived: false,
    unreadCheckins: 0,
};

const BASE_ATHLETE_DATA = {
    dietPlan: '',
    workoutPlan: '',
    stepGoal: 10000,
    totalWeeks: 4,
    startDate: '2026-08-01',
    isPaused: false,
    pausedAt: null,
    periods: [],
    currentPeriodId: null,
    startingWeight: 80,
    checkins: [],
    galleryImages: [],
};

function getFreePort() {
    return new Promise((resolve, reject) => {
        const server = createServer();
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            server.close((error) => (error ? reject(error) : resolve(port)));
        });
        server.on('error', reject);
    });
}

async function waitForUrl(url, timeoutMs = 60_000) {
    const start = Date.now();
    let lastError;
    while (Date.now() - start < timeoutMs) {
        try {
            const response = await fetch(url);
            if (response.ok) return;
            lastError = new Error(`HTTP ${response.status}`);
        } catch (error) {
            lastError = error;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`Server not ready at ${url}: ${lastError?.message || lastError}`);
}

async function ensurePreview() {
    const outDir = await mkdtemp(join(tmpdir(), 'jnm-gallery-preview-'));
    try {
        await new Promise((resolve, reject) => {
            const child = spawn('npx', ['vite', 'build', '--outDir', outDir, '--emptyOutDir'], {
                cwd: ROOT,
                stdio: ['ignore', 'ignore', 'pipe'],
            });
            let stderr = '';
            child.stderr.on('data', (chunk) => { stderr += chunk; });
            child.on('exit', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`vite build failed (${code}): ${stderr}`));
            });
        });
    } catch (error) {
        await rm(outDir, { recursive: true, force: true }).catch(() => {});
        throw error;
    }

    const port = await getFreePort();
    const base = `http://127.0.0.1:${port}`;
    const child = spawn(
        'npx',
        ['vite', 'preview', '--outDir', outDir, '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
        { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'], detached: true }
    );

    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.unref();

    const stop = async () => {
        if (child.pid) {
            try {
                process.kill(-child.pid, 'SIGTERM');
            } catch {
                try { child.kill('SIGTERM'); } catch {}
            }
            await Promise.race([
                new Promise((resolve) => child.once('exit', resolve)),
                new Promise((resolve) => setTimeout(resolve, 2000)),
            ]);
            try {
                process.kill(-child.pid, 'SIGKILL');
            } catch {
                try { child.kill('SIGKILL'); } catch {}
            }
        }
        await rm(outDir, { recursive: true, force: true }).catch(() => {});
    };

    try {
        await waitForUrl(base);
    } catch (error) {
        await stop();
        throw new Error(`${error.message}\npreview stderr: ${stderr}`);
    }

    return { base, stop };
}

async function installMocks(page) {
    const addGalleryRequests = [];
    const serverGalleryImages = [];
    let uploadSeq = 0;
    let imageIdSeq = 100;

    await page.route('https://res.cloudinary.com/**', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'image/png',
            body: PROGRESS_PNG,
        });
    });

    await page.route('**/.netlify/functions/**', async (route) => {
        const request = route.request();
        const url = request.url();

        if (url.includes('/users')) {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([COACH, ATHLETE]),
            });
        }

        if (url.includes('/upload') && request.method() === 'POST') {
            uploadSeq += 1;
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    url: `https://res.cloudinary.com/demo/image/upload/v1/gallery-${uploadSeq}.png`,
                }),
            });
        }

        if (url.includes('/data')) {
            if (request.method() === 'POST') {
                const payload = request.postDataJSON();
                if (payload?.type === 'add_gallery_image') {
                    addGalleryRequests.push(payload);
                    const imageId = imageIdSeq++;
                    serverGalleryImages.push({
                        id: imageId,
                        url: payload.data.imageUrl,
                        label: payload.data.label,
                        date: payload.data.date,
                        weight: payload.data.weight ? parseFloat(payload.data.weight) : null,
                        timestamp: Date.now(),
                    });
                    return route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({ success: true, imageId }),
                    });
                }
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ success: true }),
                });
            }

            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    ...BASE_ATHLETE_DATA,
                    galleryImages: serverGalleryImages,
                }),
            });
        }

        return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    return { addGalleryRequests };
}

async function seedCoachGallerySession(page) {
    await page.addInitScript(({ coach, athlete, data }) => {
        const now = Date.now();
        localStorage.setItem('jnm_session', JSON.stringify({
            user: coach,
            token: 'coach-token',
            expiresAt: now + 30 * 24 * 60 * 60 * 1000,
            savedAt: now,
        }));
        localStorage.setItem(
            'jnm_cache_users-list',
            JSON.stringify({ data: [coach, athlete], timestamp: now })
        );
        localStorage.setItem(
            `jnm_cache_user-data-${athlete.id}`,
            JSON.stringify({ data, timestamp: now })
        );
        localStorage.setItem('jnm_ui_state', JSON.stringify({
            userId: coach.id,
            activeTab: 'gallery',
            showWeightHistory: false,
            viewingClientId: athlete.id,
            scrollY: 0,
            savedAt: now,
        }));
    }, { coach: COACH, athlete: ATHLETE, data: BASE_ATHLETE_DATA });
}

test('Playwright: coach gallery upload respects empty, whitespace, and custom labels', { timeout: 180_000 }, async (t) => {
    let browser;
    let preview;
    try {
        preview = await ensurePreview();
    } catch (error) {
        if (process.env.CI) throw error;
        t.skip(`Could not start preview server: ${error.message}`);
        return;
    }

    try {
        browser = await chromium.launch({ headless: true });
    } catch (error) {
        await preview.stop();
        const message = `Playwright Chromium missing (${error.message}). Run: npx playwright install chromium`;
        if (process.env.CI) throw new Error(message);
        t.skip(message);
        return;
    }

    const consoleErrors = [];
    const pageErrors = [];
    let page;

    try {
        const context = await browser.newContext({
            viewport: { width: 1280, height: 800 },
            deviceScaleFactor: 1,
            locale: 'nb-NO',
        });
        page = await context.newPage();
        page.on('console', (msg) => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
        });
        page.on('pageerror', (error) => {
            pageErrors.push(error.message || String(error));
        });

        const { addGalleryRequests } = await installMocks(page);
        await seedCoachGallerySession(page);
        await page.goto(`${preview.base}/`, { waitUntil: 'networkidle' });

        const emptyUploadButton = page.getByRole('button', { name: /Last opp/ }).first();
        await emptyUploadButton.waitFor({ timeout: 15_000 });
        await emptyUploadButton.click();

        const uploadDialog = page.getByRole('dialog', { name: 'Last opp bilder' });
        await uploadDialog.waitFor({ timeout: 10_000 });

        const labelInput = uploadDialog.locator('#gallery-upload-label');
        assert.equal(await labelInput.inputValue(), '', 'upload modal should start with empty label');

        await uploadDialog.locator('#gallery-upload-files').setInputFiles({
            name: 'empty-label.png',
            mimeType: 'image/png',
            buffer: PROGRESS_PNG,
        });
        await uploadDialog.getByRole('button', { name: 'Last opp', exact: true }).click();
        await uploadDialog.waitFor({ state: 'hidden', timeout: 15_000 });

        const tiles = page.locator('main button[aria-label^="Vis "]');
        await tiles.first().waitFor({ timeout: 10_000 });
        assert.equal(addGalleryRequests.length, 1);
        assert.equal(addGalleryRequests[0].data.label, '');
        assert.equal(await tiles.nth(0).locator('span.rounded-full').count(), 0);
        assert.doesNotMatch(await tiles.nth(0).innerText(), /Startbilde/i);

        await tiles.nth(0).click();
        const lightbox = page.getByRole('dialog', { name: 'Bildevisning' });
        await lightbox.waitFor({ timeout: 15_000 });
        assert.equal(await lightbox.locator('[aria-live="polite"] p').first().textContent(), 'Fremgangsbilde');
        assert.doesNotMatch(await lightbox.innerText(), /Startbilde/i);
        await page.getByRole('button', { name: 'Lukk bildevisning' }).click();
        await lightbox.waitFor({ state: 'hidden', timeout: 5_000 });

        await page.getByRole('button', { name: 'Last opp', exact: true }).click();
        await uploadDialog.waitFor({ timeout: 10_000 });
        assert.equal(await labelInput.inputValue(), '');
        await labelInput.fill('   ');
        await uploadDialog.locator('#gallery-upload-files').setInputFiles({
            name: 'whitespace-label.png',
            mimeType: 'image/png',
            buffer: PROGRESS_PNG,
        });
        await uploadDialog.getByRole('button', { name: 'Last opp', exact: true }).click();
        await uploadDialog.waitFor({ state: 'hidden', timeout: 15_000 });

        await tiles.nth(1).waitFor({ timeout: 10_000 });
        assert.equal(addGalleryRequests.length, 2);
        assert.equal(addGalleryRequests[1].data.label, '');
        assert.equal(await tiles.nth(1).locator('span.rounded-full').count(), 0);

        await page.getByRole('button', { name: 'Last opp', exact: true }).click();
        await uploadDialog.waitFor({ timeout: 10_000 });
        await labelInput.fill('  Uke 4 forfra  ');
        await uploadDialog.locator('#gallery-upload-files').setInputFiles({
            name: 'custom-label.png',
            mimeType: 'image/png',
            buffer: PROGRESS_PNG,
        });
        await uploadDialog.getByRole('button', { name: 'Last opp', exact: true }).click();
        await uploadDialog.waitFor({ state: 'hidden', timeout: 15_000 });

        await tiles.nth(2).waitFor({ timeout: 10_000 });
        assert.equal(addGalleryRequests.length, 3);
        assert.equal(addGalleryRequests[2].data.label, 'Uke 4 forfra');

        const customTile = page.locator('main button[aria-label^="Vis Uke 4 forfra "]');
        await customTile.waitFor({ timeout: 10_000 });
        assert.equal(await customTile.locator('span.rounded-full').textContent(), 'Uke 4 forfra');

        await customTile.click();
        await lightbox.waitFor({ timeout: 15_000 });
        assert.equal(await lightbox.locator('[aria-live="polite"] p').first().textContent(), 'Uke 4 forfra');
        await page.getByRole('button', { name: 'Lukk bildevisning' }).click();
        await lightbox.waitFor({ state: 'hidden', timeout: 5_000 });

        await page.getByRole('button', { name: 'Last opp', exact: true }).click();
        await uploadDialog.waitFor({ timeout: 10_000 });
        assert.equal(await labelInput.inputValue(), '', 'reopening upload modal should reset label to empty');

        for (const viewport of [
            { width: 720, height: 1024, device: 'duo' },
            { width: 1024, height: 720, device: 'duo' },
            { width: 704, height: 1024, device: 'duo' },
            { width: 704, height: 1024, device: 'duo', native: true },
            { width: 390, height: 844, device: 'duo' },
            { width: 320, height: 568, device: 'phone' },
        ]) {
            await page.setViewportSize(viewport);
            await page.goto(`${preview.base}/?device=${viewport.device}`, { waitUntil: 'networkidle' });
            await page.getByRole('button', { name: /Last opp/ }).first().click();
            await uploadDialog.waitFor();
            if (viewport.native) {
                await page.evaluate(() => document.documentElement.setAttribute('data-duo-rail-space', 'true'));
                await page.waitForFunction(() => document.documentElement.dataset.shell === 'rail');
                await page.evaluate(() => document.documentElement.setAttribute('data-duo-rail-space', 'false'));
                await page.waitForFunction(() => document.documentElement.dataset.shell === 'narrow');
                await page.evaluate(() => {
                    document.documentElement.setAttribute('data-native-rail', 'true');
                    const rail = document.createElement('div');
                    rail.className = 'native-rail-stand-in';
                    rail.style.cssText = 'position:fixed;right:0;top:0;width:70px;height:100vh';
                    document.body.append(rail);
                });
            }
            await uploadDialog.locator('#gallery-upload-files').setInputFiles([
                {
                    name: 'IMG_20261123_very_long_filename_without_spaces_from_iphone_camera_roll_0001.heic',
                    mimeType: 'image/png',
                    buffer: PROGRESS_PNG,
                },
                {
                    name: 'IMG_20261123_second_very_long_filename_without_spaces_0002.heic',
                    mimeType: 'image/png',
                    buffer: PROGRESS_PNG,
                },
            ]);
            await page.waitForTimeout(250);

            const layout = await page.evaluate(() => {
                const dialog = document.querySelector('[role="dialog"][aria-labelledby="upload-images-title"]');
                const backdrop = dialog.parentElement;
                const form = dialog.querySelector('form');
                const dropzone = dialog.querySelector('label[for="gallery-upload-files"]');
                const labelEl = dialog.querySelector('#gallery-upload-label');
                const dateEl = dialog.querySelector('#gallery-upload-date');
                const weightEl = dialog.querySelector('#gallery-upload-weight');
                const buttons = [...form.querySelectorAll('button')];

                const dialogRect = dialog.getBoundingClientRect();
                const formStyle = getComputedStyle(form);
                const dropzoneStyle = getComputedStyle(dropzone);
                const dateStyle = getComputedStyle(dateEl);
                const boxRects = [dropzone, labelEl, dateEl, weightEl, ...buttons].map((el) => {
                    const rect = el.getBoundingClientRect();
                    return {
                        id: el.id || el.textContent?.trim(),
                        left: rect.left,
                        right: rect.right,
                        width: rect.width,
                    };
                });

                const controls = [dateEl, dialog.querySelector('button'), buttons[buttons.length - 1]];
                const controlRects = controls.map(el => {
                    el.scrollIntoView({ block: 'nearest' });
                    const r = el.getBoundingClientRect();
                    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
                });
                form.scrollTop = form.scrollHeight;
                const submitRect = buttons[buttons.length - 1].getBoundingClientRect();

                return {
                    chrome: [...document.querySelectorAll('.app-rail, .mobile-bottom-nav, .native-rail-stand-in')]
                        .filter(el => getComputedStyle(el).display !== 'none')
                        .map(el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; }),
                    controlRects,
                    portaledToBody: backdrop?.parentElement === document.body,
                    viewportWidth: window.innerWidth,
                    viewportHeight: window.innerHeight,
                    dialogRect: {
                        left: dialogRect.left,
                        right: dialogRect.right,
                        top: dialogRect.top,
                        bottom: dialogRect.bottom,
                    },
                    formOverflowX: formStyle.overflowX,
                    formOverscrollY: formStyle.overscrollBehaviorY,
                    formScrollWidth: form.scrollWidth,
                    formClientWidth: form.clientWidth,
                    dropzonePosition: dropzoneStyle.position,
                    dropzoneOverflowX: dropzoneStyle.overflowX,
                    dateAppearance: dateStyle.appearance,
                    dateDisplay: dateStyle.display,
                    dateMaxWidth: dateStyle.maxWidth,
                    dateMinWidth: dateStyle.minWidth,
                    dateBoxSizing: dateStyle.boxSizing,
                    labelWidth: labelEl.getBoundingClientRect().width,
                    dateWidth: dateEl.getBoundingClientRect().width,
                    weightWidth: weightEl.getBoundingClientRect().width,
                    boxRects,
                    submitBottomAfterScroll: submitRect.bottom,
                };
            });

            for (const chrome of layout.chrome) {
                for (const r of [layout.dialogRect, ...layout.controlRects]) {
                    assert.ok(r.right <= chrome.left + 0.5 || r.left >= chrome.right - 0.5 ||
                        r.bottom <= chrome.top + 0.5 || r.top >= chrome.bottom - 0.5,
                        `dialog/control overlaps app chrome at ${viewport.width}x${viewport.height}${viewport.native ? ' (native rail)' : ''}`);
                }
            }
            if (viewport.native) {
                assert.ok(layout.dialogRect.right <= layout.viewportWidth - 70 + 0.5,
                    'dialog must clear the 70px native rail stand-in at 704x1024');
            }
            assert.equal(layout.portaledToBody, true, 'upload dialog should portal to document.body');
            assert.ok(layout.dialogRect.left >= 0 && layout.dialogRect.right <= layout.viewportWidth + 0.5);
            assert.ok(layout.dialogRect.top >= 0 && layout.dialogRect.bottom <= layout.viewportHeight + 0.5);
            assert.equal(layout.formOverflowX, 'hidden', 'upload form should clip horizontal overflow');
            assert.equal(layout.formOverscrollY, 'contain', 'upload form should contain overscroll');
            assert.ok(layout.formScrollWidth <= layout.formClientWidth + 1, 'upload form must not overflow horizontally');
            assert.equal(layout.dropzonePosition, 'relative', 'dropzone should anchor hidden file input');
            assert.equal(layout.dropzoneOverflowX, 'hidden', 'dropzone should clip wide filenames');
            assert.equal(layout.dateAppearance, 'none', 'date input should disable native WebKit appearance');
            assert.equal(layout.dateDisplay, 'block', 'date input should render as block');
            assert.equal(layout.dateMaxWidth, '100%', 'date input should cap max-width at 100%');
            assert.equal(layout.dateMinWidth, '0px', 'date input should allow shrinking to 0');
            assert.equal(layout.dateBoxSizing, 'border-box');
            assert.ok(Math.abs(layout.dateWidth - layout.labelWidth) <= 0.5, 'date input width must match text input');
            assert.ok(Math.abs(layout.weightWidth - layout.labelWidth) <= 0.5, 'weight input width must match text input');

            for (const box of layout.boxRects) {
                assert.ok(
                    box.left >= layout.dialogRect.left - 0.5 && box.right <= layout.dialogRect.right + 0.5,
                    `${box.id} overflowed dialog horizontally at ${viewport.width}px`
                );
            }
            assert.ok(
                layout.submitBottomAfterScroll <= layout.dialogRect.bottom + 0.5,
                `submit button remained below dialog after scrolling at ${viewport.width}x${viewport.height}`
            );
        }

        assert.equal(pageErrors.length, 0, `uncaught page errors: ${pageErrors.join(' | ')}`);
        assert.equal(consoleErrors.length, 0, `console errors: ${consoleErrors.join(' | ')}`);

        await context.close();
    } catch (error) {
        const state = await page?.evaluate(() => `${location.href}\n${document.body.innerText.slice(0, 600)}`).catch(() => '');
        error.message += `\nside: ${state}\nkonsoll: ${consoleErrors.join(' | ')}\nsidefeil: ${pageErrors.join(' | ')}`;
        throw error;
    } finally {
        await browser.close();
        await preview.stop();
    }
});
