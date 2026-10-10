import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { createImageArchive } from '../src/lib/downloadImage.js';

test('archive preserves every image with unique names and original image URLs', async (t) => {
    const requested = [];
    t.mock.method(globalThis, 'fetch', async (url) => {
        requested.push(url);
        return new Response(new Uint8Array([requested.length, 42]));
    });
    const images = [
        { url: 'https://res.cloudinary.com/demo/image/upload/c_fill,w_100/v123/a.jpg', date: '2026-10-09' },
        { url: 'https://res.cloudinary.com/demo/image/upload/v123/b.jpg', date: '2026-10-09' }
    ];
    const zip = await JSZip.loadAsync(await createImageArchive(images));
    assert.deepEqual(Object.keys(zip.files), ['jnm-2026-10-09-1.jpg', 'jnm-2026-10-09-2.jpg']);
    assert.deepEqual([...await zip.file('jnm-2026-10-09-1.jpg').async('uint8array')], [1, 42]);
    assert.deepEqual([...await zip.file('jnm-2026-10-09-2.jpg').async('uint8array')], [2, 42]);
    assert.equal(requested[0], 'https://res.cloudinary.com/demo/image/upload/v123/a.jpg');
});

test('failed image fetch rejects instead of returning an incomplete archive', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 403 }));
    await assert.rejects(createImageArchive([{ url: 'https://example.com/image.jpg' }]), /Kunne ikke hente alle bildene/);
    await assert.rejects(createImageArchive([]), /Ingen bilder valgt/);
});

test('downloads at most four images concurrently and preserves selection order', async (t) => {
    let active = 0;
    let peak = 0;
    const pending = [];
    t.mock.method(globalThis, 'fetch', (url) => {
        active += 1;
        peak = Math.max(peak, active);
        return new Promise(resolve => pending.push(() => {
            active -= 1;
            resolve(new Response(new Uint8Array([Number(url.split('/').pop())])));
        }));
    });
    const images = Array.from({ length: 9 }, (_, index) => ({ url: `https://example.com/${index}` }));
    const result = createImageArchive(images);
    for (const batchSize of [4, 4, 1]) {
        // Wait for dynamic import / the preceding batch to finish, with a bound
        // so a regression fails rather than leaving the test hanging.
        for (let attempt = 0; pending.length < batchSize && attempt < 100; attempt += 1) {
            await new Promise(resolve => setTimeout(resolve, 5));
        }
        assert.equal(pending.length, batchSize);
        pending.splice(0).reverse().forEach(finish => finish());
    }
    const zip = await JSZip.loadAsync(await result);
    assert.equal(peak, 4);
    assert.equal(Object.keys(zip.files).length, 9);
    for (let index = 0; index < images.length; index += 1) {
        assert.deepEqual([...await zip.file(`jnm-${index + 1}.jpg`).async('uint8array')], [index]);
    }
});
