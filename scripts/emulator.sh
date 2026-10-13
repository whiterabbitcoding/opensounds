#!/usr/bin/env bash
# Headless Android emulator for testing (no window, no audio, software GPU).
#   scripts/emulator.sh create   # one-time: make the AVD (needs avdmanager, or SOURCE_AVD to clone)
#   scripts/emulator.sh start    # boot and wait until ready
#   scripts/emulator.sh stop
#   scripts/emulator.sh shot [file.png]   # screenshot of the framebuffer
#   scripts/emulator.sh ui       # dump the UI tree (text/bounds) — cheaper than screenshots for assertions
set -euo pipefail
source "$(dirname "$0")/lib.sh"
[ -x "$ADB" ] || die "adb not found — run scripts/doctor.sh"

case "${1:-}" in
  create)
    if command -v avdmanager >/dev/null || [ -x "$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager" ]; then
      AM="$(command -v avdmanager || echo "$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager")"
      IMG="${SYSTEM_IMAGE:-system-images;android-36;google_apis_playstore;x86_64}"
      echo no | "$AM" create avd -n "$AVD_NAME" -k "$IMG" -d pixel_9 --force
      ok "created AVD $AVD_NAME"
    elif [ -n "${SOURCE_AVD:-}" ] && [ -d "$HOME/.android/avd/$SOURCE_AVD.avd" ]; then
      # No avdmanager: clone an existing AVD's config; the emulator creates fresh userdata on first boot.
      d="$HOME/.android/avd/$AVD_NAME.avd"; mkdir -p "$d"
      sed "s/$SOURCE_AVD/$AVD_NAME/g" "$HOME/.android/avd/$SOURCE_AVD.avd/config.ini" > "$d/config.ini"
      printf 'avd.ini.encoding=UTF-8\npath=%s\npath.rel=avd/%s.avd\ntarget=android-36\n' "$d" "$AVD_NAME" > "$HOME/.android/avd/$AVD_NAME.ini"
      ok "cloned $SOURCE_AVD → $AVD_NAME"
    else
      die "need avdmanager (install Android cmdline-tools) or SOURCE_AVD=<existing avd> to clone"
    fi ;;
  start)
    "$ADB" devices | grep -q '^emulator-' && { ok "emulator already running"; exit 0; }
    [ -x "$EMULATOR" ] || die "emulator binary missing"
    nohup "$EMULATOR" -avd "$AVD_NAME" -no-window -no-audio -no-snapshot -gpu swiftshader_indirect >/tmp/symposium-emulator.log 2>&1 &
    info "booting $AVD_NAME (log: /tmp/symposium-emulator.log)…"
    "$ADB" wait-for-device
    until [ "$("$ADB" shell getprop sys.boot_completed | tr -d '\r')" = 1 ]; do sleep 2; done
    # A locked user hides non-direct-boot-aware activities ("Activity class does not exist"); wait for unlock.
    until "$ADB" shell dumpsys user | grep -q RUNNING_UNLOCKED; do sleep 2; done
    ok "emulator ready" ;;
  stop)
    "$ADB" emu kill >/dev/null 2>&1 && ok "emulator stopped" || info "no emulator running" ;;
  shot)
    out="${2:-/tmp/symposium-$(date +%H%M%S).png}"
    "$ADB" exec-out screencap -p > "$out" && ok "$out" ;;
  ui)
    "$ADB" shell uiautomator dump /sdcard/ui.xml >/dev/null && "$ADB" exec-out cat /sdcard/ui.xml ;;
  *) sed -n '2,9p' "$0"; exit 1 ;;
esac
