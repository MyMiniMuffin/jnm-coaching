#!/bin/sh
# Xcode Cloud runs this before resolving local Swift packages and archiving.
set -eu

log() {
    printf '[ci_post_clone] %s\n' "$*"
}

TASK_REPOSITORY_PATH=${CI_PRIMARY_REPOSITORY_PATH:-$(CDPATH= cd -- "$(dirname -- "$0")/../../.." && pwd)}
cd "$TASK_REPOSITORY_PATH"
log "cwd=$PWD"

# Cloud machines are ephemeral. Use the same Node major as GitHub checks.
if ! command -v node >/dev/null 2>&1 || ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) === 22 && Number(process.versions.node.split(".")[1]) >= 12 ? 0 : 1)'; then
    log "Installing node@22 via Homebrew…"
    export HOMEBREW_NO_AUTO_UPDATE=1
    brew install node@22
    PATH="$(brew --prefix node@22)/bin:$PATH"
    export PATH
fi

log "node=$(node --version) npm=$(npm --version)"

log "Step: npm ci"
npm ci --no-audit --no-fund

# Full `npm test` (incl. Playwright Chromium layout checks) runs in GitHub Actions.
# Xcode Cloud does not install Playwright browsers; keep this to non-browser unit tests.
log "Step: npm run test:unit (no Playwright)"
npm run test:unit

# Rebuild the bundled web UI and restore ignored Capacitor files/plugins.
# Do not run the production database migration from an iOS build.
log "Step: npm run ios:sync (vite build + cap sync ios)"
npm run ios:sync

log "done"
