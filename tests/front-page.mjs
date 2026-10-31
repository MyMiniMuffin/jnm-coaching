// jnmcoaching.no/ is the coaching front page; the app lives under /app/.
// The build keeps the app in index.html (iOS and Vite load it), so the server maps the URLs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('server serves the front page on / and the app on /app/', () => {
    const server = read('server.mjs');
    assert.match(server, /'\/': 'coaching\/index\.html'/);
    assert.match(server, /'\/app\/': 'index\.html'/);
    assert.match(server, /'\/coaching\/': '\/'/);
    assert.match(server, /'\/app': '\/app\/'/);
});

test('installed web app, push clicks and login all open /app/', () => {
    assert.equal(JSON.parse(read('public/manifest.json')).start_url, '/app/');
    assert.match(read('public/sw.js'), /data\?\.url \|\| '\/app\/'/);
    assert.match(read('netlify/functions/push-delivery.js'), /url: '\/app\/'/);
    assert.match(read('src/coaching/CoachingLandingPage.jsx'), /href="\/app\/"[^>]*>Logg inn</);
});

test('signed-in visitors on the front page go to the app unless ?forside', () => {
    const entry = read('src/coaching/main.jsx');
    assert.match(entry, /hasValidSession\(\)/);
    assert.match(entry, /has\('forside'\)/);
    assert.match(entry, /location\.replace\('\/app\/'\)/);
});

test('front page links every public page and stays sticky', () => {
    const page = read('src/coaching/CoachingLandingPage.jsx');
    for (const href of ['#soknad', '/app/', '/oppstart/', '/support/', '/personvern/']) {
        assert.ok(page.includes(`href="${href}"`), href);
    }
    // overflow-hidden on the page root broke the sticky header.
    assert.doesNotMatch(page, /coaching-page[^"]*overflow-hidden/);
});
