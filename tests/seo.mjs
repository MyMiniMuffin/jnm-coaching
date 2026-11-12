// On-page SEO: canonical homepage, robots/sitemap, noindex for private shells,
// legal meta, heading hierarchy, and JSON-LD facts already present in the repo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');

test('homepage canonical and og:url point at / not /coaching/', () => {
    const html = read('coaching/index.html');
    assert.match(html, /<link rel="canonical" href="https:\/\/jnmcoaching\.no\/">/);
    assert.match(html, /property="og:url" content="https:\/\/jnmcoaching\.no\/"/);
    assert.doesNotMatch(html, /https:\/\/jnmcoaching\.no\/coaching\//);
    assert.match(html, /lang="nb"/);
});

test('homepage includes WebSite and Organization JSON-LD for jnmcoaching.no', () => {
    const html = read('coaching/index.html');
    assert.match(html, /application\/ld\+json/);
    assert.match(html, /"@type":\s*"WebSite"/);
    assert.match(html, /"@type":\s*\["Organization",\s*"ProfessionalService"\]/);
    assert.match(html, /"url":\s*"https:\/\/jnmcoaching\.no\/"/);
    assert.match(html, /"name":\s*"JNM Coaching"/);
    assert.match(html, /"email":\s*"kontakt@perfectmorning\.dev"/);
    assert.match(html, /"name":\s*"Perfect Morning AS"/);
    assert.doesNotMatch(html, /"telephone"/);
    assert.doesNotMatch(html, /"address"/);
    assert.doesNotMatch(html, /"priceRange"/);
});

test('robots.txt allows public pages and disallows private paths', () => {
    const robots = read('public/robots.txt');
    assert.match(robots, /Allow:\s*\/$/m);
    assert.match(robots, /Allow:\s*\/personvern\//);
    assert.match(robots, /Allow:\s*\/support\//);
    assert.match(robots, /Disallow:\s*\/app\//);
    assert.match(robots, /Disallow:\s*\/oppstart\//);
    assert.match(robots, /Disallow:\s*\/\.netlify\/functions\//);
    assert.match(robots, /Disallow:\s*\/api\//);
    assert.match(robots, /Sitemap:\s*https:\/\/jnmcoaching\.no\/sitemap\.xml/);
});

test('sitemap.xml lists only public canonical URLs', () => {
    const sitemap = read('public/sitemap.xml');
    assert.match(sitemap, /<loc>https:\/\/jnmcoaching\.no\/<\/loc>/);
    assert.match(sitemap, /<loc>https:\/\/jnmcoaching\.no\/personvern\/<\/loc>/);
    assert.match(sitemap, /<loc>https:\/\/jnmcoaching\.no\/support\/<\/loc>/);
    assert.doesNotMatch(sitemap, /\/coaching\//);
    assert.doesNotMatch(sitemap, /\/app\//);
    assert.doesNotMatch(sitemap, /\/oppstart\//);
});

test('server maps .xml to application/xml', () => {
    assert.match(read('server.mjs'), /\.xml': 'application\/xml(?:; charset=utf-8)?'/);
});

test('app shell is noindex; oppstart stays noindex', () => {
    assert.match(read('index.html'), /<meta name="robots" content="noindex, nofollow">/);
    assert.match(read('oppstart/index.html'), /<meta name="robots" content="noindex, nofollow">/);
    assert.match(read('index.html'), /lang="nb"/);
    assert.match(read('oppstart/index.html'), /lang="nb"/);
});

test('legal pages have description, canonical, robots, og, theme-color and favicons', () => {
    for (const [rel, canonical] of [
        ['personvern/index.html', 'https://jnmcoaching.no/personvern/'],
        ['support/index.html', 'https://jnmcoaching.no/support/'],
    ]) {
        const html = read(rel);
        assert.match(html, /lang="nb"/);
        assert.match(html, /<meta name="description" content="[^"]+">/);
        assert.match(html, new RegExp(`<link rel="canonical" href="${canonical.replaceAll('.', '\\.')}">`));
        assert.match(html, /<meta name="robots" content="index, follow">/);
        assert.match(html, /property="og:url"/);
        assert.match(html, /property="og:title"/);
        assert.match(html, /property="og:description"/);
        assert.match(html, /property="og:image"/);
        assert.match(html, /property="og:locale" content="nb_NO"/);
        assert.match(html, /name="theme-color" content="#F7F7F4"/);
        assert.match(html, /href="\/favicon\.svg\?v=5"/);
        assert.match(html, /href="\/favicon-32\.png\?v=5"/);
        assert.match(html, /href="\/icon-192\.png"/);
    }
});

test('privacy section headings are h2 under the page h1', () => {
    const legal = read('src/legal/LegalContent.jsx');
    assert.match(legal, /<h2 className="font-semibold text-ink mb-1">Ansvarlig og kontakt<\/h2>/);
    assert.doesNotMatch(legal, /<h3 className="font-semibold text-ink mb-1">/);
    assert.match(read('src/legal/main.jsx'), /<h1 /);
});

test('built dist keeps robots, sitemap and SEO head tags when present', () => {
    const dist = path.join(root, 'dist');
    if (!existsSync(dist)) return;
    assert.equal(existsSync(path.join(dist, 'robots.txt')), true);
    assert.equal(existsSync(path.join(dist, 'sitemap.xml')), true);
    const home = read('dist/coaching/index.html');
    assert.match(home, /<link rel="canonical" href="https:\/\/jnmcoaching\.no\/">/);
    assert.match(home, /application\/ld\+json/);
    assert.match(read('dist/index.html'), /noindex, nofollow/);
    assert.match(read('dist/personvern/index.html'), /rel="canonical" href="https:\/\/jnmcoaching\.no\/personvern\/"/);
    assert.match(read('dist/support/index.html'), /rel="canonical" href="https:\/\/jnmcoaching\.no\/support\/"/);
});
