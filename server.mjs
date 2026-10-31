/**
 * Self-hosted replacement for Netlify (Oracle + Caddy, same setup as MetalFlow).
 *
 * - Serves the Vite build in dist/ with the headers/redirects Netlify used to set.
 * - Runs the existing functions unchanged: classic handlers under
 *   /.netlify/functions/<name> and the v2 onboarding upload at
 *   /api/onboarding-image-upload (with the rate limit Netlify used to enforce).
 * - Takes over Netlify Forms: POST / with form-name is stored by forms.js.
 *
 * Caddy terminates HTTPS, compresses responses and sets X-Forwarded-For.
 */
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT) || 3000;
const MAX_BODY_BYTES = 15 * 1024 * 1024;

// Functions that export a classic Netlify handler. Helpers (auth-middleware,
// http-utils, push-delivery) are not routable.
const HANDLERS = new Set([
    'account-deletion',
    'activity',
    'auth',
    'data',
    'form-submissions',
    'health-check',
    'push-subscriptions',
    'upload',
    'users',
]);

const SECURITY_HEADERS = {
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https://res.cloudinary.com; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://res.cloudinary.com; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests",
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(), payment=()',
};

const CONTENT_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.txt': 'text/plain; charset=utf-8',
    '.webmanifest': 'application/manifest+json',
};

/** Cache rules carried over from Netlify: hashed assets forever, HTML and sw.js always fresh. */
const cacheControlFor = (urlPath, filePath) => {
    if (urlPath.startsWith('/assets/')) return 'public, max-age=31536000, immutable';
    if (filePath.endsWith('.html') || urlPath === '/sw.js') return 'public, max-age=0, must-revalidate';
    if (/\.(png|jpe?g)$/.test(urlPath) || urlPath === '/manifest.json') return 'public, max-age=86400';
    return null;
};

const readBody = (req) => new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    req.on('data', (chunk) => {
        if (tooLarge) return; // drain the rest so the client still gets the 413
        size += chunk.length;
        if (size > MAX_BODY_BYTES) {
            tooLarge = true;
            chunks.length = 0;
            reject(Object.assign(new Error('Request body too large'), { status: 413 }));
            return;
        }
        chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
});

const send = (res, status, headers, body) => {
    res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
    res.end(body);
};

const sendJson = (res, status, payload) => send(
    res,
    status,
    { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    JSON.stringify(payload)
);

const handlerCache = new Map();
const loadHandler = (name) => {
    if (!handlerCache.has(name)) {
        handlerCache.set(name, require(path.join(ROOT, 'netlify/functions', `${name}.js`)).handler);
    }
    return handlerCache.get(name);
};

/** Builds the event shape the functions read: httpMethod, headers, body, queryStringParameters. */
const runClassicFunction = async (name, req, res, url) => {
    const body = await readBody(req);
    const event = {
        httpMethod: req.method,
        path: url.pathname,
        headers: req.headers,
        queryStringParameters: Object.fromEntries(url.searchParams),
        body: body.length ? body.toString('utf8') : null,
        isBase64Encoded: false,
    };
    const result = await loadHandler(name)(event, {});
    const headers = { ...(result?.headers || {}) };
    for (const [key, values] of Object.entries(result?.multiValueHeaders || {})) headers[key] = values;
    const payload = result?.isBase64Encoded ? Buffer.from(result.body || '', 'base64') : (result?.body ?? '');
    send(res, result?.statusCode || 200, headers, payload);
};

const clientIp = (req) => (
    String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.socket.remoteAddress
    || 'unknown'
);

/** Sliding-window limit per client IP, in memory (one container). */
const createRateLimiter = (limit, windowMs) => {
    const hits = new Map();
    setInterval(() => {
        const now = Date.now();
        for (const [ip, times] of hits) {
            if (times.every((time) => now - time >= windowMs)) hits.delete(ip);
        }
    }, windowMs).unref();
    return (ip) => {
        const now = Date.now();
        const recent = (hits.get(ip) || []).filter((time) => now - time < windowMs);
        recent.push(now);
        hits.set(ip, recent);
        return recent.length > limit;
    };
};

// Netlify rate limit for onboarding uploads: 6 requests per 180 s per client IP.
const isOnboardingLimited = createRateLimiter(6, 180_000);
// Public forms (replaces Netlify Forms): 5 submissions per 10 min per client IP.
const isFormLimited = createRateLimiter(5, 600_000);

const runForm = async (req, res, url) => {
    if (isFormLimited(clientIp(req))) {
        sendJson(res, 429, { error: 'For mange innsendinger. Vent litt og prøv igjen.' });
        return;
    }
    await runClassicFunction('forms', req, res, url);
};

let onboardingUpload;
const runOnboardingUpload = async (req, res, url) => {
    if (isOnboardingLimited(clientIp(req))) {
        sendJson(res, 429, { error: 'For mange forsøk. Vent litt og prøv igjen.' });
        return;
    }
    onboardingUpload ??= (await import('./netlify/functions/onboarding-image-upload.mjs')).default;
    const body = await readBody(req);
    const request = new Request(new URL(url.pathname + url.search, `https://${req.headers.host || 'localhost'}`), {
        method: req.method,
        headers: Object.entries(req.headers).flatMap(([key, value]) => (
            Array.isArray(value) ? value.map((item) => [key, item]) : [[key, value]]
        )),
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
    });
    const response = await onboardingUpload(request);
    send(res, response.status, Object.fromEntries(response.headers), Buffer.from(await response.arrayBuffer()));
};

const fileStat = async (filePath) => {
    try {
        return await stat(filePath);
    } catch {
        return null;
    }
};

// The build keeps the app in index.html (iOS/Capacitor and Vite load it from
// there). On the web the coaching page is the front page and the app lives
// under /app/, so the server maps those URLs to the built files.
const PAGES = {
    '/': 'coaching/index.html',
    '/app/': 'index.html',
};
const REDIRECTS = {
    '/coaching': '/',
    '/coaching/': '/',
    '/coaching/index.html': '/',
    '/index.html': '/app/',
    '/app': '/app/',
    '/app/index.html': '/app/',
};

const serveStatic = async (req, res, url) => {
    let urlPath;
    try {
        urlPath = decodeURIComponent(url.pathname);
    } catch {
        send(res, 400, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Bad request');
        return;
    }
    if (REDIRECTS[urlPath]) {
        send(res, 301, { Location: `${REDIRECTS[urlPath]}${url.search}` }, '');
        return;
    }
    let filePath = path.join(DIST, PAGES[urlPath] || path.normalize(urlPath));
    if (filePath !== DIST && !filePath.startsWith(DIST + path.sep)) {
        send(res, 403, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Forbidden');
        return;
    }

    let info = await fileStat(filePath);
    if (info?.isDirectory()) {
        // /coaching → /coaching/ (the 301 redirects Netlify had)
        if (!urlPath.endsWith('/')) {
            send(res, 301, { Location: `${url.pathname}/${url.search}` }, '');
            return;
        }
        filePath = path.join(filePath, 'index.html');
        info = await fileStat(filePath);
    }
    if (!info?.isFile()) {
        send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not found');
        return;
    }

    const headers = {
        'Content-Type': CONTENT_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
        'Content-Length': info.size,
    };
    const cacheControl = cacheControlFor(urlPath, filePath);
    if (cacheControl) headers['Cache-Control'] = cacheControl;
    res.writeHead(200, { ...SECURITY_HEADERS, ...headers });
    if (req.method === 'HEAD') {
        res.end();
        return;
    }
    createReadStream(filePath).pipe(res);
};

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');
    try {
        if (url.pathname === '/healthz') {
            sendJson(res, 200, { ok: true });
            return;
        }
        const fnMatch = url.pathname.match(/^\/\.netlify\/functions\/([a-z-]+)\/?$/);
        if (fnMatch) {
            if (!HANDLERS.has(fnMatch[1])) {
                sendJson(res, 404, { error: 'Not found' });
                return;
            }
            await runClassicFunction(fnMatch[1], req, res, url);
            return;
        }
        if (url.pathname === '/api/onboarding-image-upload') {
            await runOnboardingUpload(req, res, url);
            return;
        }
        // Netlify Forms posted to "/" with form-name; the pages still do.
        if (url.pathname === '/' && req.method === 'POST') {
            await runForm(req, res, url);
            return;
        }
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            send(res, 405, { Allow: 'GET, HEAD' }, '');
            return;
        }
        await serveStatic(req, res, url);
    } catch (error) {
        if (error?.status === 413) {
            res.setHeader('Connection', 'close');
            sendJson(res, 413, { error: 'Forespørselen er for stor.' });
            return;
        }
        console.error('Request failed:', url.pathname, error?.message || error);
        if (!res.headersSent) sendJson(res, 500, { error: 'Intern feil' });
        else res.end();
    }
});

server.listen(PORT, () => {
    console.log(`JNM Coaching listening on :${PORT}`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
