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
    DUO_RAIL_MEDIA_QUERY,
    DUO_BOTTOM_NAV_MEDIA_QUERY,
    DUO_MIN_WIDTH_PX,
    DUO_MIN_HEIGHT_PX,
    DESKTOP_MIN_WIDTH_PX,
    DUO_UNFOLDED_MIN_WIDTH_PX,
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
            timestamp: Date.parse('2026-10-20T12:00:00'),
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
            timestamp: Date.parse('2026-10-13T12:00:00'),
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
        const rail = document.querySelector('[data-testid="app-rail"]');
        const visible = (el) => Boolean(
            el
            && getComputedStyle(el).display !== 'none'
            && el.getBoundingClientRect().width > 0
            && el.getBoundingClientRect().height > 0
        );
        const overflowX = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
        return {
            sidebarVisible: visible(sidebar),
            bottomVisible: visible(bottomNav),
            railVisible: visible(rail),
            overflowX,
            shell: document.documentElement.getAttribute('data-shell'),
            device: document.documentElement.getAttribute('data-device'),
        };
    });
}

/**
 * True when DUO_RAIL_MEDIA_QUERY would match this CSS viewport.
 * Rail: width ≤ 599 OR aspect-ratio > 1/1.
 * Bottom nav (Duo only): width ≥ 600 AND aspect ≤ 1 (unfolded upright/square).
 */
function expectDuoRail(width, height) {
    return width < DUO_UNFOLDED_MIN_WIDTH_PX || width > height;
}

async function openAthleteDuo(page, base, viewportPath = '/') {
    await installMocks(page);
    await seedAthlete(page);
    await page.addInitScript(() => {
        try { localStorage.removeItem('jnm_device_override'); } catch { /* */ }
        try { sessionStorage.removeItem('jnm_device_override'); } catch { /* */ }
    });
    const url = new URL(viewportPath, base);
    url.searchParams.set('device', 'duo');
    await page.goto(url.toString(), { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.documentElement.getAttribute('data-device') === 'duo');
    await page.waitForFunction(() => (
        document.querySelector('[data-testid="app-rail"]')
        || document.querySelector('[data-testid="mobile-bottom-nav"]')
    ));
}

async function mainContentMetrics(page) {
    return page.evaluate(() => {
        const stage = document.querySelector('[data-testid="app-stage"]') || document.querySelector('.app-stage');
        const frame = document.querySelector('.app-frame');
        const content = document.querySelector('.app-content') || document.querySelector('main');
        const rail = document.querySelector('[data-testid="app-rail"]');
        const stepGoal = Array.from(document.querySelectorAll('p')).find((el) => /10[\s\u00a0]?000/.test(el.textContent || ''));
        const stageStyle = stage ? getComputedStyle(stage) : null;
        const frameStyle = frame ? getComputedStyle(frame) : null;
        const contentRect = content?.getBoundingClientRect();
        const railRect = rail?.getBoundingClientRect();
        return {
            contentTextLen: (content?.innerText || '').trim().length,
            contentWidth: contentRect?.width || 0,
            viewportWidth: window.innerWidth,
            stagePadRight: stageStyle ? parseFloat(stageStyle.paddingRight) || 0 : 0,
            framePadRight: frameStyle ? parseFloat(frameStyle.paddingRight) || 0 : 0,
            railWidth: railRect?.width || 0,
            stepGoalText: stepGoal?.textContent?.trim() || '',
            stepGoalClipped: stepGoal
                ? stepGoal.scrollWidth > stepGoal.clientWidth + 1
                : false,
            duoProbe: (() => {
                // Use duo:inline — present in built CSS (Header). duo:block is not emitted.
                const el = document.createElement('span');
                el.className = 'hidden duo:inline';
                el.textContent = 'probe';
                document.body.appendChild(el);
                const shown = getComputedStyle(el).display === 'inline';
                el.remove();
                return shown;
            })(),
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
        assert.match(DUO_BOTTOM_NAV_MEDIA_QUERY, /max-aspect-ratio:\s*1\/1/);
        assert.match(DUO_RAIL_MEDIA_QUERY, /aspect-ratio > 1\/1/);
        assert.match(DUO_RAIL_MEDIA_QUERY, new RegExp(String(DUO_UNFOLDED_MIN_WIDTH_PX - 1)));

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

        for (const vp of [
            // Folded portrait → rail
            { id: '390x844', width: 390, height: 844 },
            // Folded landscape → rail (short height must still fit 44pt targets)
            { id: '844x390', width: 844, height: 390 },
            // Unfolded portrait (upright) → bottom nav — only Duo bottom-nav state
            { id: '760x900', width: 760, height: 900 },
            // Unfolded landscape → rail
            { id: '900x760', width: 900, height: 760 },
        ]) {
            const wantRail = expectDuoRail(vp.width, vp.height);
            await t.test(`Duo ?device=duo at ${vp.id} → ${wantRail ? 'rail' : 'narrow'}`, async () => {
                const context = await browser.newContext({
                    viewport: { width: vp.width, height: vp.height },
                    deviceScaleFactor: 1,
                });
                const page = await context.newPage();
                const pageErrors = [];
                page.on('pageerror', (error) => pageErrors.push(String(error?.message || error)));
                try {
                    await openAthleteDuo(page, base);
                    const shell = await shellState(page);
                    assert.equal(shell.device, 'duo');
                    assert.equal(shell.sidebarVisible, false, 'sidebar never on Duo');
                    assert.equal(
                        shell.shell,
                        wantRail ? 'rail' : 'narrow',
                        `shell at ${vp.id}`
                    );
                    assert.equal(shell.railVisible, wantRail, `rail visible=${wantRail}`);
                    assert.equal(shell.bottomVisible, !wantRail, `bottom nav visible=${!wantRail}`);

                    if (wantRail) {
                        const railBox = await page.getByTestId('app-rail').boundingBox();
                        assert.ok(railBox, 'rail box');
                        assert.ok(railBox.x > vp.width / 2, 'rail is on the right half');
                        // 44pt button + 4px pad + 1px border per side (54px capsule) + 12px column margin.
                        // With status-column safe-area, col can be larger — still must not overflow viewport.
                        assert.ok(railBox.width <= Math.max(120, vp.width * 0.25), `rail column w=${railBox.width}`);
                        assert.ok(
                            Math.abs(railBox.height - vp.height) < 2 || railBox.height <= vp.height,
                            `rail must fit viewport height (h=${railBox.height}, vp=${vp.height})`
                        );

                        const railFit = await page.evaluate(() => {
                            const rail = document.querySelector('[data-testid="app-rail"]');
                            const inner = document.querySelector('[data-testid="app-rail-inner"]');
                            if (!rail || !inner) return null;
                            const style = getComputedStyle(inner);
                            return {
                                overflowY: style.overflowY,
                                scrollHeight: inner.scrollHeight,
                                clientHeight: inner.clientHeight,
                                railTop: rail.getBoundingClientRect().top,
                                railBottom: rail.getBoundingClientRect().bottom,
                                vh: window.innerHeight,
                            };
                        });
                        assert.ok(railFit, 'rail fit metrics');
                        assert.ok(
                            railFit.scrollHeight <= railFit.clientHeight + 1,
                            `rail inner must not scroll (scroll=${railFit.scrollHeight}, client=${railFit.clientHeight})`
                        );
                        assert.ok(railFit.railTop >= -0.5, 'rail top in view');
                        assert.ok(railFit.railBottom <= railFit.vh + 0.5, 'rail bottom in view');

                        const tabButtons = page.locator('[data-testid="app-rail"] nav button');
                        const tabCount = await tabButtons.count();
                        assert.equal(tabCount, 5);
                        for (let i = 0; i < tabCount; i += 1) {
                            const box = await tabButtons.nth(i).boundingBox();
                            assert.ok(box.height >= 43.5, `rail tab height ${box.height}`);
                            assert.ok(box.width >= 43.5, `rail tab width ${box.width}`);
                        }

                        const metrics = await mainContentMetrics(page);
                        assert.ok(
                            metrics.contentTextLen > 40,
                            `main content must not be empty (len=${metrics.contentTextLen}) at ${vp.id}`
                        );
                        assert.ok(metrics.stagePadRight > 40, `stage padding-right ${metrics.stagePadRight}`);
                        assert.equal(metrics.framePadRight, 0, 'app-frame must not also pad for rail');
                        assert.ok(
                            metrics.stagePadRight >= metrics.railWidth + 7,
                            `stage pad ${metrics.stagePadRight} should include ≥8px gap beyond rail ${metrics.railWidth}`
                        );
                        const widthRatio = metrics.contentWidth / vp.width;
                        assert.ok(
                            widthRatio > 0.72,
                            `content width ratio ${widthRatio.toFixed(3)} (w=${metrics.contentWidth})`
                        );

                        const overlap = await page.evaluate(() => {
                            const rail = document.querySelector('[data-testid="app-rail"]');
                            const railRect = rail.getBoundingClientRect();
                            const content = document.querySelector('.app-content') || document.querySelector('main');
                            if (!content) return false;
                            const contentRect = content.getBoundingClientRect();
                            return contentRect.right > railRect.left + 2;
                        });
                        assert.equal(overlap, false, 'content does not overlap rail');

                        if (vp.width < 700) {
                            assert.equal(metrics.duoProbe, false, 'duo: density off at closed Duo width');
                            assert.match(metrics.stepGoalText, /10[\s\u00a0]?000/);
                            assert.equal(metrics.stepGoalClipped, false, 'step goal must not clip at 390');
                        } else {
                            assert.equal(metrics.duoProbe, true, 'duo: density on for rail ≥700');
                        }

                        // Weight history → rail back → dashboard (skip on very short landscape if cramped)
                        await clickNav(page, 'Hjem');
                        await page.getByText('Se historikk', { exact: true }).click();
                        await page.waitForSelector('[data-testid="weight-progress-view"]');
                        await page.waitForSelector('[data-testid="app-rail-back"]');
                        assert.equal(await page.getByTestId('weight-progress-back').count(), 0, 'no double back in rail');
                        const back = page.getByTestId('app-rail-back');
                        const backBox = await back.boundingBox();
                        assert.ok(backBox.height >= 43.5 && backBox.width >= 43.5, 'rail back ≥44');
                        assert.ok(backBox.y + backBox.height <= vp.height + 0.5, 'back pill inside viewport');
                        await back.click();
                        await page.waitForFunction(() => !document.querySelector('[data-testid="app-rail-back"]'));
                        await page.waitForFunction(() => !document.querySelector('[data-testid="weight-progress-view"]'));
                        const afterBack = await mainContentMetrics(page);
                        assert.ok(
                            afterBack.contentTextLen > 40,
                            `dashboard content empty after rail back (len=${afterBack.contentTextLen})`
                        );
                        assert.match(afterBack.stepGoalText, /10[\s\u00a0]?000/);
                    } else {
                        const bottomButtons = page.locator('[data-testid="mobile-bottom-nav"] button');
                        const count = await bottomButtons.count();
                        assert.ok(count >= 5, 'bottom nav buttons on unfolded upright Duo');
                        for (let i = 0; i < count; i += 1) {
                            const box = await bottomButtons.nth(i).boundingBox();
                            assert.ok(box, 'bottom button box');
                            assert.ok(box.height >= 43.5, `bottom height ${box.height}`);
                            assert.ok(box.width >= 43.5, `bottom width ${box.width}`);
                        }
                        const metrics = await mainContentMetrics(page);
                        assert.ok(
                            metrics.contentTextLen > 40,
                            `main content must not be empty (len=${metrics.contentTextLen}) at ${vp.id}`
                        );

                        // Header gutter must match content column (shared --app-gutter-x).
                        const align = await page.evaluate(() => {
                            const header = document.querySelector('header .header-inner');
                            const content = document.querySelector('.app-content') || document.querySelector('main');
                            if (!header || !content) return null;
                            const hs = getComputedStyle(header);
                            const cs = getComputedStyle(content);
                            const hr = header.getBoundingClientRect();
                            const cr = content.getBoundingClientRect();
                            const headerLeft = hr.left + Number.parseFloat(hs.paddingLeft || '0');
                            const headerRight = hr.right - Number.parseFloat(hs.paddingRight || '0');
                            const contentLeft = cr.left + Number.parseFloat(cs.paddingLeft || '0');
                            const contentRight = cr.right - Number.parseFloat(cs.paddingRight || '0');
                            return {
                                headerLeft,
                                headerRight,
                                contentLeft,
                                contentRight,
                                headerMaxWidth: hs.maxWidth,
                                headerWidth: hr.width,
                                viewportWidth: window.innerWidth,
                            };
                        });
                        assert.ok(align, 'header/content align metrics');
                        assert.ok(
                            Math.abs(align.headerLeft - align.contentLeft) < 1.5,
                            `header left ${align.headerLeft} vs content left ${align.contentLeft}`
                        );
                        assert.ok(
                            Math.abs(align.headerRight - align.contentRight) < 1.5,
                            `header right ${align.headerRight} vs content right ${align.contentRight}`
                        );
                        assert.ok(
                            align.headerWidth > align.viewportWidth * 0.9,
                            `header-inner must span content column (w=${align.headerWidth}, vp=${align.viewportWidth})`
                        );
                        assert.notEqual(align.headerMaxWidth, '448px', 'no phone 28rem header lock');
                    }

                    assert.equal(
                        pageErrors.some((msg) => /Maximum update depth|Too many re-renders/i.test(msg)),
                        false,
                        `render loop: ${pageErrors.join(' | ')}`
                    );

                    const stored = await page.evaluate(() => ({
                        local: localStorage.getItem('jnm_device_override'),
                        session: sessionStorage.getItem('jnm_device_override'),
                    }));
                    assert.equal(stored.local, null, 'device override must not use localStorage');
                    assert.equal(stored.session, 'duo');
                } finally {
                    await context.close();
                }
            });
        }

        await t.test('Duo tab + scroll survive rail ↔ bottom-nav resize', async () => {
            const context = await browser.newContext({
                viewport: { width: 900, height: 760 },
                deviceScaleFactor: 1,
            });
            const page = await context.newPage();
            try {
                await openAthleteDuo(page, base);
                assert.equal((await shellState(page)).shell, 'rail');
                await clickNav(page, 'Trening');
                await page.getByTestId('plan-sections').waitFor();
                await page.evaluate(() => window.scrollTo(0, 120));

                // Unfolded upright → bottom nav
                await page.setViewportSize({ width: 760, height: 900 });
                await page.waitForFunction(() => document.documentElement.getAttribute('data-shell') === 'narrow');
                const portrait = await shellState(page);
                assert.equal(portrait.bottomVisible, true);
                assert.equal(portrait.railVisible, false);
                assert.equal(portrait.sidebarVisible, false);
                await page.waitForFunction(() => (
                    document.querySelector('[aria-current="page"]')?.textContent?.includes('Trening')
                ));

                // Folded portrait → rail again
                await page.setViewportSize({ width: 390, height: 844 });
                await page.waitForFunction(() => document.documentElement.getAttribute('data-shell') === 'rail');
                assert.equal((await shellState(page)).railVisible, true);
                await page.waitForFunction(() => (
                    document.querySelector('[aria-current="page"]')?.textContent?.includes('Trening')
                ));

                // Unfolded landscape → rail
                await page.setViewportSize({ width: 900, height: 760 });
                await page.waitForFunction(() => document.documentElement.getAttribute('data-shell') === 'rail');
                const landscape = await shellState(page);
                assert.equal(landscape.railVisible, true);
                assert.equal(landscape.bottomVisible, false);
                await page.waitForFunction(() => (
                    document.querySelector('[aria-current="page"]')?.textContent?.includes('Trening')
                ));
            } finally {
                await context.close();
            }
        });

        await t.test('390×844 without device=duo keeps bottom nav', async () => {
            const context = await browser.newContext({
                viewport: { width: 390, height: 844 },
                deviceScaleFactor: 1,
            });
            const page = await context.newPage();
            try {
                await page.addInitScript(() => {
                    try { localStorage.removeItem('jnm_device_override'); } catch { /* */ }
                    try { sessionStorage.removeItem('jnm_device_override'); } catch { /* */ }
                });
                await openAthlete(page, base);
                const shell = await shellState(page);
                assert.equal(shell.shell, 'narrow');
                assert.equal(shell.bottomVisible, true);
                assert.equal(shell.railVisible, false);
                assert.equal(shell.sidebarVisible, false);
            } finally {
                await context.close();
            }
        });

        await t.test('1024×768 without device=duo keeps left sidebar', async () => {
            const context = await browser.newContext({
                viewport: { width: 1024, height: 768 },
                deviceScaleFactor: 1,
            });
            const page = await context.newPage();
            try {
                await page.addInitScript(() => {
                    try { localStorage.removeItem('jnm_device_override'); } catch { /* */ }
                    try { sessionStorage.removeItem('jnm_device_override'); } catch { /* */ }
                });
                await openAthlete(page, base);
                const shell = await shellState(page);
                assert.equal(shell.shell, 'wide');
                assert.equal(shell.sidebarVisible, true);
                assert.equal(shell.railVisible, false);
                assert.equal(shell.bottomVisible, false);
            } finally {
                await context.close();
            }
        });

        await t.test('1024×768 with device=duo keeps rail (not sidebar)', async () => {
            const context = await browser.newContext({
                viewport: { width: 1024, height: 768 },
                deviceScaleFactor: 1,
            });
            const page = await context.newPage();
            try {
                await openAthleteDuo(page, base);
                const shell = await shellState(page);
                assert.equal(shell.shell, 'rail');
                assert.equal(shell.railVisible, true);
                assert.equal(shell.sidebarVisible, false);
                assert.equal(shell.bottomVisible, false);
                const metrics = await mainContentMetrics(page);
                assert.ok(metrics.contentTextLen > 40, '1024 duo rail content not empty');
                assert.equal(metrics.duoProbe, true, 'duo density on at 1024 rail');
            } finally {
                await context.close();
            }
        });

        await t.test('760×900 with device=duo stays narrow (sticky cannot force rail)', async () => {
            const context = await browser.newContext({
                viewport: { width: 900, height: 760 },
                deviceScaleFactor: 1,
            });
            const page = await context.newPage();
            try {
                await openAthleteDuo(page, base);
                assert.equal((await shellState(page)).shell, 'rail');
                await page.setViewportSize({ width: 760, height: 900 });
                await page.waitForFunction(() => document.documentElement.getAttribute('data-shell') === 'narrow');
                const after = await shellState(page);
                assert.equal(after.shell, 'narrow');
                assert.equal(after.bottomVisible, true);
                assert.equal(after.railVisible, false);
                assert.equal(after.sidebarVisible, false, 'Duo never gets left sidebar');
            } finally {
                await context.close();
            }
        });

        // Real Duo sizes: inner 951×669 ↔ outer 466×678. Each fold is a resize;
        // syncDom used to re-set data-device on every resize, re-triggering its
        // own MutationObserver forever and freezing the page.
        // Outer 466×678 folded portrait → rail; inner 951×669 unfolded landscape → rail.
        await t.test('Duo fold/unfold resize keeps the page responsive', async () => {
            const context = await browser.newContext({
                viewport: { width: 951, height: 669 },
                deviceScaleFactor: 1,
            });
            const page = await context.newPage();
            try {
                await openAthleteDuo(page, base);
                for (const [width, height] of [[466, 678], [951, 669], [466, 678], [760, 900]]) {
                    const expected = expectDuoRail(width, height) ? 'rail' : 'narrow';
                    await page.setViewportSize({ width, height });
                    const state = await Promise.race([
                        page.waitForFunction(
                            ({ w, shell }) => (
                                window.innerWidth === w
                                && document.documentElement.getAttribute('data-shell') === shell
                            ),
                            { w: width, shell: expected },
                            { timeout: 3000 }
                        ).then(() => page.evaluate(() => ({
                            width: window.innerWidth,
                            shell: document.documentElement.getAttribute('data-shell'),
                            railMq: window.matchMedia('(max-width: 599px), (aspect-ratio > 1/1)').matches,
                        }))),
                        new Promise((resolve) => setTimeout(() => resolve(null), 3500)),
                    ]);
                    assert.ok(state, `page hung after resize to ${width}×${height} (expected ${expected})`);
                    assert.equal(state.width, width);
                    assert.equal(state.shell, expected, `shell at ${width}×${height} (railMq=${state.railMq})`);
                }
            } finally {
                await context.close();
            }
        });

        await t.test('device=phone override clears data-device and does not leak to localStorage', async () => {
            const context = await browser.newContext({
                viewport: { width: 760, height: 900 },
                deviceScaleFactor: 1,
            });
            const page = await context.newPage();
            try {
                await installMocks(page);
                await seedAthlete(page);
                await page.addInitScript(() => {
                    try {
                        localStorage.setItem('jnm_device_override', 'duo');
                        sessionStorage.removeItem('jnm_device_override');
                    } catch { /* */ }
                });
                const url = new URL('/', base);
                url.searchParams.set('device', 'phone');
                await page.goto(url.toString(), { waitUntil: 'networkidle' });
                await page.waitForFunction(() => (
                    document.querySelector('[data-testid="app-sidebar"]')
                    || document.querySelector('[data-testid="mobile-bottom-nav"]')
                ));
                const state = await page.evaluate(() => ({
                    shell: document.documentElement.getAttribute('data-shell'),
                    device: document.documentElement.getAttribute('data-device'),
                    local: localStorage.getItem('jnm_device_override'),
                    session: sessionStorage.getItem('jnm_device_override'),
                }));
                assert.notEqual(state.shell, 'rail');
                assert.equal(state.device, null, 'phone override must remove data-device');
                assert.equal(state.local, null, 'legacy localStorage override cleared');
                assert.equal(state.session, 'phone');
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
