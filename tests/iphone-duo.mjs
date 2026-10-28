import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8');

test('tailwind exposes duo breakpoint at 700px', () => {
    const config = read('tailwind.config.js');
    assert.match(config, /duo:\s*'700px'/);
});

test('DESKTOP_QUERY treats unfolded Duo and dual segments as desktop', () => {
    const hooks = read('src/hooks.jsx');
    assert.match(
        hooks,
        /export const DESKTOP_QUERY = '\(min-width: 700px\), \(horizontal-viewport-segments: 2\)';/
    );
});

test('index.css activates wide shell at 700px with compact Duo sidebar', () => {
    const css = read('src/index.css');
    assert.match(css, /@media \(min-width: 700px\)/);
    assert.match(css, /width:\s*12\.5rem/);
    assert.match(css, /\.app-frame-nav \.plan-save-bar \{[\s\S]*?left:\s*12\.5rem/);
    assert.match(css, /@media \(min-width: 1024px\)[\s\S]*?width:\s*15\.5rem/);
    assert.match(css, /@media \(min-width: 640px\) and \(max-width: 699px\)/);
    assert.doesNotMatch(css, /@media \(min-width: 640px\) and \(max-width: 1023px\)/);
    assert.match(css, /@media \(max-width: 699px\)/);
    assert.doesNotMatch(
        css,
        /@media \(display-mode: standalone\) and \(max-width: 1023px\)/
    );
});

test('index.css defines fold-gap and duo-split-grid for hinge-aware layouts', () => {
    const css = read('src/index.css');
    assert.match(css, /--fold-gap:\s*0px/);
    assert.match(css, /@media \(horizontal-viewport-segments: 2\)/);
    assert.match(css, /\.duo-split-grid/);
    assert.match(css, /column-gap:\s*var\(--fold-gap/);
    assert.match(css, /\.app-shell,\s*\.app-header,\s*\.mobile-bottom-nav \{[\s\S]*?safe-area-inset-left/);
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

test('navigation and header use duo breakpoint instead of lg for shell chrome', () => {
    const navigation = read('src/components/Navigation.jsx');
    const header = read('src/components/Header.jsx');
    assert.match(navigation, /app-sidebar hidden duo:flex/);
    assert.match(navigation, /duo:hidden/);
    assert.doesNotMatch(navigation, /lg:flex|lg:hidden/);
    assert.match(header, /duo:px-6 lg:px-8 duo:py-3\.5 lg:py-4/);
    assert.match(header, /duo:text-left/);
    assert.match(header, /hidden text-sm font-medium duo:inline/);
});

test('views use duo layout classes for unfolded dual-screen density', () => {
    const coach = read('src/views/CoachDashboard.jsx');
    const dashboard = read('src/views/DashboardView.jsx');
    const plan = read('src/views/PlanSection.jsx');
    const checkin = read('src/views/CheckInView.jsx');
    const gallery = read('src/views/GalleryView.jsx');
    const weight = read('src/views/WeightProgressView.jsx');
    const ui = read('src/components/ui.jsx');
    const boundary = read('src/components/ViewBoundary.jsx');

    assert.match(coach, /duo:grid duo:grid-cols-2/);
    assert.match(coach, /duo:flex duo:items-center duo:justify-between/);
    assert.match(dashboard, /pb-32 duo:pb-8/);
    assert.match(dashboard, /duo:grid-cols-2 gap-5 items-start/);
    assert.match(plan, /duo:grid duo:grid-cols-2 duo:gap-6/);
    assert.match(plan, /duo:px-6 lg:px-8/);
    assert.match(checkin, /sm:grid-cols-2 gap-3/);
    assert.match(checkin, /hidden duo:inline-flex/);
    assert.match(checkin, /duo:flex-none/);
    assert.match(gallery, /duo:max-w-3xl duo:mx-auto/);
    assert.match(gallery, /sm:max-w-xs duo:max-w-sm/);
    assert.match(gallery, /duo:grid-cols-6/);
    assert.match(gallery, /duo:grid-cols-5 gap-1\.5 duo:gap-2/);
    assert.match(gallery, /pl-\[env\(safe-area-inset-left,0px\)\]/);
    assert.match(weight, /width < 680 \? 4 : 6/);
    assert.match(weight, /pb-32 duo:pb-8/);
    assert.match(ui, /sm:grid-cols-10/);
    assert.match(boundary, /sm:grid-cols-4 duo:grid-cols-5/);
});
