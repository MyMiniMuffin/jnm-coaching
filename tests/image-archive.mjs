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
