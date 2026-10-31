import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DUO_MACHINE_IDS, isDuoMachineId } from '../src/lib/duoDeviceModels.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8');

test('Duo machine id list includes known iPhone19,4 and rejects others', () => {
    assert.ok(DUO_MACHINE_IDS.includes('iPhone19,4'));
    assert.equal(isDuoMachineId('iPhone19,4'), true);
    assert.equal(isDuoMachineId('iPhone17,3'), false);
    assert.equal(isDuoMachineId('iPhone18,1'), false);
    assert.equal(isDuoMachineId(''), false);
    assert.equal(isDuoMachineId(null), false);
    assert.equal(isDuoMachineId(undefined), false);
});

test('duoDeviceModels documents verification uncertainty for iPhone19,4', () => {
    const models = read('src/lib/duoDeviceModels.js');
    assert.match(models, /not.*confirmed|ikke.*bekreftet|Verification/i);
    assert.match(models, /appledb\.dev\/device\/identifier\/iPhone19,4/);
    assert.match(models, /ipsw\.dev\/iPhone19,4/);
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
    assert.match(swift, /JNM_FORCE_DUO/);
    assert.match(swift, /isForceDuoEnabled/);
    for (const id of DUO_MACHINE_IDS) {
        assert.match(swift, new RegExp(id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
});

test('Debug App scheme enables -ForceDuoDevice for Simulator rail testing', () => {
    const scheme = read('ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme');
    assert.match(scheme, /CommandLineArguments/);
    assert.match(scheme, /argument="-ForceDuoDevice"/);
    assert.match(scheme, /argument="-ForceDuoDevice"[^>]*isEnabled="YES"/);
});

test('DuoBridgeViewController injects WKUserScript before first load', () => {
    const bridge = read('ios/App/App/DuoBridgeViewController.swift');
    const scene = read('ios/App/App/SceneDelegate.swift');
    assert.match(bridge, /class DuoBridgeViewController:\s*CAPBridgeViewController/);
    assert.match(bridge, /webViewConfiguration\(for/);
    assert.match(bridge, /WKUserScript/);
    assert.match(bridge, /\.atDocumentStart/);
    assert.match(bridge, /DuoDevice\.userScriptSource/);
    assert.match(scene, /DuoBridgeViewController\(\)/);
    assert.doesNotMatch(scene, /injectDuoDeviceMarker/);
    assert.doesNotMatch(scene, /addUserScript/);
});

test('shellMode uses sessionStorage override and clears phone data-device', () => {
    const shell = read('src/lib/shellMode.js');
    assert.match(shell, /SHELL_RAIL/);
    assert.match(shell, /isDuoDevice/);
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
