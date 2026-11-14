import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const ENTRIES = ['index.html', 'coaching/index.html', 'oppstart/index.html', 'support/index.html', 'personvern/index.html'];

function viewportContent(html) {
    const tag = html.match(/<meta[^>]+name="viewport"[^>]*>/)?.[0];
    assert.ok(tag, 'viewport meta missing');
    return tag.match(/content="([^"]*)"/)[1];
}

test('static viewport meta allows zoom in every HTML entry', () => {
    for (const file of ENTRIES) {
        const content = viewportContent(read(file));
        assert.doesNotMatch(content, /user-scalable\s*=\s*(no|0)/i, file);
        const max = content.match(/maximum-scale\s*=\s*([\d.]+)/i);
        if (max) assert.ok(parseFloat(max[1]) > 1, `${file}: maximum-scale <= 1`);
    }
});

function runLock(capacitor) {
    const html = read('index.html');
    const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
    const meta = {
        content: viewportContent(html),
        getAttribute() { return this.content; },
        setAttribute(_, v) { this.content = v; },
    };
    const window = { Capacitor: capacitor };
    const document = { querySelector: (sel) => (sel === 'meta[name="viewport"]' ? meta : null) };
    vm.runInNewContext(script, { window, document });
    return meta.content;
}

test('native-only lock script runs only when Capacitor is native', () => {
    const base = viewportContent(read('index.html'));
    assert.equal(runLock(undefined), base);
    assert.equal(runLock({ isNativePlatform: () => false }), base);
    const locked = runLock({ isNativePlatform: () => true });
    assert.match(locked, /maximum-scale=1/);
    assert.match(locked, /user-scalable=no/);
});

function pngSize(path) {
    const b = readFileSync(path);
    assert.equal(b.toString('latin1', 1, 4), 'PNG');
    return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

test('manifest icons split into any and maskable with correct sizes', () => {
    const { icons } = JSON.parse(read('public/manifest.json'));
    assert.ok(icons.every((i) => i.purpose === 'any' || i.purpose === 'maskable'));
    for (const purpose of ['any', 'maskable']) {
        for (const size of [192, 512]) {
            const icon = icons.find((i) => i.purpose === purpose && i.sizes === `${size}x${size}`);
            assert.ok(icon, `${purpose} ${size} missing`);
            const file = join(ROOT, 'public', icon.src);
            assert.ok(existsSync(file), icon.src);
            assert.deepEqual(pngSize(file), [size, size], icon.src);
        }
    }
});
