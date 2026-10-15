#!/usr/bin/env bash
# Installs dist/opensounds.apk on a connected device/emulator and launches it.
#   scripts/install.sh [adb-serial]          # serial optional; first device otherwise
# Wireless phone: `adb pair <ip:port>` then `adb connect <ip:port>` first (Developer options → Wireless debugging).
set -euo pipefail
source "$(dirname "$0")/lib.sh"
[ -f "$APK_OUT" ] || die "no APK at $APK_OUT — run scripts/build-apk.sh"
[ -x "$ADB" ] || die "adb not found"
S=()
[ -n "${1:-}" ] && S=(-s "$1")
"$ADB" "${S[@]}" get-state >/dev/null 2>&1 || die "no device attached (adb devices)"
"$ADB" "${S[@]}" install -r "$APK_OUT"
"$ADB" "${S[@]}" shell am start -n "$APP_ID/.MainActivity" >/dev/null
ok "installed and launched $APP_ID"
