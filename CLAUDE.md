# Symposium — working notes for Claude

Android music player (Expo SDK 57 / RN 0.86, TypeScript) for a self-hosted Navidrome server over Tailscale. **Read `README.md` for features, `docs/SETUP.md` for environment, `docs/ARCHITECTURE.md` for design (player, radio algorithm, caching).** Expo-specific API rules are in `AGENTS.md` (fetch versioned docs before touching Expo APIs; use `npx expo install`).

## Commands

```bash
scripts/doctor.sh                 # toolchain + Navidrome + Tailscale + device check
scripts/build-apk.sh              # typecheck + gradle → dist/symposium.apk   (ARCHS=arm64-v8a for phone-only)
scripts/emulator.sh start|stop|shot|ui   # headless AVD "Symposium_Test"
scripts/install.sh                # adb install + launch
scripts/serve-apk.sh              # tailnet-only download link for the phone
npm run typecheck && npm run lint # both must stay at 0 errors/warnings
```

## Rules of the road

- **Local Gradle builds, not EAS.** `android/` is generated (`expo prebuild`) and gitignored — never hand-edit it; native config goes in `app.json` / config plugins / `modules/`.
- **Install deps with `npm install --legacy-peer-deps`** (`npx expo install <pkg> -- --legacy-peer-deps`) — plain installs hit an `ERESOLVE` on an optional `react-native-worklets` peer.
- **JDK 17 only.** RN 0.86 is **New-Architecture-only**: `react-native-track-player` is unusable; playback is `expo-audio` with a JS queue (`src/lib/player.ts`).
- Keep `tsc` and `eslint` clean. The React-Compiler lint rules (`set-state-in-effect`, `refs`) are on — derive state or key components instead of resetting state in effects (see `EntityMenu`, `search.tsx`, `now-playing.tsx`).
- **No secrets/personal data in the repo.** The Navidrome login lives only on the device (SecureStore). Never commit server IPs, passwords, `.env*`, keystores. Don't write test credentials to files in the repo.
- JS-only changes need only `scripts/build-apk.sh` (~15–30 s warm); adding a native package or editing `modules/`/`app.json` plugins needs `expo prebuild` (the script does it if `android/` is missing; run `npx expo prebuild --platform android --no-install` after plugin changes).

## Testing workflow (no physical device needed)

1. `scripts/emulator.sh start && scripts/install.sh`
2. Drive with `adb shell input tap/swipe` (coordinates from a screenshot ×1.21 if viewed downscaled); `adb input text` **drops characters** — type slowly or per-character; the on-screen button positions shift when an error line appears.
3. Prefer `scripts/emulator.sh ui` (UI tree) and `adb logcat -d | grep -E "FATAL EXCEPTION|ReactNativeJS"` over screenshots for assertions; use `shot` for visual checks.
4. Playback truth: `adb shell dumpsys media_session` (state/position/metadata) and `dumpsys activity services dev.goose.symposium` (foreground media service).
5. The user's own `Pixel_9` AVD has a locked user (`RUNNING_LOCKED` → "Activity class does not exist"); use `Symposium_Test`.

## Gotchas learned

- Navidrome similarity (`getArtistInfo2`/`getSimilarSongs2`) is the radio's data source; first-time lookups are slow (seconds), cached ones ~15 ms; some artists genuinely have none → radio falls back to genre/random top-up.
- Album seeds from compilations ("Various Artists") must seed from the tracks' artists (handled in `radio.ts`).
- Saved radios dedupe by seed key; regenerating replaces the entry.
- Media URLs embed a per-session auth salt; artwork uses a stable `cacheKey`.
- Stats overlay bytes come from the native `traffic-stats` module (`TrafficStats` per-UID); it reads `-1`/`n/a` if the module isn't linked.
