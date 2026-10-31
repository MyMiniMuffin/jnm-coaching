#!/usr/bin/env bash
# Pull origin/main and rebuild JNM Coaching when GitHub has moved.
# Production: Oracle systemd timer jnm-deploy.timer (see scripts/install-auto-deploy.sh).
# Safe to run from systemd/cron — no-ops when already up to date.
set -euo pipefail

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin${PATH:+:$PATH}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

LOG="${DEPLOY_LOG:-$ROOT/deploy.log}"
LOCK="$ROOT/.deploy.lock"
DEPLOYED_SHA_FILE="$ROOT/.deployed-sha"
BRANCH="${DEPLOY_BRANCH:-main}"
REMOTE="${DEPLOY_REMOTE:-origin}"
FORCE=0

for arg in "$@"; do
  case "$arg" in
    --force|-f) FORCE=1 ;;
    --help|-h)
      echo "Usage: $0 [--force]"
      echo "  --force   rebuild even when HEAD already matches $REMOTE/$BRANCH"
      exit 0
      ;;
    *)
      echo "unknown arg: $arg" >&2
      exit 2
      ;;
  esac
done

log() {
  local line
  line="[$(date '+%Y-%m-%d %H:%M:%S')] $*"
  echo "$line"
  mkdir -p "$(dirname "$LOG")"
  echo "$line" >>"$LOG"
}

if ! command -v git >/dev/null; then
  echo "git is not on PATH" >&2
  exit 1
fi
if ! command -v docker >/dev/null; then
  echo "docker is not on PATH" >&2
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  compose() { docker compose "$@"; }
elif command -v docker-compose >/dev/null; then
  compose() { docker-compose "$@"; }
else
  echo "docker compose is not installed" >&2
  exit 1
fi

exec 9>"$LOCK"
if ! flock -n 9; then
  log "skip: another deploy is already running"
  exit 0
fi

log "start (force=$FORCE)"

if [[ ! -d .git ]]; then
  log "error: $ROOT is not a git checkout — clone github.com/MyMiniMuffin/jnm-coaching first"
  exit 1
fi

current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$current_branch" != "$BRANCH" ]]; then
  log "error: on '$current_branch', expected '$BRANCH'"
  exit 1
fi

git fetch --prune --quiet "$REMOTE" "$BRANCH"

local_sha="$(git rev-parse HEAD)"
remote_sha="$(git rev-parse "$REMOTE/$BRANCH")"

if [[ "$local_sha" == "$remote_sha" && "$FORCE" -eq 0 &&
      "$(cat "$DEPLOYED_SHA_FILE" 2>/dev/null || true)" == "$local_sha" ]]; then
  log "already up to date (${local_sha:0:8})"
  exit 0
fi

if [[ "$local_sha" != "$remote_sha" ]]; then
  log "updating ${local_sha:0:8} -> ${remote_sha:0:8}"
  if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
    log "error: working tree has local changes; not pulling"
    git status --porcelain --untracked-files=no | tee -a "$LOG"
    exit 1
  fi
  git merge --ff-only "$REMOTE/$BRANCH"
fi

if [[ "$FORCE" -eq 1 || "$(cat "$DEPLOYED_SHA_FILE" 2>/dev/null || true)" != "$(git rev-parse HEAD)" ]]; then
  # Never build here: the 1 GB VM is shared with MetalFlow. GitHub Actions
  # publishes the image (docker-image.yml); wait for it, then pull and start.
  export JNM_IMAGE_TAG="$(git rev-parse HEAD)"
  if ! compose pull --quiet 2>>"$LOG"; then
    log "image ${JNM_IMAGE_TAG:0:8} not on ghcr.io yet; retrying next run"
    exit 0
  fi
  log "starting ${JNM_IMAGE_TAG:0:8}"
  compose up -d --no-build --remove-orphans
  git rev-parse HEAD >"$DEPLOYED_SHA_FILE"
fi

log "done ($(git rev-parse --short HEAD))"
