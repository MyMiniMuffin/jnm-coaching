import { spawn } from 'node:child_process';
import { access, mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const INPUT_DIRS = ['src', 'public'];
const INPUT_FILES = [
    'index.html',
    'vite.config.js',
    'tailwind.config.mjs',
    'postcss.config.js',
    'package.json',
    'coaching/index.html',
    'oppstart/index.html',
    'personvern/index.html',
    'support/index.html',
];

async function newestMtime(dir) {
    let newest = 0;
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            newest = Math.max(newest, await newestMtime(full));
        } else {
            newest = Math.max(newest, (await stat(full)).mtimeMs);
        }
    }
    return newest;
}

export async function isDistFresh(root = ROOT) {
    try {
        const distIndex = join(root, 'dist/index.html');
        await access(distIndex);
        await access(join(root, 'dist/assets'));
        const distTime = (await stat(distIndex)).mtimeMs;
        let newestInput = 0;
        for (const dir of INPUT_DIRS) {
            newestInput = Math.max(newestInput, await newestMtime(join(root, dir)));
        }
        for (const file of INPUT_FILES) {
            newestInput = Math.max(newestInput, (await stat(join(root, file))).mtimeMs);
        }
        return distTime >= newestInput;
    } catch {
        return false;
    }
}

function getFreePort() {
    return new Promise((resolve, reject) => {
        const server = createServer();
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            server.close((error) => (error ? reject(error) : resolve(port)));
        });
        server.on('error', reject);
    });
}

async function waitForUrl(url, timeoutMs = 60_000) {
    const start = Date.now();
    let lastError;
    while (Date.now() - start < timeoutMs) {
        try {
            const response = await fetch(url);
            if (response.ok) return;
            lastError = new Error(`HTTP ${response.status}`);
        } catch (error) {
            lastError = error;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`Server not ready at ${url}: ${lastError?.message || lastError}`);
}

export async function ensurePreview({ externalBase = '', prefix = 'jnm-preview-' } = {}) {
    if (externalBase) {
        await waitForUrl(externalBase);
        return { base: externalBase, stop: async () => {} };
    }

    let tempOutDir = null;
    if (!(await isDistFresh())) {
        tempOutDir = await mkdtemp(join(tmpdir(), prefix));
        try {
            await new Promise((resolve, reject) => {
                const child = spawn('npx', ['vite', 'build', '--outDir', tempOutDir, '--emptyOutDir'], {
                    cwd: ROOT,
                    stdio: ['ignore', 'ignore', 'pipe'],
                });
                let stderr = '';
                child.stderr.on('data', (chunk) => { stderr += chunk; });
                child.on('error', reject);
                child.on('exit', (code) => {
                    if (code === 0) resolve();
                    else reject(new Error(`vite build failed (${code}): ${stderr}`));
                });
            });
        } catch (error) {
            await rm(tempOutDir, { recursive: true, force: true }).catch(() => {});
            throw error;
        }
    }

    const port = await getFreePort();
    const base = `http://127.0.0.1:${port}`;
    const previewArgs = tempOutDir
        ? ['vite', 'preview', '--outDir', tempOutDir, '--host', '127.0.0.1', '--port', String(port), '--strictPort']
        : ['vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'];
    const child = spawn('npx', previewArgs, {
        cwd: ROOT,
        stdio: ['ignore', 'ignore', 'pipe'],
        detached: true,
    });

    let stderr = '';
    let spawnError = null;
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => { spawnError = error; });
    child.unref();

    const stop = async () => {
        if (child.pid) {
            try {
                process.kill(-child.pid, 'SIGTERM');
            } catch {
                try { child.kill('SIGTERM'); } catch {}
            }
            await Promise.race([
                new Promise((resolve) => child.once('exit', resolve)),
                new Promise((resolve) => setTimeout(resolve, 2000)),
            ]);
            try {
                process.kill(-child.pid, 'SIGKILL');
            } catch {
                try { child.kill('SIGKILL'); } catch {}
            }
        }
        if (tempOutDir) {
            await rm(tempOutDir, { recursive: true, force: true }).catch(() => {});
        }
    };

    try {
        await Promise.race([
            waitForUrl(base),
            new Promise((_, reject) => {
                if (spawnError) reject(spawnError);
                else child.once('error', reject);
            }),
        ]);
    } catch (error) {
        await stop();
        throw new Error(`${error.message}\npreview stderr: ${stderr}`);
    }

    return { base, stop };
}
