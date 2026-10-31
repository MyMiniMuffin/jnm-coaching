import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import {
    DUO_MIN_WIDTH_PX,
    DUO_MIN_HEIGHT_PX,
    DESKTOP_MIN_WIDTH_PX,
    DUO_UNFOLDED_MIN_WIDTH_PX,
    DUO_MEDIA_QUERY,
    DUO_RAIL_MEDIA_QUERY,
    DUO_BOTTOM_NAV_MEDIA_QUERY,
} from '../src/lib/duoBreakpoint.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8');

/** Longest-prefix map from utility stem → property family (specificity conflicts). */
const PROP_PREFIXES = [
    'grid-cols', 'col-span', 'max-w', 'min-w', 'min-h', 'max-h',
    'px', 'py', 'pt', 'pb', 'pl', 'pr', 'p',
    'mx', 'my', 'mt', 'mb', 'ml', 'mr', 'm',
    'gap-x', 'gap-y', 'gap', 'space-y', 'space-x',
    'w', 'h', 'bg', 'border', 'rounded', 'opacity',
    'items', 'justify', 'self', 'leading', 'font', 'tracking',
    'shadow', 'ring', 'z', 'overflow', 'top', 'bottom', 'left', 'right', 'inset',
];

const DISPLAY_BASES = new Set(['flex', 'grid', 'hidden', 'block', 'inline', 'inline-flex', 'contents']);
const RESP_BPS = new Set(['md', 'lg', 'xl', '2xl']);
const INTERACTIVE = new Set(['hover', 'focus', 'focus-within', 'focus-visible', 'active', 'disabled', 'group-hover']);
const TOKEN_RE = /(?:[a-z0-9@_-]+:)*[a-z0-9@_./\[\]%-]+/g;

const propFamily = (base) => {
    if (DISPLAY_BASES.has(base)) return 'display';
    if (base === 'flex-none' || base === 'flex-1' || base.startsWith('flex-')) return 'flex';
    // text-* alignment vs text-sm size: only treat text-{left,right,center,justify,start,end} as text-align
    if (/^text-(left|right|center|justify|start|end)$/.test(base)) return 'text-align';
    if (base.startsWith('text-')) return 'font-size/color';
    for (const prefix of PROP_PREFIXES) {
        if (base === prefix || base.startsWith(`${prefix}-`) || base.startsWith(`${prefix}[`)) {
            return prefix;
        }
    }
    return null;
};

const walkSrcFiles = (dir, out = []) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walkSrcFiles(full, out);
        else if (/\.(jsx?|tsx?)$/.test(entry.name)) out.push(full);
    }
    return out;
};

const findDuoSpecificityConflicts = () => {
    const conflicts = [];
    for (const file of walkSrcFiles(join(root, 'src'))) {
        const text = readFileSync(file, 'utf8');
        const rel = relative(root, file);
        for (const match of text.matchAll(
            /className\s*=\s*(?:\{`([\s\S]*?)`\}|"([^"]*)"|'([^']*)'|\{"([^"]*)"\})/g
        )) {
            const raw = match[1] ?? match[2] ?? match[3] ?? match[4] ?? '';
            const line = text.slice(0, match.index).split('\n').length;
            for (const chunk of raw.split(/\$\{[\s\S]*?\}/)) {
                const byProp = new Map();
                for (const token of chunk.match(TOKEN_RE) || []) {
                    const parts = token.split(':');
                    const base = parts.at(-1);
                    const variants = new Set(parts.slice(0, -1));
                    const prop = propFamily(base);
                    if (!prop) continue;
                    if (!byProp.has(prop)) byProp.set(prop, []);
                    byProp.get(prop).push({ token, variants });
                }
                for (const [prop, items] of byProp) {
                    const duo = items.filter((i) => i.variants.has('duo') && !i.variants.has('duo-lg'));
                    const resp = items.filter((i) => (
                        [...i.variants].some((v) => RESP_BPS.has(v))
                        && !i.variants.has('duo')
                        && !i.variants.has('duo-lg')
                    ));
                    const interactive = items.filter((i) => [...i.variants].some((v) => INTERACTIVE.has(v)));
                    if (duo.length && resp.length) {
                        conflicts.push({
                            file: rel,
                            line,
                            prop,
                            kind: 'md/lg/xl',
                            duo: duo.map((i) => i.token),
                            other: resp.map((i) => i.token),
                        });
                    }
                    // duo:bg/text vs hover:/focus:/disabled: on same property family
                    if (duo.length && interactive.length && (prop === 'bg' || prop.startsWith('font') || prop === 'font-size/color')) {
                        const duoColor = duo.filter((i) => /^(bg|text)-/.test(i.token.split(':').at(-1)));
                        const interColor = interactive.filter((i) => /^(bg|text)-/.test(i.token.split(':').at(-1)));
                        if (duoColor.length && interColor.length) {
                            conflicts.push({
                                file: rel,
                                line,
                                prop,
                                kind: 'interactive',
                                duo: duoColor.map((i) => i.token),
                                other: interColor.map((i) => i.token),
                            });
                        }
                    }
                }
            }
        }
    }
    return conflicts;
};

test('duoBreakpoint is the single source for Duo media query', () => {
    assert.equal(DUO_MIN_WIDTH_PX, 700);
    assert.equal(DUO_MIN_HEIGHT_PX, 600);
    assert.equal(DESKTOP_MIN_WIDTH_PX, 1024);
    assert.equal(
        DUO_MEDIA_QUERY,
        '(min-width: 700px) and (min-height: 600px), (min-width: 1024px)'
    );
    assert.equal(DUO_UNFOLDED_MIN_WIDTH_PX, 600);
    assert.equal(
        DUO_BOTTOM_NAV_MEDIA_QUERY,
        '(min-width: 600px) and (max-aspect-ratio: 1/1)'
    );
    assert.equal(
        DUO_RAIL_MEDIA_QUERY,
        '(max-width: 599px), (aspect-ratio > 1/1)'
    );
    assert.equal(existsSync(join(root, 'src/lib/duoBreakpoint.cjs')), false);
    assert.equal(existsSync(join(root, 'tailwind.config.js')), false);
    assert.equal(existsSync(join(root, 'tailwind.config.mjs')), true);
    assert.equal(existsSync(join(root, 'src/lib/shellMode.js')), true);
});

test('tailwind duo is wide always, rail only at min-width 700', () => {
    const config = read('tailwind.config.mjs');
    assert.match(config, /DUO_MIN_WIDTH_PX/);
    assert.match(config, /html\[data-shell="wide"\] &/);
    assert.match(config, /html\[data-shell="rail"\] &/);
    assert.match(config, /min-width: \$\{DUO_MIN_WIDTH_PX\}px/);
    assert.match(config, /addVariant\(\s*['"]duo-lg['"]/);
    assert.doesNotMatch(config, /screens:\s*\{[^}]*duo:/s);
    assert.doesNotMatch(config, /raw:\s*DUO_MEDIA_QUERY/);
    assert.doesNotMatch(config, /PHONE_CHROME/);
});

test('useDesktop reads shared shellMode store (no per-instance sticky)', () => {
    const hooks = read('src/hooks.jsx');
    const shell = read('src/lib/shellMode.js');
    assert.match(hooks, /from '\.\/lib\/duoBreakpoint'/);
    assert.match(hooks, /from '\.\/lib\/shellMode'/);
    assert.match(hooks, /export const DESKTOP_QUERY = DUO_MEDIA_QUERY/);
    assert.match(hooks, /export const useDesktop = \(\) => useShellWide\(\)/);
    assert.doesNotMatch(hooks, /data-duo-shell/);
    assert.doesNotMatch(hooks, /previousWide|setIsDesktop|matchMedia/);
    assert.doesNotMatch(hooks, /horizontal-viewport-segments/);
    assert.doesNotMatch(hooks, /PHONE_CHROME/);
    assert.match(shell, /useSyncExternalStore/);
    assert.match(shell, /data-shell/);
    assert.match(shell, /DUO_MIN_WIDTH_PX/);
    assert.match(shell, /computeWide/);
});

test('index.css wide shell is attribute-only (no mirrored media / data-duo-shell)', () => {
    const css = read('src/index.css');
    assert.doesNotMatch(
        css,
        /@media \(min-width: 700px\) and \(min-height: 600px\), \(min-width: 1024px\)/
    );
    assert.doesNotMatch(css, /data-duo-shell/);
    assert.doesNotMatch(css, /:not\(\[data-duo-shell\]\)/);
    assert.match(css, /html\[data-shell="wide"\] \.app-sidebar/);
    assert.match(css, /html\[data-shell="narrow"\]/);
    assert.match(css, /--fold-gap:\s*1\.25rem/);
    assert.match(css, /\.duo-split-grid/);
    assert.doesNotMatch(css, /horizontal-viewport-segments/);
    assert.doesNotMatch(css, /viewport-segment-left/);
    assert.match(css, /html\[data-shell="wide"\] \.app-sidebar \{[\s\S]*?width:\s*12\.5rem/);
    assert.match(css, /html\[data-shell="wide"\] \.app-frame-nav \.plan-save-bar \{[\s\S]*?left:\s*12\.5rem/);
    assert.match(css, /@media \(min-width: 1024px\)[\s\S]*?html\[data-shell="wide"\] \.app-sidebar \{[\s\S]*?width:\s*15\.5rem/);
    assert.match(css, /@media \(min-width: 640px\) and \(max-width: 699px\)/);
});

test('index.css and gallery keep horizontal safe-area insets', () => {
    const css = read('src/index.css');
    const gallery = read('src/views/GalleryView.jsx');
    assert.match(
        css,
        /\.app-frame,\s*\.mobile-bottom-nav \{[\s\S]*?padding-left:\s*env\(safe-area-inset-left/
    );
    assert.match(gallery, /pl-\[env\(safe-area-inset-left,0px\)\]/);
    assert.match(gallery, /pr-\[env\(safe-area-inset-right,0px\)\]/);
});

test('shellMode sticky uses duoBreakpoint thresholds', () => {
    const shell = read('src/lib/shellMode.js');
    assert.match(shell, new RegExp(`DUO_MIN_WIDTH_PX`));
    assert.match(shell, /mediaMatches\(\)/);
    assert.match(shell, /railSpaceMatches\(\)|DUO_RAIL_MEDIA_QUERY/);
    assert.match(shell, /innerWidth < DUO_MIN_WIDTH_PX/);
    assert.match(shell, /const changed = nextSticky !== wideSticky \|\| nextShell !== shell/);
    assert.match(shell, /import\.meta\.hot\?\.dispose/);
    assert.match(shell, /SHELL_RAIL/);
    assert.match(shell, /getShellWide = \(\) => shell === SHELL_WIDE/);
    assert.match(shell, /isDuoRailSpace/);
    assert.doesNotMatch(shell, /screen\.orientation|window\.orientation/);
    assert.equal(DUO_MIN_WIDTH_PX, 700);
    assert.equal(DUO_MIN_HEIGHT_PX, 600);
    assert.equal(DESKTOP_MIN_WIDTH_PX, 1024);
});

test('duo: does not fight md/lg/xl or interactive color variants on the same property', () => {
    const conflicts = findDuoSpecificityConflicts();
    assert.deepEqual(
        conflicts,
        [],
        conflicts.map((c) => (
            `${c.file}:${c.line} [${c.kind}] ${c.prop}: ${c.duo.join(' ')} vs ${c.other.join(' ')}`
        )).join('\n')
    );
});

test('iOS launch screen autoresizes for Duo window scenes', () => {
    const storyboard = read('ios/App/App/Base.lproj/LaunchScreen.storyboard');
    assert.match(
        storyboard,
        /<autoresizingMask key="autoresizingMask" widthSizable="YES" heightSizable="YES"\/>/
    );
});

test('SceneDelegate relayouts CAPBridgeViewController on window scene updates', () => {
    const scene = read('ios/App/App/SceneDelegate.swift');
    assert.match(scene, /func windowScene\(_ windowScene: UIWindowScene/);
    assert.match(scene, /didUpdate previousCoordinateSpace/);
    assert.match(scene, /CAPBridgeViewController/);
    assert.match(scene, /DuoBridgeViewController/);
    assert.match(scene, /bridgeVC\.webView\?\.layoutIfNeeded\(\)/);
});

test('Info.plist keeps portrait and landscape without UIRequiresFullScreen', () => {
    const plist = read('ios/App/App/Info.plist');
    assert.match(plist, /UISupportedInterfaceOrientations/);
    assert.match(plist, /UIInterfaceOrientationPortrait/);
    assert.match(plist, /UIInterfaceOrientationLandscapeLeft/);
    assert.match(plist, /UIInterfaceOrientationLandscapeRight/);
    assert.doesNotMatch(plist, /UIRequiresFullScreen/);
});

test('navigation supports wide sidebar, Duo rail, and phone bottom nav', () => {
    const navigation = read('src/components/Navigation.jsx');
    const header = read('src/components/Header.jsx');
    const app = read('src/App.jsx');
    const css = read('src/index.css');
    assert.match(navigation, /shell === 'wide'|isWide/);
    assert.match(navigation, /shell === 'rail'|isRail/);
    assert.match(navigation, /data-testid="app-sidebar"/);
    assert.match(navigation, /data-testid="app-rail"/);
    assert.match(navigation, /data-testid="app-rail-back"/);
    assert.match(navigation, /data-testid="mobile-bottom-nav"/);
    assert.match(navigation, /role="navigation"/);
    assert.match(navigation, /data-swipe-ignore="true"/);
    assert.match(navigation, /min-h-11 w-full items-center gap-3/);
    assert.match(app, /shell=\{shell\}/);
    assert.match(app, /useShellMode\(\)/);
    assert.match(app, /getBackAction/);
    assert.match(app, /hideClientBack=\{isRail\}/);
    assert.match(header, /duo:py-3\.5 duo-lg:py-4/);
    assert.doesNotMatch(header, /header-inner[^"]*(?:px-\d|duo:px-)/);
    assert.match(header, /hideClientBack/);
    assert.match(css, /--app-column-max:\s*28rem/);
    assert.match(css, /--app-gutter-x:\s*1rem/);
    assert.match(css, /\.header-inner \{[\s\S]*?padding-left:\s*var\(--app-gutter-x\)/);
    assert.match(css, /\.app-content \{[\s\S]*?padding:\s*1rem var\(--app-gutter-x\)/);
    // Narrow header must not invent a second centered max-width (breaks Duo upright).
    assert.match(css, /\.header-inner \{[\s\S]*?max-width:\s*none/);
    assert.doesNotMatch(css, /\.header-inner \{\s*max-width:\s*28rem/);
    assert.match(css, /html\[data-shell="rail"\] \.app-stage \{/);
    assert.match(css, /--app-rail-reserve/);
    assert.match(css, /--app-rail-status-clearance/);
    assert.match(css, /--app-rail-status-nudge/);
    assert.match(
        css,
        /--app-rail-status-nudge:\s*clamp\(0px,\s*calc\(\(env\(safe-area-inset-right,\s*0px\)\s*-\s*20px\)\s*\*\s*100\),\s*5px\)/
    );
    assert.match(css, /right:\s*var\(--app-rail-status-nudge\)/);
    assert.match(css, /z-index:\s*45/);
    // Capsule fits 48pt btn + 4px pad×2 + 1px border×2; buttons use grid + block SVG (no 48-in-46 overflow).
    assert.match(css, /--app-rail-width:\s*calc\(3rem\s*\+\s*0\.5rem\s*\+\s*2px\)/);
    // Back pill is a 48pt glass circle (matches active-tab highlight), not the full 58px capsule.
    assert.match(navigation, /app-rail-pill app-rail-back-pill/);
    assert.match(css, /html\[data-shell="rail"\] \.app-rail-back-pill \{/);
    assert.match(css, /html\[data-shell="rail"\] \.app-rail-back-pill \{[\s\S]*?width:\s*3rem/);
    assert.match(css, /html\[data-shell="rail"\] \.app-rail-back-pill \{[\s\S]*?height:\s*3rem/);
    assert.match(css, /html\[data-shell="rail"\] \.app-rail-back-pill \{[\s\S]*?padding:\s*0/);
    assert.match(css, /html\[data-shell="rail"\] \.app-rail-back-pill \{[\s\S]*?align-self:\s*center/);
    // Hairline as inset shadow, not border, so the back button itself is a full 48×48pt.
    assert.match(css, /html\[data-shell="rail"\] \.app-rail-back-pill \{[\s\S]*?border:\s*0;[\s\S]*?box-shadow:\s*inset 0 0 0 1px/);
    // Inset > 20px clearance (+12pt vs prior caps); no-inset floor stays 3.25rem.
    assert.match(
        css,
        /--app-rail-status-clearance:\s*max\(3\.25rem,\s*min\(10\.75rem,\s*calc\(\(env\(safe-area-inset-right,\s*0px\)\s*-\s*20px\)\s*\*\s*100\)\)\)/
    );
    assert.match(
        css,
        /--app-rail-status-clearance:\s*max\(3\.25rem,\s*min\(7\.75rem,\s*calc\(\(env\(safe-area-inset-right,\s*0px\)\s*-\s*20px\)\s*\*\s*100\)\)\)/
    );
    assert.match(css, /html\[data-shell="rail"\] \.app-rail-btn \{/);
    assert.match(css, /place-items:\s*center/);
    assert.match(css, /html\[data-shell="rail"\] \.app-rail-btn > svg \{/);
    assert.match(css, /display:\s*block/);
    assert.match(css, /html\[data-shell="rail"\] \.app-rail-btn > svg \{[^}]*width:\s*1\.5rem/);
    assert.match(css, /html\[data-shell="rail"\] \.app-rail-btn > svg \{[^}]*height:\s*1\.5rem/);
    assert.match(navigation, /className=\{`app-rail-btn /);
    assert.match(navigation, /className="app-rail-btn /);
    assert.doesNotMatch(navigation, /app-rail-btn inline-flex h-11 w-11/);
    // Phosphor: active nav uses fill weight; rail icons are 24px (sidebar 20px) so CSS sizing holds.
    assert.match(navigation, /weight=\{isActive \? 'fill' : 'regular'\}/);
    assert.match(navigation, /size=\{20\} weight=\{isActive \? 'fill' : 'regular'\}/);
    assert.match(navigation, /size=\{24\} weight=\{isActive \? 'fill' : 'regular'\}/);
    assert.match(navigation, /<CaretLeft size=\{24\} \/>/);
    assert.doesNotMatch(navigation, /from 'lucide-react'/);
    assert.match(read('src/lib/config.js'), /from '@phosphor-icons\/react'/);
    assert.match(read('src/components/IconProvider.jsx'), /IconContext/);
    // Rail unlocks frame/content; header column width is shared via --app-gutter-x (no second lock).
    assert.match(css, /html\[data-shell="rail"\] \.header-inner \{[\s\S]*?max-width:\s*none/);
    assert.match(css, /html\[data-shell="rail"\] \.app-content \{[\s\S]*?max-width:\s*none/);
    assert.match(css, /html\[data-shell="rail"\] \.app-frame[\s\S]*?max-width:\s*none/);
    assert.match(css, /html\[data-shell="wide"\] \{\s*--app-gutter-x:\s*1\.5rem/);
    assert.match(css, /html\[data-shell="rail"\] \{\s*--app-gutter-x:\s*1\.5rem/);
    assert.match(
        css,
        /padding-top:\s*calc\(env\(safe-area-inset-top,\s*0px\)\s*\+\s*var\(--app-rail-status-clearance\)\)/
    );
    assert.doesNotMatch(
        css,
        /html\[data-shell="rail"\] \.app-frame,\s*\n\s*html\[data-shell="rail"\] \.app-stage/
    );
    // Portrait Duo uses normal bottom nav (shell=narrow), not a rail bottom capsule.
    assert.doesNotMatch(css, /orientation:\s*portrait/);
    assert.doesNotMatch(css, /--app-rail-bottom-reserve/);
});

test('PlanSection stacks sections and keeps break-words + whitespace-pre-wrap', () => {
    const plan = read('src/views/PlanSection.jsx');
    assert.doesNotMatch(plan, /duo:grid-cols-2/);
    assert.match(plan, /data-testid="plan-sections"/);
    assert.match(plan, /data-testid="plan-section"/);
    assert.match(plan, /min-w-0 break-words/);
    assert.match(plan, /data-testid="plan-exercise-name"[^>]*>/);
    assert.match(
        plan,
        /break-words whitespace-pre-wrap font-medium" data-testid="plan-exercise-name"/
    );
    assert.doesNotMatch(plan, /break-normal/);
    assert.doesNotMatch(plan, /overflow-x-auto/);
    assert.match(plan, /header-inner mx-auto flex items-center gap-2 py-2\.5/);
    assert.doesNotMatch(plan, /header-inner[^"]*(?:px-\d|duo:px-)/);
});

test('views keep duo density classes without dead segment coupling', () => {
    const coach = read('src/views/CoachDashboard.jsx');
    const dashboard = read('src/views/DashboardView.jsx');
    const checkin = read('src/views/CheckInView.jsx');
    const gallery = read('src/views/GalleryView.jsx');
    const weight = read('src/views/WeightProgressView.jsx');
    const ui = read('src/components/ui.jsx');
    const boundary = read('src/components/ViewBoundary.jsx');
    const app = read('src/App.jsx');

    assert.match(coach, /duo:grid duo:grid-cols-2/);
    assert.match(coach, /duo-split-grid/);
    assert.match(coach, /duo:px-6 duo-lg:px-7/);
    assert.match(dashboard, /pb-32 duo:pb-8/);
    assert.match(dashboard, /duo:px-6 duo-lg:px-7/);
    assert.doesNotMatch(dashboard, /duo:grid-cols-2 gap-5 items-start/);
    assert.match(checkin, /hidden duo:inline-flex/);
    assert.match(checkin, /duo:flex-none/);
    assert.match(checkin, /duo:min-h-11/);
    assert.match(checkin, /data-testid="checkin-history-row"/);
    assert.match(gallery, /duo:max-w-3xl duo:mx-auto/);
    assert.match(gallery, /max-w-\[33\.6vh\] duo:max-w-\[min\(42vh,22rem\)\]/);
    assert.match(gallery, /duo:grid-cols-6/);
    assert.match(weight, /pb-32 duo:pb-8/);
    assert.match(weight, /width < 680 \? 4 : 6/);
    assert.match(ui, /duo:grid-cols-5 duo-lg:grid-cols-10/);
    assert.match(ui, /data-testid=\{wrap \? 'rating-scale'/);
    assert.doesNotMatch(ui, /duo:min-h-11/);
    assert.match(boundary, /sm:grid-cols-4 duo:grid-cols-5/);
    assert.match(app, /header-inner flex items-center gap-3 py-3 duo:py-3\.5 duo-lg:py-4/);
    assert.doesNotMatch(app, /header-inner[^"]*(?:px-\d|duo:px-)/);
});

test('login card stays max-w-sm without unfolded split layout', () => {
    const login = read('src/components/LoginScreen.jsx');
    assert.match(login, /login-card w-full max-w-sm/);
    assert.doesNotMatch(login, /duo:grid|duo-split/);
});

test('docs plan records WebKit segment preview status and Duo rail', () => {
    const plan = read('docs/iphone-duo-plan.md');
    assert.match(plan, /feature flag/i);
    assert.match(plan, /DUO_MEDIA_QUERY/);
    assert.match(plan, /DUO_RAIL_MEDIA_QUERY/);
    assert.match(plan, /DUO_BOTTOM_NAV_MEDIA_QUERY/);
    assert.match(plan, /DUO_UNFOLDED_MIN_WIDTH_PX\s*=\s*600/);
    assert.match(plan, /max-aspect-ratio:\s*1\/1/);
    assert.match(plan, /aspect-ratio > 1\/1/);
    assert.match(plan, /min-height: 600px/);
    assert.match(plan, /P1/);
    assert.match(plan, /data-shell/);
    assert.match(plan, /rail/i);
    assert.match(plan, /iPhone19,4/);
    assert.match(plan, /data-device="duo"/);
    assert.match(plan, /sessionStorage/);
    assert.match(plan, /Spesifisitet/);
    assert.match(plan, /Path-avhengighet/);
    assert.match(plan, /Deteksjon|Usikkerhet/);
    assert.match(plan, /app-rail-status-clearance|Utfoldet layout/);
    assert.match(plan, /appledb\.dev/);
    assert.match(plan, /bunnmeny|Bottom nav/);
    assert.match(plan, /oppreist|utfoldet/);
});

test('src does not use max-sm/max-md/max-lg or arbitrary min-[ screens', () => {
    const files = [
        'src/App.jsx',
        'src/components/Navigation.jsx',
        'src/components/Header.jsx',
        'src/components/ui.jsx',
        'src/views/PlanSection.jsx',
        'src/views/CheckInView.jsx',
        'src/views/DashboardView.jsx',
        'src/views/CoachDashboard.jsx',
        'src/views/GalleryView.jsx',
    ];
    for (const file of files) {
        const source = read(file);
        assert.doesNotMatch(source, /max-sm:|max-md:|max-lg:|max-duo:/);
        assert.doesNotMatch(source, /min-\[[^\]]+\]:/);
    }
});
