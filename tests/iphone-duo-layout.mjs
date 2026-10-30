/**
 * Playwright layout checks for Duo / phone / tablet / desktop viewports.
 *
 * Starts `vite preview` automatically (builds if dist/ is missing) unless
 * AUDIT_BASE points at an already-running server.
 * Requires Chromium: `npx playwright install chromium`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, readdir, stat } from 'node:fs/promises';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';
import {
    DUO_MEDIA_QUERY,
    DUO_MIN_WIDTH_PX,
    DUO_MIN_HEIGHT_PX,
    DESKTOP_MIN_WIDTH_PX,
} from '../src/lib/duoBreakpoint.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXTERNAL_BASE = process.env.AUDIT_BASE || '';

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
        const configFiles = ['tailwind.config.mjs', 'vite.config.js', 'vite.config.mjs', 'index.html'];
        let configTime = 0;
        for (const file of configFiles) {
            try {
                configTime = Math.max(configTime, (await stat(join(ROOT, file))).mtimeMs);
            } catch {
                /* optional */
            }
        }
        return srcTime > distTime || configTime > distTime;
    } catch {
        return true;
    }
}

const ATHLETE = {
    id: 'athlete-1',
    username: 'demo_athlete',
    name: 'Ada Utøver',
    role: 'athlete',
    is_archived: false,
};

const LONG_URL = 'https://example.com/very/long/path/to/exercise/resource/without/spaces/SupercalifragilisticExerciseName';

const workoutPlan = JSON.stringify({
    format: 'jnm-plan',
    version: 1,
    sections: [
        {
            title: 'Dag 1 – Underkropp',
            items: [
                { text: 'Knebøy', sets: '4', reps: '6', subItems: [] },
                { text: LONG_URL, sets: '3', reps: '8', subItems: [] },
            ],
        },
        {
            title: 'Dag 2 – Overkropp',
            items: [
                { text: 'Benkpress', sets: '4', reps: '6', subItems: [] },
                { text: 'Roing', sets: '4', reps: '8', subItems: [] },
            ],
        },
    ],
});

const ATHLETE_DATA = {
    dietPlan: '',
    workoutPlan,
    stepGoal: 10000,
    totalWeeks: 12,
    startDate: '2026-08-01',
    isPaused: false,
    pausedAt: null,
    periods: [{
        id: 'period-1',
        name: 'Høst 2026',
        startDate: '2026-08-01',
        endDate: null,
        startingWeight: 78.4,
        goalWeight: 72,
        isActive: true,
    }],
    currentPeriodId: 'period-1',
    startingWeight: 78.4,
    checkins: [
        {
            id: 'c1',
            date: '2026-10-20',
            weight: 75.2,
            sleep: 7,
            energy: 8,
            accuracy: 8,
            strengthSessions: 3,
            cardioSessions: 2,
            stepsReached: true,
            takenSupplements: true,
            comment: '',
            images: [],
            periodId: 'period-1',
            readByCoach: false,
        },
        {
            id: 'c0',
            date: '2026-10-13',
            weight: 75.8,
            sleep: 6,
            energy: 6,
            accuracy: 7,
            strengthSessions: 2,
            cardioSessions: 1,
            stepsReached: false,
            takenSupplements: true,
            comment: '',
            images: [],
            periodId: 'period-1',
            readByCoach: true,
        },
    ],
    galleryImages: [],
};

const VIEWPORTS = [
    { id: '390x844', width: 390, height: 844, expectSidebar: false },
    { id: '699x800', width: 699, height: 800, expectSidebar: false },
    { id: '700x599', width: 700, height: 599, expectSidebar: false },
    { id: '700x600', width: 700, height: 600, expectSidebar: true },
    { id: '932x430', width: 932, height: 430, expectSidebar: false },
    { id: '744x1133', width: 744, height: 1133, expectSidebar: true },
    { id: '760x900', width: 760, height: 900, expectSidebar: true },
    { id: '900x760', width: 900, height: 760, expectSidebar: true },
    { id: '1024x768', width: 1024, height: 768, expectSidebar: true },
    { id: '1280x550', width: 1280, height: 550, expectSidebar: true },
    { id: '1440x900', width: 1440, height: 900, expectSidebar: true },
];

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
            token: 'audit-token',
            expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
            savedAt: Date.now(),
        }));
        localStorage.setItem(
            `jnm_cache_user-data-${user.id}`,
            JSON.stringify({ data, timestamp: Date.now() })
        );
    }, { user: ATHLETE, data: ATHLETE_DATA });
}

async function openAthlete(page, base) {
    await installMocks(page);
    await seedAthlete(page);
    await page.goto(`${base}/`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => (
        document.querySelector('[data-testid="app-sidebar"]')
        || document.querySelector('[data-testid="mobile-bottom-nav"]')
    ));
}

async function clickNav(page, name) {
    const current = page.locator('[aria-current="page"]');
    if (await current.count()) {
        const label = (await current.first().textContent())?.trim() || '';
        if (label.includes(name)) return;
    }
    await page.getByRole('button', { name }).first().click();
    await page.waitForFunction((expected) => {
        const current = document.querySelector('[aria-current="page"]');
        return Boolean(current?.textContent?.includes(expected) || current?.getAttribute('aria-label')?.includes(expected));
    }, name);
}

async function shellState(page) {
    return page.evaluate(() => {
        const sidebar = document.querySelector('[data-testid="app-sidebar"]');
        const bottomNav = document.querySelector('[data-testid="mobile-bottom-nav"]');
        const sidebarVisible = Boolean(
            sidebar
            && getComputedStyle(sidebar).display !== 'none'
            && sidebar.getBoundingClientRect().width > 0
        );
        const bottomVisible = Boolean(
            bottomNav
            && getComputedStyle(bottomNav).display !== 'none'
            && bottomNav.getBoundingClientRect().height > 0
        );
        const overflowX = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
        return {
            sidebarVisible,
            bottomVisible,
            overflowX,
            shell: document.documentElement.getAttribute('data-shell'),
        };
    });
}

test('Playwright: Duo layout across viewports', { timeout: 300_000 }, async (t) => {
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

    const { base } = preview;

    try {
        assert.match(DUO_MEDIA_QUERY, new RegExp(String(DUO_MIN_WIDTH_PX)));
        assert.match(DUO_MEDIA_QUERY, new RegExp(String(DUO_MIN_HEIGHT_PX)));
        assert.match(DUO_MEDIA_QUERY, new RegExp(String(DESKTOP_MIN_WIDTH_PX)));

        for (const vp of VIEWPORTS) {
            await t.test(`viewport ${vp.id}`, async () => {
                const context = await browser.newContext({
                    viewport: { width: vp.width, height: vp.height },
                    deviceScaleFactor: 1,
                });
                const page = await context.newPage();
                try {
                    await openAthlete(page, base);
                    const shell = await shellState(page);
                    assert.equal(shell.sidebarVisible, vp.expectSidebar, `sidebar at ${vp.id}`);
                    assert.equal(shell.bottomVisible, !vp.expectSidebar, `bottom nav at ${vp.id}`);
                    assert.equal(shell.overflowX, false, `overflow at ${vp.id}`);

                    if (vp.expectSidebar) {
                        const sidebarButtons = page.locator('[data-testid="app-sidebar"] nav button');
                        const count = await sidebarButtons.count();
                        assert.ok(count >= 5, 'sidebar nav buttons');
                        for (let i = 0; i < count; i += 1) {
                            const box = await sidebarButtons.nth(i).boundingBox();
                            assert.ok(box, 'sidebar button box');
                            assert.ok(box.height >= 43.5, `sidebar height ${box.height}`);
                        }
                    } else {
                        const bottomButtons = page.locator('[data-testid="mobile-bottom-nav"] button');
                        const count = await bottomButtons.count();
                        assert.ok(count >= 5, 'bottom nav buttons');
                        for (let i = 0; i < count; i += 1) {
                            const box = await bottomButtons.nth(i).boundingBox();
                            assert.ok(box, 'bottom button box');
                            assert.ok(box.height >= 43.5, `bottom height ${box.height}`);
                            assert.ok(box.width >= 43.5, `bottom width ${box.width}`);
                        }
                    }

                    await clickNav(page, 'Trening');
                    const planRoot = page.getByTestId('plan-sections');
                    await planRoot.waitFor();
                    const sections = page.getByTestId('plan-section');
                    assert.ok(await sections.count() >= 2, 'plan sections');

                    const geometry = await sections.evaluateAll((nodes) => nodes.map((node) => {
                        const rect = node.getBoundingClientRect();
                        return { top: rect.top, left: rect.left, width: rect.width };
                    }));
                    assert.ok(geometry[1].top > geometry[0].top + 8, 'sections stacked vertically');
                    assert.ok(Math.abs(geometry[1].left - geometry[0].left) < 8, 'sections share left edge');

                    if (vp.width <= 390) {
                        const longName = page.getByTestId('plan-exercise-name').filter({ hasText: 'example.com' });
                        await longName.first().waitFor();
                        const overflow = await longName.first().evaluate((el) => {
                            const parent = el.closest('li') || el.parentElement;
                            return parent.scrollWidth > parent.clientWidth + 1;
                        });
                        assert.equal(overflow, false, 'long exercise name does not overflow row on 390');
                    }

                    await clickNav(page, 'Rapport');
                    const ratings = page.getByTestId('rating-option');
                    await ratings.first().waitFor();
                    const ratingCount = await ratings.count();
                    assert.ok(ratingCount >= 10, `expected rating options, got ${ratingCount}`);

                    if (vp.expectSidebar) {
                        for (let i = 0; i < 10; i += 1) {
                            const box = await ratings.nth(i).boundingBox();
                            assert.ok(box, `rating ${i} box`);
                            assert.ok(box.height >= 43.5, `rating height ${box.height}`);
                            assert.ok(box.width >= 43.5, `rating width ${box.width}`);
                        }
                        // duo:grid-cols-5 until duo-lg (≥1024); then 1×10
                        const first = await ratings.nth(0).boundingBox();
                        const sixth = await ratings.nth(5).boundingBox();
                        assert.ok(first && sixth, 'rating row boxes');
                        if (vp.width < 1024) {
                            assert.ok(sixth.y > first.y + 20, 'rating wraps to second row (2×5)');
                        } else {
                            assert.ok(
                                Math.abs(sixth.y - first.y) < 8,
                                `rating is 1×10 at ≥1024 (sixth.y=${sixth.y}, first.y=${first.y})`
                            );
                        }

                        const history = page.getByTestId('checkin-history-row');
                        const historyCount = await history.count();
                        assert.ok(historyCount >= 1, `expected history rows, got ${historyCount}`);
                        for (let i = 0; i < historyCount; i += 1) {
                            const box = await history.nth(i).boundingBox();
                            assert.ok(box.height >= 43.5, `history height ${box.height}`);
                        }
                    }

                    const overflowAfter = await page.evaluate(
                        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
                    );
                    assert.equal(overflowAfter, false, `no overflow on rapport at ${vp.id}`);
                } finally {
                    await context.close();
                }
            });
        }

        await t.test('tab state preserved across 390 → 760 → 390 resize', async () => {
            const context = await browser.newContext({
                viewport: { width: 390, height: 844 },
                deviceScaleFactor: 1,
            });
            const page = await context.newPage();
            try {
                await openAthlete(page, base);
                await clickNav(page, 'Trening');
                await page.setViewportSize({ width: 760, height: 900 });
                await page.waitForFunction(() => (
                    document.querySelector('[data-testid="app-sidebar"]')
                    && getComputedStyle(document.querySelector('[data-testid="app-sidebar"]')).display !== 'none'
                ));
                await page.waitForFunction(() => (
                    document.querySelector('[aria-current="page"]')?.textContent?.includes('Trening')
                ));
                await page.setViewportSize({ width: 390, height: 844 });
                await page.waitForFunction(() => (
                    document.querySelector('[data-testid="mobile-bottom-nav"]')
                    && getComputedStyle(document.querySelector('[data-testid="mobile-bottom-nav"]')).display !== 'none'
                ));
                await page.waitForFunction(() => (
                    document.querySelector('[aria-current="page"]')?.textContent?.includes('Trening')
                    || document.querySelector('[aria-current="page"]')?.getAttribute('aria-label')?.includes('Trening')
                ));
            } finally {
                await context.close();
            }
        });

        await t.test('sidebar sticky on keyboard-like height shrink 900×760 → 900×400', async () => {
            const context = await browser.newContext({
                viewport: { width: 900, height: 760 },
                deviceScaleFactor: 1,
            });
            const page = await context.newPage();
            try {
                await openAthlete(page, base);
                await clickNav(page, 'Rapport');
                const weight = page.getByLabel(/vekt/i).first();
                await weight.waitFor();
                await weight.fill('74.5');
                assert.equal(await weight.inputValue(), '74.5');

                const before = await shellState(page);
                assert.equal(before.sidebarVisible, true);
                assert.equal(before.shell, 'wide');

                await page.setViewportSize({ width: 900, height: 400 });
                await page.waitForFunction(() => document.documentElement.getAttribute('data-shell') === 'wide');
                const after = await shellState(page);
                assert.equal(after.sidebarVisible, true, 'sidebar stays during keyboard shrink');
                assert.equal(after.bottomVisible, false, 'bottom nav stays hidden');
                assert.equal(after.shell, 'wide');
                assert.equal(await weight.inputValue(), '74.5', 'form input preserved');

                // Regression: duo: utilities stay on while sticky (not media-only).
                const ratings = page.getByTestId('rating-option');
                await ratings.first().waitFor();
                const first = await ratings.nth(0).boundingBox();
                const sixth = await ratings.nth(5).boundingBox();
                assert.ok(first && sixth, 'rating row boxes at sticky 900×400');
                assert.ok(sixth.y > first.y + 20, 'sticky rating stays 2×5 (duo:grid-cols-5)');

                const duoChrome = await page.evaluate(() => {
                    const probeInline = document.createElement('span');
                    probeInline.className = 'hidden duo:inline';
                    probeInline.textContent = 'duo-inline';
                    document.body.appendChild(probeInline);
                    const inlineDisplay = getComputedStyle(probeInline).display;
                    probeInline.remove();

                    const probeFlex = document.createElement('button');
                    probeFlex.className = 'hidden duo:inline-flex';
                    probeFlex.textContent = 'duo-flex';
                    document.body.appendChild(probeFlex);
                    const flexDisplay = getComputedStyle(probeFlex).display;
                    probeFlex.remove();

                    const save = document.querySelector('button[form="weekly-checkin-form"]');
                    const saveFlex = save ? getComputedStyle(save).flexGrow : null;

                    return {
                        duoInline: inlineDisplay === 'inline',
                        duoInlineFlex: flexDisplay === 'inline-flex',
                        saveFlexGrow: saveFlex,
                    };
                });
                assert.equal(duoChrome.duoInline, true, 'Header-style hidden duo:inline active while sticky');
                assert.equal(duoChrome.duoInlineFlex, true, 'CheckIn-style hidden duo:inline-flex active while sticky');
                assert.equal(duoChrome.saveFlexGrow, '0', 'CheckIn duo:flex-none active while sticky');
            } finally {
                await context.close();
            }
        });

        await t.test('sticky exit: 900×400 → 650×400 shows bottom nav', async () => {
            const context = await browser.newContext({
                viewport: { width: 900, height: 760 },
                deviceScaleFactor: 1,
            });
            const page = await context.newPage();
            try {
                await openAthlete(page, base);
                await page.setViewportSize({ width: 900, height: 400 });
                await page.waitForFunction(() => document.documentElement.getAttribute('data-shell') === 'wide');
                assert.equal((await shellState(page)).sidebarVisible, true);

                await page.setViewportSize({ width: 650, height: 400 });
                await page.waitForFunction(() => document.documentElement.getAttribute('data-shell') === 'narrow');
                const after = await shellState(page);
                assert.equal(after.sidebarVisible, false, 'sidebar exits below 700');
                assert.equal(after.bottomVisible, true, 'bottom nav after sticky exit');
                assert.equal(after.shell, 'narrow');
            } finally {
                await context.close();
            }
        });

        await t.test('cold start 900×400 is narrow (no sticky memory)', async () => {
            const context = await browser.newContext({
                viewport: { width: 900, height: 400 },
                deviceScaleFactor: 1,
            });
            const page = await context.newPage();
            try {
                await openAthlete(page, base);
                const shell = await shellState(page);
                assert.equal(shell.shell, 'narrow');
                assert.equal(shell.sidebarVisible, false);
                assert.equal(shell.bottomVisible, true, 'cold short viewport uses bottom nav');
            } finally {
                await context.close();
            }
        });

        await t.test('1280×550 keeps desktop sidebar', async () => {
            const context = await browser.newContext({
                viewport: { width: 1280, height: 550 },
                deviceScaleFactor: 1,
            });
            const page = await context.newPage();
            try {
                await openAthlete(page, base);
                const shell = await shellState(page);
                assert.equal(shell.sidebarVisible, true);
                assert.equal(shell.bottomVisible, false);
                assert.equal(shell.shell, 'wide');
            } finally {
                await context.close();
            }
        });
    } finally {
        if (browser) {
            await Promise.race([
                browser.close(),
                new Promise((resolve) => setTimeout(resolve, 5000)),
            ]);
        }
        if (preview) await preview.stop();
    }
});
