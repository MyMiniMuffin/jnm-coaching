#!/usr/bin/env bash
# One-time setup on the Oracle server. After this, merge/push to main deploys itself.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
INTERVAL="${1:-60s}"

if ! command -v systemctl >/dev/null; then
  echo "systemctl not found — this installer expects systemd." >&2
  exit 1
fi

mkdir -p "$UNIT_DIR"
chmod +x "$ROOT/deploy.sh" "$ROOT/scripts/install-auto-deploy.sh"

cat >"$UNIT_DIR/jnm-deploy.service" <<EOF
[Unit]
Description=Deploy JNM Coaching if origin/main has moved
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=$ROOT
ExecStart=$ROOT/deploy.sh
Nice=10
TimeoutStartSec=30min
EOF

cat >"$UNIT_DIR/jnm-deploy.timer" <<EOF
[Unit]
Description=Check JNM Coaching for updates every $INTERVAL

[Timer]
OnStartupSec=20s
OnUnitActiveSec=$INTERVAL
AccuracySec=10s
Persistent=true
Unit=jnm-deploy.service

[Install]
WantedBy=timers.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now jnm-deploy.timer

if command -v loginctl >/dev/null; then
  linger="$(loginctl show-user "$USER" -p Linger --value 2>/dev/null || true)"
  if [[ "$linger" != "yes" ]]; then
    if sudo -n loginctl enable-linger "$USER" 2>/dev/null; then
      echo "Enabled systemd linger for $USER (timer keeps running after logout)."
    else
      echo
      echo "ERROR: linger is off. The timer dies as soon as you log out, so"
      echo "pushes to main will not deploy. Run this once:"
      echo
      echo "  sudo loginctl enable-linger $USER"
      echo
    fi
  fi
fi

echo "Auto-deploy is on. Push/merge to origin/main and the server will pull + rebuild within $INTERVAL."
echo
echo "  status:  systemctl --user status jnm-deploy.timer"
echo "  logs:    journalctl --user -u jnm-deploy.service -n 50"
echo "           tail -f $ROOT/deploy.log"
echo "  force:   $ROOT/deploy.sh --force"
echo "  disable: systemctl --user disable --now jnm-deploy.timer"
