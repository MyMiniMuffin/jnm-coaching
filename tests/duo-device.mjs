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

test('Swift DuoDevice list stays in sync with duoDeviceModels.js', () => {
    const swift = read('ios/App/App/DuoDevice.swift');
    assert.match(swift, /knownMachineIds/);
    assert.match(swift, /iPhone19,4/);
    assert.match(swift, /utsname/);
    assert.match(swift, /userScriptSource/);
    assert.match(swift, /data-device['"],['"]duo/);
    for (const id of DUO_MACHINE_IDS) {
        assert.match(swift, new RegExp(id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
});

test('SceneDelegate injects Duo marker at document start', () => {
    const scene = read('ios/App/App/SceneDelegate.swift');
    assert.match(scene, /injectDuoDeviceMarker/);
    assert.match(scene, /WKUserScript/);
    assert.match(scene, /\.atDocumentStart/);
    assert.match(scene, /DuoDevice\.userScriptSource/);
});

test('shellMode treats data-device=duo / override as rail', () => {
    const shell = read('src/lib/shellMode.js');
    assert.match(shell, /SHELL_RAIL/);
    assert.match(shell, /isDuoDevice/);
    assert.match(shell, /jnm_device_override/);
    assert.match(shell, /device=duo/);
    assert.match(shell, /computeShell/);
});
