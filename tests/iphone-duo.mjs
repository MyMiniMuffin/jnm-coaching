import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
    DUO_MIN_WIDTH_PX,
    DUO_MIN_HEIGHT_PX,
    DESKTOP_MIN_WIDTH_PX,
    DUO_MEDIA_QUERY,
} from '../src/lib/duoBreakpoint.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8');

test('duoBreakpoint is the single source for Duo media query', () => {
    assert.equal(DUO_MIN_WIDTH_PX, 700);
    assert.equal(DUO_MIN_HEIGHT_PX, 600);
    assert.equal(DESKTOP_MIN_WIDTH_PX, 1024);
    assert.equal(
        DUO_MEDIA_QUERY,
        '(min-width: 700px) and (min-height: 600px), (min-width: 1024px)'
    );
    assert.equal(existsSync(join(root, 'src/lib/duoBreakpoint.cjs')), false);
    assert.equal(existsSync(join(root, 'tailwind.config.js')), false);
    assert.equal(existsSync(join(root, 'tailwind.config.mjs')), true);
    assert.equal(existsSync(join(root, 'src/lib/shellMode.js')), true);
});

test('tailwind duo is attribute variant on html[data-shell=wide]', () => {
    const config = read('tailwind.config.mjs');
    assert.match(config, /addVariant\(\s*['"]duo['"]\s*,\s*['"]html\[data-shell="wide"\] &['"]/);
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
    assert.match(shell, /innerWidth < DUO_MIN_WIDTH_PX/);
    assert.equal(DUO_MIN_WIDTH_PX, 700);
    assert.equal(DUO_MIN_HEIGHT_PX, 600);
    assert.equal(DESKTOP_MIN_WIDTH_PX, 1024);
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

test('navigation shell chrome is driven by isDesktop (sticky-safe)', () => {
    const navigation = read('src/components/Navigation.jsx');
    const header = read('src/components/Header.jsx');
    const app = read('src/App.jsx');
    assert.match(navigation, /isDesktop/);
    assert.match(navigation, /data-testid="app-sidebar"/);
    assert.match(navigation, /data-testid="mobile-bottom-nav"/);
    assert.match(navigation, /min-h-11 w-full items-center gap-3/);
    assert.match(app, /isDesktop=\{isDesktop\}/);
    assert.match(app, /useDesktop\(\)/);
    assert.match(header, /duo:px-6 duo-lg:px-8 duo:py-3\.5 duo-lg:py-4/);
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
    assert.match(plan, /duo:px-6 duo-lg:px-8/);
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
    assert.match(app, /duo:px-6 duo-lg:px-8 duo:py-3\.5 duo-lg:py-4/);
});

test('login card stays max-w-sm without unfolded split layout', () => {
    const login = read('src/components/LoginScreen.jsx');
    assert.match(login, /login-card w-full max-w-sm/);
    assert.doesNotMatch(login, /duo:grid|duo-split/);
});

test('docs plan records WebKit segment preview status and path-dependent sticky', () => {
    const plan = read('docs/iphone-duo-plan.md');
    assert.match(plan, /feature flag/i);
    assert.match(plan, /DUO_MEDIA_QUERY/);
    assert.match(plan, /min-height: 600px/);
    assert.match(plan, /P1/);
    assert.match(plan, /data-shell/);
    assert.match(plan, /900\s*[×x]\s*550/);
    assert.match(plan, /path-avhengig|path-dependent|kald start/i);
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
