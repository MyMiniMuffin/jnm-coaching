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
});

test('tailwind duo screen imports DUO_MEDIA_QUERY from duoBreakpoint.js', () => {
    const config = read('tailwind.config.mjs');
    assert.match(config, /from '\.\/src\/lib\/duoBreakpoint\.js'/);
    assert.match(config, /duo:\s*\{\s*raw:\s*DUO_MEDIA_QUERY\s*\}/);
    assert.doesNotMatch(config, /PHONE_CHROME/);
});

test('DESKTOP_QUERY uses DUO_MEDIA_QUERY with sticky shell helpers', () => {
    const hooks = read('src/hooks.jsx');
    assert.match(hooks, /from '\.\/lib\/duoBreakpoint'/);
    assert.match(hooks, /export const DESKTOP_QUERY = DUO_MEDIA_QUERY/);
    assert.match(hooks, /data-duo-shell/);
    assert.match(hooks, /innerWidth/);
    assert.doesNotMatch(hooks, /horizontal-viewport-segments/);
    assert.doesNotMatch(hooks, /PHONE_CHROME/);
});

test('index.css duo shell media matches duoBreakpoint numbers and keeps fold-gap only', () => {
    const css = read('src/index.css');
    assert.match(
        css,
        /@media \(min-width: 700px\) and \(min-height: 600px\), \(min-width: 1024px\)/
    );
    assert.match(css, /html\[data-duo-shell\]/);
    assert.match(css, /--fold-gap:\s*1\.25rem/);
    assert.match(css, /\.duo-split-grid/);
    assert.doesNotMatch(css, /horizontal-viewport-segments/);
    assert.doesNotMatch(css, /viewport-segment-left/);
    assert.match(css, /width:\s*12\.5rem/);
    assert.match(css, /\.app-frame-nav \.plan-save-bar \{[\s\S]*?left:\s*12\.5rem/);
    assert.match(css, /@media \(min-width: 1024px\)[\s\S]*?width:\s*15\.5rem/);
    assert.match(css, /@media \(min-width: 640px\) and \(max-width: 699px\)/);
    assert.match(css, /@media \(max-width: 699px\), \(max-width: 1023px\) and \(max-height: 599px\)/);
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

test('duoBreakpoint values are mirrored exactly in index.css media queries', () => {
    const css = read('src/index.css');
    const expectedShell =
        `@media (min-width: ${DUO_MIN_WIDTH_PX}px) and (min-height: ${DUO_MIN_HEIGHT_PX}px), ` +
        `(min-width: ${DESKTOP_MIN_WIDTH_PX}px)`;
    assert.match(css, new RegExp(expectedShell.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(
        css,
        new RegExp(
            `@media \\(max-width: ${DUO_MIN_WIDTH_PX - 1}px\\), \\(max-width: ${DESKTOP_MIN_WIDTH_PX - 1}px\\) and \\(max-height: ${DUO_MIN_HEIGHT_PX - 1}px\\)`
        )
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
    assert.match(header, /duo:px-6 lg:px-8 duo:py-3\.5 lg:py-4/);
});

test('PlanSection stacks sections and keeps break-words for narrow viewports', () => {
    const plan = read('src/views/PlanSection.jsx');
    assert.doesNotMatch(plan, /duo:grid-cols-2/);
    assert.match(plan, /data-testid="plan-sections"/);
    assert.match(plan, /data-testid="plan-section"/);
    assert.match(plan, /min-w-0 break-words/);
    assert.doesNotMatch(plan, /break-normal/);
    assert.doesNotMatch(plan, /overflow-x-auto/);
    assert.match(plan, /duo:px-6 lg:px-8/);
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
    assert.match(coach, /duo:px-6 lg:px-7/);
    assert.match(dashboard, /pb-32 duo:pb-8/);
    assert.match(dashboard, /duo:px-6 lg:px-7/);
    assert.doesNotMatch(dashboard, /duo:grid-cols-2 gap-5 items-start/);
    assert.match(checkin, /hidden duo:inline-flex/);
    assert.match(checkin, /duo:flex-none/);
    assert.match(checkin, /duo:min-h-11/);
    assert.match(checkin, /data-testid="checkin-history-row"/);
    assert.match(gallery, /duo:max-w-3xl duo:mx-auto/);
    assert.match(gallery, /max-w-\[33\.6vh\] duo:max-w-\[min\(42vh,22rem\)\]/);
    assert.match(gallery, /duo:grid-cols-6/);
    assert.match(weight, /pb-32 duo:pb-8/);
    assert.match(ui, /duo:grid-cols-5 lg:grid-cols-10/);
    assert.match(ui, /data-testid=\{wrap \? 'rating-scale'/);
    assert.doesNotMatch(ui, /duo:min-h-11/);
    assert.match(boundary, /sm:grid-cols-4 duo:grid-cols-5/);
    assert.match(app, /duo:px-6 lg:px-8 duo:py-3\.5 lg:py-4/);
});

test('login card stays max-w-sm without unfolded split layout', () => {
    const login = read('src/components/LoginScreen.jsx');
    assert.match(login, /login-card w-full max-w-sm/);
    assert.doesNotMatch(login, /duo:grid|duo-split/);
});

test('docs plan records WebKit segment preview status and revised duo query', () => {
    const plan = read('docs/iphone-duo-plan.md');
    assert.match(plan, /feature flag/i);
    assert.match(plan, /DUO_MEDIA_QUERY/);
    assert.match(plan, /min-height: 600px/);
    assert.match(plan, /P1/);
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
