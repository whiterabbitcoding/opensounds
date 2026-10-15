#!/usr/bin/env bash
# Builds a phone-only APK signed with YOUR release key, verifies it, writes a checksum, and (with --publish)
# creates a GitHub release.
#   scripts/release.sh              # (ARCHS=arm64-v8a,x86_64 to also test on an emulator) → dist/release/opensounds-v<version>.apk (+ .sha256)
#   scripts/release.sh --publish    # …and `gh release create v<version>`
# Key setup (once): keystore + env file live OUTSIDE the repo in ~/.config/opensounds/ (override: OPENSOUNDS_ENV).
#   release.env defines OPENSOUNDS_KEYSTORE, OPENSOUNDS_KEY_ALIAS, OPENSOUNDS_STORE_PASSWORD. Back it up — losing
#   the key means installs can never be updated in place.
set -euo pipefail
source "$(dirname "$0")/lib.sh"

ENV_FILE="${OPENSOUNDS_ENV:-$HOME/.config/opensounds/release.env}"
[ -f "$ENV_FILE" ] || die "no signing config at $ENV_FILE (see header of this script)"
set -a; source "$ENV_FILE"; set +a
[ -f "$OPENSOUNDS_KEYSTORE" ] || die "keystore missing: $OPENSOUNDS_KEYSTORE"

VERSION="$(node -p "require('./app.json').expo.version")"
OUT="$ROOT/dist/release"; APK="$OUT/opensounds-v$VERSION.apk"
APKSIGNER="$(ls "$ANDROID_HOME"/build-tools/*/apksigner | tail -1)"

# the signing plugin only takes effect on a freshly generated android/ project
if [ -d android ] && ! grep -q opensounds-release-signing android/app/build.gradle; then
  info "regenerating android/ to apply the signing plugin…"; rm -rf android
fi

ARCHS="${ARCHS:-arm64-v8a}" "$ROOT/scripts/build-apk.sh"
mkdir -p "$OUT"; cp "$APK_OUT" "$APK"

info "verifying signature…"
CERT="$("$APKSIGNER" verify --print-certs "$APK" | grep 'certificate DN')"
echo "$CERT" | grep -q 'CN=OpenSounds' || die "APK is NOT signed with the release key: $CERT"
(cd "$OUT" && sha256sum "$(basename "$APK")" > "$(basename "$APK").sha256")
ok "signed: $CERT"
ok "$APK ($(du -h "$APK" | cut -f1))  sha256 $(cut -c1-16 "$APK.sha256")…"

if [ "${1:-}" = "--publish" ]; then
  gh release create "v$VERSION" "$APK" "$APK.sha256" --title "OpenSounds $VERSION" --generate-notes
  ok "published v$VERSION"
else
  info "not published (add --publish)"
fi
