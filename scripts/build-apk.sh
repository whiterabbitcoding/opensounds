#!/usr/bin/env bash
# Builds a standalone release APK → dist/symposium.apk (signed with the debug key: fine for sideloading).
#   scripts/build-apk.sh              # arm64 + x86_64 (phones and the emulator)
#   ARCHS=arm64-v8a scripts/build-apk.sh   # phone only: ~half the size, faster
set -euo pipefail
source "$(dirname "$0")/lib.sh"

[ -n "${JAVA_HOME:-}" ] || die "JDK 17 not found (set JAVA_HOME) — run scripts/doctor.sh"
[ -d "$ANDROID_HOME" ] || die "Android SDK not found at $ANDROID_HOME — run scripts/doctor.sh"
ARCHS="${ARCHS:-arm64-v8a,x86_64}"

# --legacy-peer-deps: Expo's optional react-native-worklets peer range conflicts under strict npm resolution.
[ -d node_modules ] || { info "installing dependencies…"; npm install --legacy-peer-deps; }
# android/ is generated (Continuous Native Generation) and gitignored; regenerate on a fresh clone.
[ -d android ] || { info "generating native project (expo prebuild)…"; npx expo prebuild --platform android --no-install; }
echo "sdk.dir=$ANDROID_HOME" > android/local.properties

info "typechecking…"
npx tsc --noEmit

info "gradle assembleRelease ($ARCHS)…"
(cd android && ./gradlew assembleRelease "-PreactNativeArchitectures=$ARCHS" --console=plain)

mkdir -p dist
cp android/app/build/outputs/apk/release/app-release.apk "$APK_OUT"
ok "built $APK_OUT ($(du -h "$APK_OUT" | cut -f1))"
