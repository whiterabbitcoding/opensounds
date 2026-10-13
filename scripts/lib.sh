# shellcheck shell=bash
# Shared environment for the Symposium helper scripts. Source it; don't execute it.
# Everything here is overridable via environment variables.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
if [ -z "${JAVA_HOME:-}" ]; then
  for j in /usr/lib/jvm/java-17-openjdk /usr/lib/jvm/java-17-openjdk-amd64 /usr/lib/jvm/temurin-17-jdk; do
    [ -d "$j" ] && export JAVA_HOME="$j" && break
  done
fi

ADB="$ANDROID_HOME/platform-tools/adb"
[ -x "$ADB" ] || ADB="$(command -v adb || true)"
EMULATOR="$ANDROID_HOME/emulator/emulator"
AVD_NAME="${AVD_NAME:-Symposium_Test}"
APK_OUT="$ROOT/dist/symposium.apk"
APP_ID="dev.goose.symposium"
SERVER_URL="${SYMPOSIUM_SERVER:-http://localhost:4533}"

if [ -t 1 ]; then
  C_OK=$'\e[32m'; C_BAD=$'\e[31m'; C_WARN=$'\e[33m'; C_DIM=$'\e[2m'; C_OFF=$'\e[0m'
else
  C_OK=""; C_BAD=""; C_WARN=""; C_DIM=""; C_OFF=""
fi
ok()   { printf '%s✓%s %s\n' "$C_OK" "$C_OFF" "$*"; }
bad()  { printf '%s✗%s %s\n' "$C_BAD" "$C_OFF" "$*"; }
warn() { printf '%s!%s %s\n' "$C_WARN" "$C_OFF" "$*"; }
info() { printf '%s%s%s\n' "$C_DIM" "$*" "$C_OFF"; }
die()  { bad "$*"; exit 1; }
