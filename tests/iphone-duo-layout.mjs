/**
 * Playwright layout checks for Duo / phone / tablet / desktop viewports.
 * Requires a running Vite server at AUDIT_BASE (default http://127.0.0.1:5173)
 * or starts `vite preview` after build when AUDIT_BASE is unset and preview is up.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { DUO_MEDIA_QUERY } = require('../src/lib/duoBreakpoint.cjs');

const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:5173';

const ATHLETE = {
    id: 'athlete-1',
    username: 'demo_athlete',
    name: 'Ada Utøver',
    role: 'athlete',
    is_archived: false,
};

const workoutPlan = JSON.stringify({
    format: 'jnm-plan',
    version: 1,
    sections: [
        {
            title: 'Dag 1 – Underkropp',
            items: [
                { text: 'Knebøy', sets: '4', reps: '6', subItems: [] },
                { text: 'Rumensk markløft', sets: '3', reps: '8', subItems: [] },
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
    checkins: [{
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
    }],
    galleryImages: [],
};

const VIEWPORTS = [
    { id: '390x844', width: 390, height: 844, expectSidebar: false },
    { id: '932x430', width: 932, height: 430, expectSidebar: false },
    { id: '744x1133', width: 744, height: 1133, expectSidebar: true },
    { id: '760x900', width: 760, height: 900, expectSidebar: true },
    { id: '900x760', width: 900, height: 760, expectSidebar: true },
    { id: '1024x768', width: 1024, height: 768, expectSidebar: true },
    { id: '1440x900', width: 1440, height: 900, expectSidebar: true },
];

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

async function clickVisibleNav(page, label) {
    const candidates = page.locator(
        `button:has-text("${label}"), a:has-text("${label}"), [role="button"]:has-text("${label}")`
    );
    const count = await candidates.count();
    for (let i = 0; i < count; i += 1) {
        const el = candidates.nth(i);
        if (await el.isVisible()) {
            await el.click();
            return;
        }
    }
    throw new Error(`Could not click nav label: ${label}`);
}

async function measureShell(page) {
    return page.evaluate((duoQuery) => {
        const sidebar = document.querySelector('.app-sidebar');
        const bottomNav = document.querySelector('.mobile-bottom-nav');
        const sidebarVisible = Boolean(
            sidebar && getComputedStyle(sidebar).display !== 'none' && sidebar.getBoundingClientRect().width > 0
        );
        const bottomVisible = Boolean(
            bottomNav && getComputedStyle(bottomNav).display !== 'none' && bottomNav.getBoundingClientRect().height > 0
        );
        const overflowX = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
        const duoMatches = window.matchMedia(duoQuery).matches;

        const targets = [];
        if (sidebarVisible) {
            sidebar.querySelectorAll('nav button').forEach((btn) => {
                const r = btn.getBoundingClientRect();
                targets.push({ kind: 'sidebar', w: r.width, h: r.height, label: btn.textContent?.trim() });
            });
        }
        if (bottomVisible) {
            bottomNav.querySelectorAll('button').forEach((btn) => {
                const r = btn.getBoundingClientRect();
                targets.push({ kind: 'bottom', w: r.width, h: r.height, label: btn.getAttribute('aria-label') || btn.textContent?.trim() });
            });
        }

        return { sidebarVisible, bottomVisible, overflowX, duoMatches, targets };
    }, DUO_MEDIA_QUERY);
}

async function measurePlan(page) {
    return page.evaluate(() => {
        const sections = [...document.querySelectorAll('section')].filter((el) =>
            el.querySelector('h3') && el.querySelector('ul, .grid')
        );
        const widths = sections.map((el) => el.getBoundingClientRect().width);
        const grid = document.querySelector('.duo-split-grid, [class*="grid-cols-2"]');
        const planRoot = [...document.querySelectorAll('div')].find((el) =>
            (el.className || '').includes('space-y-4') && el.querySelectorAll('section').length >= 2
        );
        const stacked = Boolean(planRoot && !/\bgrid\b/.test(planRoot.className));
        return {
            sectionCount: sections.length,
            widths,
            minWidth: widths.length ? Math.min(...widths) : 0,
            stacked,
            hasDuoSplitOnPlanRoot: Boolean(planRoot && planRoot.classList.contains('duo-split-grid')),
        };
    });
}

async function measureRapportTargets(page) {
    return page.evaluate(() => {
        const ratingButtons = [...document.querySelectorAll('button')].filter((btn) =>
            /^(?:[1-9]|10)$/.test((btn.textContent || '').trim())
        );
        const ratings = ratingButtons.map((btn) => {
            const r = btn.getBoundingClientRect();
            return { w: r.width, h: r.height, text: btn.textContent.trim() };
        });
        const historyButtons = [...document.querySelectorAll('button')].filter((btn) =>
            (btn.textContent || '').includes('okt') || (btn.textContent || '').includes('kg')
        );
        const history = historyButtons.slice(0, 5).map((btn) => {
            const r = btn.getBoundingClientRect();
            return { w: r.width, h: r.height };
        });
        return { ratings, history };
    });
}

test('Playwright: Duo layout across viewports', { timeout: 180_000 }, async (t) => {
    let browser;
    try {
        browser = await chromium.launch({ headless: true });
    } catch (error) {
        t.skip(`Playwright browser unavailable: ${error.message}`);
        return;
    }

    // Probe server
    try {
        const res = await fetch(BASE);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (error) {
        await browser.close();
        t.skip(`Dev server not reachable at ${BASE}: ${error.message}`);
        return;
    }

    try {
        for (const vp of VIEWPORTS) {
            await t.test(`viewport ${vp.id}`, async () => {
                const context = await browser.newContext({
                    viewport: { width: vp.width, height: vp.height },
                    deviceScaleFactor: 1,
                });
                const page = await context.newPage();
                await installMocks(page);
                await seedAthlete(page);
                await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
                await page.waitForTimeout(350);

                const shell = await measureShell(page);
                assert.equal(shell.duoMatches, vp.expectSidebar, `duo media match at ${vp.id}`);
                assert.equal(shell.sidebarVisible, vp.expectSidebar, `sidebar visibility at ${vp.id}`);
                assert.equal(shell.bottomVisible, !vp.expectSidebar, `bottom nav at ${vp.id}`);
                assert.equal(shell.overflowX, false, `no horizontal overflow at ${vp.id}`);

                if (vp.expectSidebar) {
                    for (const target of shell.targets.filter((x) => x.kind === 'sidebar')) {
                        assert.ok(target.h >= 44 - 0.5, `sidebar ${target.label} height ${target.h}`);
                    }
                } else {
                    for (const target of shell.targets.filter((x) => x.kind === 'bottom')) {
                        assert.ok(target.h >= 44 - 0.5, `bottom ${target.label} height ${target.h}`);
                        assert.ok(target.w >= 44 - 0.5, `bottom ${target.label} width ${target.w}`);
                    }
                }

                await clickVisibleNav(page, 'Trening');
                await page.waitForTimeout(300);
                const plan = await measurePlan(page);
                assert.ok(plan.sectionCount >= 2, 'plan has sections');
                assert.equal(plan.hasDuoSplitOnPlanRoot, false, 'plan root is not duo-split two-col');
                if (!plan.stacked) {
                    for (const w of plan.widths) {
                        assert.ok(w >= 280 - 1, `plan column width ${w} at ${vp.id}`);
                    }
                }

                await clickVisibleNav(page, 'Rapport');
                await page.waitForTimeout(400);
                const rapport = await measureRapportTargets(page);
                if (vp.expectSidebar && rapport.ratings.length) {
                    for (const r of rapport.ratings) {
                        assert.ok(r.h >= 44 - 0.5, `rating ${r.text} height ${r.h} at ${vp.id}`);
                        assert.ok(r.w >= 44 - 0.5, `rating ${r.text} width ${r.w} at ${vp.id}`);
                    }
                }
                if (vp.expectSidebar && rapport.history.length) {
                    for (const h of rapport.history) {
                        assert.ok(h.h >= 44 - 0.5, `history row height ${h.h} at ${vp.id}`);
                    }
                }

                const overflowAfter = await page.evaluate(
                    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
                );
                assert.equal(overflowAfter, false, `no overflow on rapport at ${vp.id}`);

                await context.close();
            });
        }

        await t.test('tab state preserved across 390 → 760 → 390 resize', async () => {
            const context = await browser.newContext({
                viewport: { width: 390, height: 844 },
                deviceScaleFactor: 1,
            });
            const page = await context.newPage();
            await installMocks(page);
            await seedAthlete(page);
            await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
            await page.waitForTimeout(300);
            await clickVisibleNav(page, 'Trening');
            await page.waitForTimeout(250);

            const activeAt390 = await page.evaluate(() => {
                const current = document.querySelector('[aria-current="page"]');
                return current?.textContent?.trim() || current?.getAttribute('aria-label') || '';
            });
            assert.match(activeAt390, /Trening/i);

            await page.setViewportSize({ width: 760, height: 900 });
            await page.waitForTimeout(350);
            const activeAt760 = await page.evaluate(() => {
                const current = document.querySelector('[aria-current="page"]');
                return current?.textContent?.trim() || current?.getAttribute('aria-label') || '';
            });
            assert.match(activeAt760, /Trening/i);
            const shell760 = await measureShell(page);
            assert.equal(shell760.sidebarVisible, true);

            await page.setViewportSize({ width: 390, height: 844 });
            await page.waitForTimeout(350);
            const activeBack = await page.evaluate(() => {
                const current = document.querySelector('[aria-current="page"]');
                return current?.textContent?.trim() || current?.getAttribute('aria-label') || '';
            });
            assert.match(activeBack, /Trening/i);
            const shell390 = await measureShell(page);
            assert.equal(shell390.sidebarVisible, false);
            assert.equal(shell390.bottomVisible, true);

            await context.close();
        });
    } finally {
        await browser.close();
    }
});
