import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
    DUO_MACHINE_IDS,
    NON_DUO_MACHINE_IDS,
    isDuoMachineId,
    decideIsDuo,
} from '../src/lib/duoDeviceModels.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8');

/** Mirrors `resolveShell` in shellMode.js without importing React/Vite modules. */
const resolveShell = ({ isDuo, wideSticky }) => {
    if (isDuo) return 'rail';
    return wideSticky ? 'wide' : 'narrow';
};

test('Duo machine id list includes known iPhone19,4 and rejects others', () => {
    assert.ok(DUO_MACHINE_IDS.includes('iPhone19,4'));
    assert.equal(isDuoMachineId('iPhone19,4'), true);
    assert.equal(isDuoMachineId('iPhone17,3'), false);
    assert.equal(isDuoMachineId('iPhone18,1'), false);
    assert.equal(isDuoMachineId(''), false);
    assert.equal(isDuoMachineId(null), false);
    assert.equal(isDuoMachineId(undefined), false);
});

test('exact allowlist rejects iPhone 18 Pro generation and old iPhone 8 ids (not Duo)', () => {
    // iPhone 18 Pro family — same iPhone19,* generation as presumed Duo id.
    assert.equal(isDuoMachineId('iPhone19,1'), false);
    assert.equal(isDuoMachineId('iPhone19,2'), false); // iPhone 18 Pro
    assert.equal(isDuoMachineId('iPhone19,3'), false);
    assert.equal(isDuoMachineId('iPhone19,5'), false);
    assert.equal(isDuoMachineId('iPhone19,6'), false);
    assert.equal(isDuoMachineId('iPhone19,7'), false);
    // Modern Pro (2025)
    assert.equal(isDuoMachineId('iPhone18,1'), false); // iPhone 17 Pro
    assert.equal(isDuoMachineId('iPhone18,2'), false); // iPhone 17 Pro Max
    // Old models (iPhone 8 / 8 Plus / X)
    assert.equal(isDuoMachineId('iPhone10,1'), false);
    assert.equal(isDuoMachineId('iPhone10,4'), false);
    assert.equal(isDuoMachineId('iPhone10,5'), false);
    // Prefix must never be treated as a match
    assert.equal(isDuoMachineId('iPhone19'), false);
    assert.equal(isDuoMachineId('iPhone19,'), false);
    assert.equal(isDuoMachineId('iPhone19,40'), false);
    assert.equal(isDuoMachineId('iPhone19,4 '), false);

    for (const id of NON_DUO_MACHINE_IDS) {
        assert.equal(isDuoMachineId(id), false, `${id} must not be Duo`);
        assert.equal(decideIsDuo({ machineId: id }), false, `decideIsDuo(${id})`);
    }
});

test('decideIsDuo is positive-identification only (unknown defaults to not Duo)', () => {
    assert.equal(decideIsDuo({}), false);
    assert.equal(decideIsDuo({ machineId: null }), false);
    assert.equal(decideIsDuo({ machineId: 'arm64' }), false);
    assert.equal(decideIsDuo({ machineId: 'iPhone19,4' }), true);
    assert.equal(decideIsDuo({ machineId: 'iPhone19,2' }), false);
    assert.equal(decideIsDuo({ machineId: 'iPhone18,1', forceDuo: true }), true);
    assert.equal(decideIsDuo({ machineId: 'arm64', simulatorDeviceName: 'iPhone Duo' }), true);
    assert.equal(decideIsDuo({ machineId: 'arm64', simulatorDeviceName: 'iPhone 16 Pro' }), false);
    assert.equal(decideIsDuo({ machineId: 'iPhone19,2', hasFoldableDivision: true }), true);
    assert.equal(decideIsDuo({ machineId: 'iPhone19,2', hasFoldableDivision: false }), false);
});

test('non-Duo phone resolves to narrow shell; Duo id resolves to rail', () => {
    assert.equal(
        resolveShell({ isDuo: false, wideSticky: false }),
        'narrow',
        'regular phone → narrow (bottom nav)'
    );
    assert.equal(
        resolveShell({ isDuo: decideIsDuo({ machineId: 'iPhone19,2' }), wideSticky: false }),
        'narrow',
        'iPhone 18 Pro (iPhone19,2) → narrow'
    );
    assert.equal(
        resolveShell({ isDuo: decideIsDuo({ machineId: 'iPhone18,1' }), wideSticky: false }),
        'narrow',
        'iPhone 17 Pro (iPhone18,1) → narrow'
    );
    assert.equal(
        resolveShell({ isDuo: decideIsDuo({ machineId: 'iPhone18,2' }), wideSticky: false }),
        'narrow',
        'iPhone 17 Pro Max (iPhone18,2) → narrow'
    );
    assert.equal(
        resolveShell({ isDuo: decideIsDuo({ machineId: 'iPhone10,1' }), wideSticky: false }),
        'narrow',
        'iPhone 8 (iPhone10,1) → narrow'
    );
    assert.equal(
        resolveShell({ isDuo: decideIsDuo({ machineId: 'iPhone10,4' }), wideSticky: false }),
        'narrow',
        'iPhone 8 GSM (iPhone10,4) → narrow'
    );
    assert.equal(
        resolveShell({ isDuo: decideIsDuo({ machineId: 'iPhone19,4' }), wideSticky: false }),
        'rail',
        'Duo allowlist id → rail'
    );
    assert.equal(
        resolveShell({ isDuo: false, wideSticky: true }),
        'wide',
        'sticky wide without Duo → left sidebar'
    );
    // shellMode must wire the same pure resolveShell helper
    const shell = read('src/lib/shellMode.js');
    assert.match(shell, /export const resolveShell/);
    assert.match(shell, /if \(isDuo\) return SHELL_RAIL/);
});

test('duoDeviceModels documents verification uncertainty and iPhone 18 Pro collision', () => {
    const models = read('src/lib/duoDeviceModels.js');
    assert.match(models, /not.*confirmed|ikke.*bekreftet|Verification/i);
    assert.match(models, /appledb\.dev\/device\/identifier\/iPhone19,4/);
    assert.match(models, /ipsw\.dev\/iPhone19,4/);
    assert.match(models, /iPhone19,2/);
    assert.match(models, /Exact-match only|exact-match|never prefix/i);
    assert.match(models, /decideIsDuo/);
});

test('Swift DuoDevice list stays in sync with duoDeviceModels.js', () => {
    const swift = read('ios/App/App/DuoDevice.swift');
    assert.match(swift, /knownMachineIds/);
    assert.match(swift, /iPhone19,4/);
    assert.match(swift, /utsname/);
    assert.match(swift, /userScriptSource/);
    assert.match(swift, /data-device['"],['"]duo/);
    assert.match(swift, /logMachineIdentifierIfNeeded/);
    assert.match(swift, /#if DEBUG/);
    assert.match(swift, /ForceDuoDevice/);
    assert.match(swift, /NoForceDuoDevice/);
    assert.match(swift, /JNM_FORCE_DUO/);
    assert.match(swift, /isForceDuoEnabled/);
    assert.match(swift, /SIMULATOR_MODEL_IDENTIFIER/);
    assert.match(swift, /SIMULATOR_DEVICE_NAME/);
    assert.match(swift, /targetEnvironment\(simulator\)/);
    assert.match(swift, /decideIsDuo/);
    assert.match(swift, /hasFoldableDivision/);
    assert.match(swift, /reservedRegions/);
    assert.match(swift, /\.division/);
    assert.match(swift, /includeInactive/);
    assert.match(swift, /Exact-match only|never prefix|iPhone19,2/);
    // Debug must NOT default-force Duo (PR #17 regression). Opt-in only.
    assert.match(swift, /arguments\.contains\(forceArgument\)[\s\S]*return true/);
    assert.doesNotMatch(
        swift,
        /isForceDuoEnabled: Bool \{[\s\S]*?#if DEBUG[\s\S]*?return true\s*\n\s*#else/
    );
    for (const id of DUO_MACHINE_IDS) {
        assert.match(swift, new RegExp(id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
});

test('Debug App scheme still documents -ForceDuoDevice launch argument', () => {
    const scheme = read('ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme');
    assert.match(scheme, /CommandLineArguments/);
    assert.match(scheme, /argument="-ForceDuoDevice"/);
});

test('DuoBridgeViewController injects WKUserScript on live contentController', () => {
    const bridge = read('ios/App/App/DuoBridgeViewController.swift');
    const scene = read('ios/App/App/SceneDelegate.swift');
    assert.match(bridge, /class DuoBridgeViewController:\s*CAPBridgeViewController/);
    assert.match(bridge, /capacitorDidLoad/);
    assert.match(bridge, /injectDuoUserScript/);
    assert.match(bridge, /userContentController/);
    assert.match(bridge, /\.addUserScript\(/);
    assert.match(bridge, /WKUserScript/);
    assert.match(bridge, /\.atDocumentStart/);
    assert.match(bridge, /DuoDevice\.userScriptSource/);
    assert.match(bridge, /evaluateJavaScript/);
    assert.match(bridge, /ensureDuoDeviceAttribute/);
    assert.match(bridge, /hasFoldableDivision/);
    // Capacitor replaces userContentController after webViewConfiguration — document that.
    assert.match(bridge, /prepareWebView|contentController|replaced|discarded/i);
    // Main.storyboard owns the single bridge; a second UIWindow meant two WKWebViews.
    const storyboard = read('ios/App/App/Base.lproj/Main.storyboard');
    assert.match(storyboard, /customClass="DuoBridgeViewController"/);
    assert.doesNotMatch(scene, /UIWindow\(windowScene:/);
    assert.doesNotMatch(scene, /DuoBridgeViewController\(\)/);
    assert.doesNotMatch(scene, /injectDuoDeviceMarker/);
    assert.doesNotMatch(scene, /addUserScript/);
});

test('shellMode uses sessionStorage override and clears phone data-device', () => {
    const shell = read('src/lib/shellMode.js');
    assert.match(shell, /SHELL_RAIL/);
    assert.match(shell, /isDuoDevice/);
    assert.match(shell, /resolveShell/);
    assert.match(shell, /sessionStorage/);
    assert.match(shell, /jnm_device_override/);
    assert.match(shell, /device=duo/);
    assert.match(shell, /computeShell/);
    assert.match(shell, /removeAttribute\(DEVICE_ATTR\)/);
    assert.match(shell, /MutationObserver/);
    assert.match(shell, /localStorage\.removeItem\(DEVICE_STORAGE_KEY\)/);
    assert.doesNotMatch(shell, /localStorage\.setItem\(DEVICE_STORAGE_KEY/);
});

test('railBack stores onBack in a ref (no register loop on unstable callbacks)', () => {
    const rail = read('src/lib/railBack.jsx');
    assert.match(rail, /onBackRef/);
    assert.match(rail, /useLayoutEffect/);
    assert.match(rail, /handlersRef/);
    assert.match(rail, /useRegisterRailBack/);
});
