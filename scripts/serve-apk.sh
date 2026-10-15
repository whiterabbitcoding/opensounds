#!/usr/bin/env bash
# Serves dist/ over HTTP on your Tailscale IP only (not the LAN), so a phone on the tailnet can download the APK:
#   scripts/serve-apk.sh [port]        # Ctrl-C to stop
set -euo pipefail
source "$(dirname "$0")/lib.sh"
PORT="${1:-8099}"
[ -f "$APK_OUT" ] || die "no APK at $APK_OUT — run scripts/build-apk.sh"
command -v tailscale >/dev/null || die "tailscale not installed"
IP=$(tailscale ip -4 2>/dev/null | head -1)
[ -n "$IP" ] || die "tailscale not connected"
ss -ltn sport = ":$PORT" 2>/dev/null | grep -q LISTEN && die "port $PORT already in use"
ok "open on the phone (Tailscale on):  http://$IP:$PORT/opensounds.apk"
exec python3 -m http.server "$PORT" --bind "$IP" --directory "$ROOT/dist"
