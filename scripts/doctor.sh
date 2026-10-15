#!/usr/bin/env bash
# Checks every prerequisite for building, testing and running OpenSounds and says what's missing.
#   scripts/doctor.sh                      # dev machine + server reachable on localhost
#   OPENSOUNDS_SERVER=http://100.x.y.z:4533 scripts/doctor.sh
set -uo pipefail
source "$(dirname "$0")/lib.sh"

fails=0
need() { fails=$((fails + 1)); }

echo "== Dev machine =="
if command -v node >/dev/null; then
  v=$(node -p 'process.versions.node.split(".")[0]')
  if [ "$v" -ge 20 ]; then ok "node $(node -v)"; else bad "node $(node -v) — need >= 20"; need; fi
else bad "node not found (install Node 20+)"; need; fi

if [ -n "${JAVA_HOME:-}" ] && "$JAVA_HOME/bin/java" -version 2>&1 | grep -q '"17\.'; then ok "JDK 17 at $JAVA_HOME"
else bad "JDK 17 not found (Arch: sudo pacman -S jdk17-openjdk) — Gradle/RN 0.86 need 17, not 24"; need; fi

if [ -d "$ANDROID_HOME" ]; then ok "ANDROID_HOME=$ANDROID_HOME"; else bad "Android SDK missing at $ANDROID_HOME (see docs/SETUP.md §3)"; need; fi
[ -x "$ADB" ] && ok "adb: $ADB" || { bad "adb (platform-tools) missing"; need; }
for p in "platforms/android-36" "build-tools"; do
  [ -d "$ANDROID_HOME/$p" ] && ok "SDK $p" || { bad "SDK $p missing — sdkmanager \"platforms;android-36\" \"build-tools;36.0.0\""; need; }
done
[ -d "$ANDROID_HOME/ndk" ] && ok "SDK ndk" || { bad "SDK ndk missing — needed for React Native native code"; need; }
[ -x "$EMULATOR" ] && ok "emulator binary" || warn "emulator not installed (only needed for local testing)"
[ -w /dev/kvm ] && ok "/dev/kvm accessible (fast emulator)" || warn "/dev/kvm not writable — emulator will be very slow (add yourself to the kvm group)"
[ -d node_modules ] && ok "node_modules installed" || warn "node_modules missing — run: npm install --legacy-peer-deps"

echo; echo "== Server (Navidrome) =="
if curl -fsS -m 5 "$SERVER_URL/rest/ping?f=json" 2>/dev/null | grep -q '"type":"navidrome"'; then
  ok "Navidrome answering at $SERVER_URL"
else
  bad "no Navidrome at $SERVER_URL (docs/SETUP.md §1; or set OPENSOUNDS_SERVER)"; need
fi
if command -v systemctl >/dev/null && systemctl list-unit-files navidrome.service >/dev/null 2>&1; then
  systemctl is-active --quiet navidrome && ok "navidrome.service active" || warn "navidrome.service not active"
fi

echo; echo "== Tailscale =="
if command -v tailscale >/dev/null; then
  ip=$(tailscale ip -4 2>/dev/null | head -1)
  if [ -n "$ip" ]; then ok "tailscale up, this machine = $ip  → server URL for the phone: http://$ip:4533"
  else bad "tailscale installed but not connected (sudo tailscale up)"; need; fi
else bad "tailscale not installed (docs/SETUP.md §2)"; need; fi

echo; echo "== Devices =="
if [ -x "$ADB" ]; then
  d=$("$ADB" devices | awk 'NR>1 && $2=="device"{print $1}')
  if [ -n "$d" ]; then ok "adb devices: $(echo "$d" | tr '\n' ' ')"; else info "no adb device/emulator attached (scripts/emulator.sh start, or plug in a phone)"; fi
fi

echo
if [ "$fails" -eq 0 ]; then ok "all required checks passed"; else bad "$fails required check(s) failed"; exit 1; fi
