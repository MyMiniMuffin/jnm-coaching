import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { IMAGE_ZOOM_PROPS } from '../src/lib/zoomConfig.js';

test('IMAGE_ZOOM_PROPS følger react-zoom-pan-pinch v4-API', () => {
    assert.equal(IMAGE_ZOOM_PROPS.minScale, 1);
    assert.equal(IMAGE_ZOOM_PROPS.maxScale, 5);
    assert.equal(IMAGE_ZOOM_PROPS.centerOnInit, true);
    assert.equal(IMAGE_ZOOM_PROPS.limitToBounds, true);
    assert.equal(IMAGE_ZOOM_PROPS.smooth, true);

    assert.ok(IMAGE_ZOOM_PROPS.wheel);
    assert.equal(typeof IMAGE_ZOOM_PROPS.wheel.step, 'number');
    assert.ok(IMAGE_ZOOM_PROPS.wheel.step > 0);
    assert.ok(IMAGE_ZOOM_PROPS.wheel.step < 0.1, 'v4 smooth step skal være liten (gammel smoothStep-skala)');
    assert.equal(IMAGE_ZOOM_PROPS.wheel.smoothStep, undefined);

    assert.ok(IMAGE_ZOOM_PROPS.autoAlignment);
    assert.equal(IMAGE_ZOOM_PROPS.alignmentAnimation, undefined);

    assert.equal(IMAGE_ZOOM_PROPS.doubleClick.mode, 'toggle');
    assert.equal(IMAGE_ZOOM_PROPS.velocityAnimation.disabled, true);
});

test('ImageModal bruker onTransform (v4), ikke onTransformed (v3)', () => {
    const source = readFileSync(new URL('../src/components/ImageModal.jsx', import.meta.url), 'utf8');
    assert.match(source, /onTransform=\{/);
    assert.doesNotMatch(source, /onTransformed=/);
});

test('package.json pinner React 19.3.x og react-zoom-pan-pinch 4.x', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    assert.match(String(pkg.dependencies.react), /^19\.3\./);
    assert.match(String(pkg.dependencies['react-dom']), /^19\.3\./);
    assert.match(String(pkg.dependencies['react-zoom-pan-pinch']), /^4\./);
});
