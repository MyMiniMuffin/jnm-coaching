import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8');
const require = createRequire(import.meta.url);
const {
    DUO_MIN_WIDTH_PX,
    DUO_MIN_HEIGHT_PX,
    DUO_MEDIA_QUERY,
} = require('../src/lib/duoBreakpoint.cjs');

test('duoBreakpoint constants match expected Duo shell query', () => {
    assert.equal(DUO_MIN_WIDTH_PX, 700);
    assert.equal(DUO_MIN_HEIGHT_PX, 600);
    assert.equal(
        DUO_MEDIA_QUERY,
        '(min-width: 700px) and (min-height: 600px)'
    );
});

test('tailwind duo screen uses shared DUO_MEDIA_QUERY raw media', () => {
    const config = read('tailwind.config.js');
    assert.match(config, /require\('\.\/src\/lib\/duoBreakpoint\.cjs'\)/);
    assert.match(config, /duo:\s*\{\s*raw:\s*DUO_MEDIA_QUERY\s*\}/);
    assert.doesNotMatch(config, /duo:\s*'700px'/);
    assert.doesNotMatch(config, /extend:\s*\{[\s\S]*?screens:\s*\{[\s\S]*?duo:/);
});

test('DESKTOP_QUERY uses DUO_MEDIA_QUERY without viewport-segments', () => {
    const hooks = read('src/hooks.jsx');
    assert.match(hooks, /from '\.\/lib\/duoBreakpoint'/);
    assert.match(hooks, /export const DESKTOP_QUERY = DUO_MEDIA_QUERY/);
    assert.doesNotMatch(hooks, /horizontal-viewport-segments/);
});

test('index.css duo shell requires min-height and keeps fold-gap fallback only', () => {
    const css = read('src/index.css');
    assert.match(css, /@media \(min-width: 700px\) and \(min-height: 600px\)/);
    assert.match(css, /--fold-gap:\s*1\.25rem/);
    assert.match(css, /\.duo-split-grid/);
    assert.match(css, /column-gap:\s*var\(--fold-gap/);
    assert.doesNotMatch(css, /horizontal-viewport-segments/);
    assert.doesNotMatch(css, /viewport-segment-left/);
    assert.match(css, /width:\s*12\.5rem/);
    assert.match(css, /\.app-frame-nav \.plan-save-bar \{[\s\S]*?left:\s*12\.5rem/);
    assert.match(css, /@media \(min-width: 1024px\) and \(min-height: 600px\)[\s\S]*?width:\s*15\.5rem/);
    assert.match(css, /@media \(min-width: 640px\) and \(max-width: 699px\)/);
    assert.match(
        css,
        /@media \(min-width: 640px\) and \(max-width: 699px\) \{[\s\S]*?box-shadow:\s*0 28px 90px/
    );
    assert.match(css, /@media \(max-width: 699px\), \(max-height: 599px\)/);
    assert.doesNotMatch(css, /@media \(min-width: 640px\) and \(max-width: 1023px\)/);
    assert.doesNotMatch(
        css,
        /@media \(display-mode: standalone\) and \(max-width: 1023px\)/
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

test('navigation and header use duo breakpoint for shell chrome', () => {
    const navigation = read('src/components/Navigation.jsx');
    const header = read('src/components/Header.jsx');
    assert.match(navigation, /app-sidebar hidden duo:flex/);
    assert.match(navigation, /duo:hidden/);
    assert.match(navigation, /min-h-11 w-full items-center gap-3/);
    assert.doesNotMatch(navigation, /lg:flex|lg:hidden/);
    assert.match(header, /duo:px-6 lg:px-8 duo:py-3\.5 lg:py-4/);
    assert.match(header, /duo:text-left/);
    assert.match(header, /hidden text-sm font-medium duo:inline/);
});

test('PlanSection stacks sections and avoids letter-break wrapping', () => {
    const plan = read('src/views/PlanSection.jsx');
    assert.doesNotMatch(plan, /duo:grid-cols-2/);
    assert.match(plan, /className="space-y-4"/);
    assert.match(plan, /min-w-0 break-normal/);
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
    assert.match(gallery, /duo:max-w-3xl duo:mx-auto/);
    assert.match(gallery, /max-w-\[33\.6vh\] duo:max-w-\[min\(42vh,22rem\)\]/);
    assert.match(gallery, /duo:grid-cols-6/);
    assert.match(weight, /pb-32 duo:pb-8/);
    assert.match(ui, /duo:grid-cols-5 lg:grid-cols-10/);
    assert.match(boundary, /sm:grid-cols-4 duo:grid-cols-5/);
    assert.match(app, /duo:px-6 lg:px-8 duo:py-3\.5 lg:py-4/);
});

test('login card stays max-w-sm without unfolded split layout', () => {
    const login = read('src/components/LoginScreen.jsx');
    assert.match(login, /login-card w-full max-w-sm/);
    assert.doesNotMatch(login, /duo:grid|duo-split/);
});

test('docs plan records WebKit segment preview status', () => {
    const plan = read('docs/iphone-duo-plan.md');
    assert.match(plan, /feature flag/i);
    assert.match(plan, /DUO_MEDIA_QUERY/);
    assert.match(plan, /min-height: 600px/);
    assert.match(plan, /P1/);
});
