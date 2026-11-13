/**
 * Headless Playwright-sjekk av ImageModal / react-zoom-pan-pinch v4.
 * Starter vite preview (bygger ved behov) med mock-økt og galleribilde.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdir, readdir, stat } from 'node:fs/promises';
import { createServer } from 'node:net';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ARTIFACTS = '/opt/cursor/artifacts';
const EXTERNAL_BASE = process.env.AUDIT_BASE || '';
const IMAGE_URL = 'https://cdn.example.test/gallery/progress.png';

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

/** Gyldig 256×256 grå PNG for lightbox-tester. */
function buildProgressPng() {
    const width = 256;
    const height = 256;
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

const ATHLETE = {
    id: 'athlete-zoom-1',
    username: 'zoom_athlete',
    name: 'Zoom Utøver',
    role: 'athlete',
    is_archived: false,
};

const ATHLETE_DATA = {
    dietPlan: '',
    workoutPlan: '',
    stepGoal: 10000,
    totalWeeks: 4,
    startDate: '2026-08-01',
    isPaused: false,
    pausedAt: null,
    periods: [{
        id: 'period-1',
        name: 'Test',
        startDate: '2026-08-01',
        endDate: null,
        startingWeight: 80,
        goalWeight: 75,
        isActive: true,
    }],
    currentPeriodId: 'period-1',
    startingWeight: 80,
    checkins: [],
    galleryImages: [{
        id: 'gallery-1',
        url: IMAGE_URL,
        date: '2026-10-01',
        timestamp: Date.parse('2026-10-01T12:00:00'),
        label: 'Fremgangsbilde',
        weight: 78.5,
        isGalleryImage: true,
        galleryImageId: 'gallery-1',
    }],
};

async function newestMtime(dir) {
    let newest = 0;
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            newest = Math.max(newest, await newestMtime(full));
        } else {
            newest = Math.max(newest, (await stat(full)).mtimeMs);
        }
    }
    return newest;
}

async function needsRebuild() {
    try {
        const distIndex = join(ROOT, 'dist/index.html');
        await access(distIndex);
        const distTime = (await stat(distIndex)).mtimeMs;
        const srcTime = await newestMtime(join(ROOT, 'src'));
        return srcTime > distTime;
    } catch {
        return true;
    }
}

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
    if (EXTERNAL_BASE) {
        await waitForUrl(EXTERNAL_BASE);
        return { base: EXTERNAL_BASE, stop: async () => {} };
    }

    if (await needsRebuild()) {
        await new Promise((resolve, reject) => {
            const child = spawn('npm', ['run', 'build'], {
                cwd: ROOT,
                stdio: ['ignore', 'ignore', 'pipe'],
            });
            let stderr = '';
            child.stderr.on('data', (chunk) => { stderr += chunk; });
            child.on('exit', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`npm run build failed (${code}): ${stderr}`));
            });
        });
    }

    const port = await getFreePort();
    const base = `http://127.0.0.1:${port}`;
    const child = spawn(
        'npx',
        ['vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
        { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'], detached: true }
    );

    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.unref();

    const stop = async () => {
        if (!child.pid) return;
        try {
            process.kill(-child.pid, 'SIGTERM');
        } catch {
            try { child.kill('SIGTERM'); } catch { /* gone */ }
        }
        await Promise.race([
            new Promise((resolve) => child.once('exit', resolve)),
            new Promise((resolve) => setTimeout(resolve, 2000)),
        ]);
        try {
            process.kill(-child.pid, 'SIGKILL');
        } catch {
            try { child.kill('SIGKILL'); } catch { /* gone */ }
        }
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
    await page.route('**/gallery/progress.png', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'image/png',
            body: PROGRESS_PNG,
        });
    });
    await page.route('**/.netlify/functions/**', async (route) => {
        const url = route.request().url();
        if (url.includes('/data')) {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(ATHLETE_DATA),
            });
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
}

async function seedAthlete(page) {
    await page.addInitScript(({ user, data }) => {
        localStorage.setItem('jnm_session', JSON.stringify({
            user,
            token: 'zoom-token',
            expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
            savedAt: Date.now(),
        }));
        localStorage.setItem(
            `jnm_cache_user-data-${user.id}`,
            JSON.stringify({ data, timestamp: Date.now() })
        );
    }, { user: ATHLETE, data: ATHLETE_DATA });
}

function transformScale(page) {
    return page.evaluate(() => {
        const content = document.querySelector('.lightbox-zoom-content')
            || document.querySelector('.react-transform-component');
        if (!content) return null;
        const transform = getComputedStyle(content).transform;
        if (!transform || transform === 'none') return 1;
        const match = transform.match(/matrix\(([^)]+)\)/);
        if (!match) return 1;
        return Number(match[1].split(',')[0]);
    });
}

async function waitForScale(page, predicate, timeout = 5_000) {
    await page.waitForFunction((expected) => {
        const content = document.querySelector('.lightbox-zoom-content')
            || document.querySelector('.react-transform-component');
        if (!content) return false;
        const transform = getComputedStyle(content).transform;
        let scale = 1;
        if (transform && transform !== 'none') {
            const match = transform.match(/matrix\(([^)]+)\)/);
            if (match) scale = Number(match[1].split(',')[0]);
        }
        if (expected.mode === 'gt') return scale > expected.value;
        if (expected.mode === 'near') return Math.abs(scale - expected.value) < expected.epsilon;
        return false;
    }, predicate, { timeout });
}

test('Playwright: ImageModal zoom inn/ut/reset/lukk uten console-feil', { timeout: 180_000 }, async (t) => {
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

    try {
        const context = await browser.newContext({
            viewport: { width: 1280, height: 800 },
            deviceScaleFactor: 1,
        });
        const page = await context.newPage();
        page.on('console', (msg) => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
        });
        page.on('pageerror', (error) => {
            pageErrors.push(error.message || String(error));
        });

        await installMocks(page);
        await seedAthlete(page);
        await page.goto(`${preview.base}/`, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => (
            document.querySelector('[data-testid="app-sidebar"]')
            || document.querySelector('[data-testid="mobile-bottom-nav"]')
        ));

        await page.getByRole('button', { name: 'Galleri' }).first().click();
        await page.getByRole('button', { name: /Vis Fremgangsbilde/ }).click();

        const dialog = page.getByRole('dialog', { name: 'Bildevisning' });
        await dialog.waitFor({ timeout: 15_000 });

        await page.waitForFunction(() => {
            const btn = document.querySelector('button[aria-label="Zoom inn på bildet"]');
            return btn && !btn.disabled;
        }, null, { timeout: 15_000 });

        const scaleBefore = await transformScale(page);
        assert.ok(scaleBefore !== null, 'fant zoom-content');
        assert.ok(Math.abs(scaleBefore - 1) < 0.05, `initial scale ~1, got ${scaleBefore}`);

        await page.getByRole('button', { name: 'Zoom inn på bildet' }).click();
        await waitForScale(page, { mode: 'gt', value: 1.2 });
        const scaleZoomed = await transformScale(page);
        assert.ok(scaleZoomed > 1.2, `zoomed scale > 1.2, got ${scaleZoomed}`);

        await page.getByRole('button', { name: 'Tilpass bilde til skjermen' }).click();
        await waitForScale(page, { mode: 'near', value: 1, epsilon: 0.08 });
        // Vent til reset-animasjon/UI er ferdig før gesture-tester.
        await page.getByRole('button', { name: 'Zoom inn på bildet' }).waitFor({ state: 'visible' });
        await page.waitForTimeout(350);

        const wrapperBox = await page.locator('.lightbox-zoom-wrapper').boundingBox();
        assert.ok(wrapperBox, 'lightbox wrapper box');
        const centerX = wrapperBox.x + wrapperBox.width / 2;
        const centerY = wrapperBox.y + wrapperBox.height / 2;
        await page.mouse.dblclick(centerX, centerY, { delay: 50 });
        await waitForScale(page, { mode: 'gt', value: 1.1 }, 8_000);
        const afterDoubleClick = await transformScale(page);
        assert.ok(afterDoubleClick > 1.1, `dobbeltklikk skal zoome, got ${afterDoubleClick}`);

        await page.mouse.move(centerX, centerY);
        const beforeWheel = await transformScale(page);
        await page.mouse.wheel(0, -320);
        await page.waitForFunction((prev) => {
            const content = document.querySelector('.lightbox-zoom-content')
                || document.querySelector('.react-transform-component');
            if (!content) return false;
            const transform = getComputedStyle(content).transform;
            if (!transform || transform === 'none') return false;
            const match = transform.match(/matrix\(([^)]+)\)/);
            if (!match) return false;
            return Math.abs(Number(match[1].split(',')[0]) - prev) > 0.05;
        }, beforeWheel, { timeout: 8_000 });

        try {
            await mkdir(ARTIFACTS, { recursive: true });
            await page.screenshot({
                path: join(ARTIFACTS, 'image-modal-zoom.png'),
                fullPage: false,
            });
        } catch {
            /* artefakt er valgfritt utenfor cloud-agent */
        }

        await page.getByRole('button', { name: 'Lukk bildevisning' }).click();
        await dialog.waitFor({ state: 'hidden', timeout: 5_000 });

        assert.equal(pageErrors.length, 0, `uncaught page errors: ${pageErrors.join(' | ')}`);
        assert.equal(consoleErrors.length, 0, `console errors: ${consoleErrors.join(' | ')}`);

        await context.close();
    } finally {
        await browser.close();
        await preview.stop();
    }
});
