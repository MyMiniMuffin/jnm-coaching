#!/bin/sh
# Xcode Cloud runs this before resolving local Swift packages and archiving.
set -eu

TASK_REPOSITORY_PATH=${CI_PRIMARY_REPOSITORY_PATH:-$(CDPATH= cd -- "$(dirname -- "$0")/../../.." && pwd)}
cd "$TASK_REPOSITORY_PATH"

# Cloud machines are ephemeral. Use the same Node major as GitHub checks.
if ! command -v node >/dev/null 2>&1 || ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) === 22 && Number(process.versions.node.split(".")[1]) >= 12 ? 0 : 1)'; then
    export HOMEBREW_NO_AUTO_UPDATE=1
    brew install node@22
    PATH="$(brew --prefix node@22)/bin:$PATH"
    export PATH
fi

node --version
npm ci --no-audit --no-fund
npm test
# Rebuild the bundled web UI and restore ignored Capacitor files/plugins.
# Do not run the production database migration from an iOS build.
npm run ios:sync
