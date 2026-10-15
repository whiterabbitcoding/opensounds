# Setup

End to end: **music library → Navidrome (server) → Tailscale → OpenSounds (phone)**, plus the dev toolchain to build the app. Run `scripts/doctor.sh` at any point to see what's still missing.

| § | Part | Where |
|---|---|---|
| 1 | Navidrome | the machine that holds your music |
| 2 | Tailscale | server **and** phone (and dev machine) |
| 3 | Dev toolchain | the machine you build on |
| 4 | Build | dev machine |
| 5 | Install on a phone | dev machine → phone |
| 6 | First launch | phone |
| 7 | Test on an emulator | dev machine |
| 8 | Troubleshooting | |

The server and dev machine can be the same box (they are in the author's setup).

---

## 1. Navidrome (the music server)

Navidrome indexes a folder of music and exposes the Subsonic API. Tested with **0.63.x**.

**Arch / Manjaro (automated):**

```bash
scripts/setup-server.sh --music-dir /path/to/music
```

It installs `navidrome` + `tailscale` from the official repos, appends `MusicFolder`/`Address`/`Port` to `/etc/navidrome/navidrome.toml` (only if no `MusicFolder` is set), enables the services and walks you through `tailscale up`.

**Manual / other distros:** install from your package manager, the [release binary](https://github.com/navidrome/navidrome/releases) or Docker, then configure (`/etc/navidrome/navidrome.toml` or env vars):

```toml
MusicFolder = "/path/to/music"
Address     = "0.0.0.0"      # listen on the tailnet interface too
Port        = 4533
ScanSchedule = "@every 1h"
```

```bash
sudo systemctl enable --now navidrome
```

**First run:** open `http://localhost:4533`, create the admin user, wait for the first scan. That username/password is what the app will use (or create a dedicated user under *Users*).

**Permissions gotcha:** Navidrome runs as its own `navidrome` user — it must be able to **read** the library (`sudo -u navidrome ls /path/to/music`). An empty library right after install is almost always this.

**Radio quality:** OpenSounds's radio uses Navidrome's *similar artists/songs* (`getArtistInfo2`, `getSimilarSongs2`). On 0.63.2 this worked with no extra configuration. If radios come back thin, check Navidrome's *Agents* settings (Last.fm / Spotify / Deezer) in its docs; better external data → better radios. Radios degrade gracefully (genre/random top-up) when similarity data is sparse.

Check it: `curl -s localhost:4533/rest/ping?f=json` → `"type":"navidrome"` (auth errors are fine; they prove it's alive).

## 2. Tailscale (reaching the server from anywhere)

Tailscale gives each device a stable private `100.x.y.z` address over WireGuard — no port forwarding, nothing exposed publicly.

1. **Server:** `sudo pacman -S tailscale` (or see tailscale.com/download) → `sudo systemctl enable --now tailscaled` → `sudo tailscale up` and open the printed URL.
2. **Phone:** install the Tailscale app, sign in with the **same account**, connect.
3. **Find the server address:** `tailscale ip -4` (e.g. `100.64.1.2`). The app's server URL is `http://100.64.1.2:4533`.
4. Optional: MagicDNS gives you a name like `http://myserver:4533` instead of the IP (enable it in the Tailscale admin console).

`tailscale status` should list both devices; if the phone shows *offline*, open the Tailscale app on it.

> `tailscaled` crash-looping right after a kernel update usually means the running kernel and installed kernel/modules don't match — reboot.

## 3. Dev toolchain

| Need | Version | Arch install |
|---|---|---|
| Node | ≥ 20 | `sudo pacman -S nodejs npm` |
| JDK | **17** (not 21/24 — Gradle/RN breaks) | `sudo pacman -S jdk17-openjdk` |
| Android SDK | platform **36**, build-tools **36.0.0**, platform-tools, **NDK**, (emulator + a system image for testing) | Android Studio, or cmdline-tools + `sdkmanager` |
| KVM | for a usable emulator | be in the `kvm` group |

With only command-line tools:

```bash
sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0" "ndk;27.1.12297006" \
           "emulator" "system-images;android-36;google_apis_playstore;x86_64"
```

Defaults the scripts assume (override with env vars): `ANDROID_HOME=~/Android/Sdk`, JDK at `/usr/lib/jvm/java-17-openjdk` (or set `JAVA_HOME`).

```bash
npm install --legacy-peer-deps     # see Troubleshooting for why the flag
scripts/doctor.sh
```

## 4. Build

```bash
scripts/build-apk.sh                    # arm64-v8a + x86_64 (phone + emulator), ~70 MB
ARCHS=arm64-v8a scripts/build-apk.sh    # phone only, smaller & faster
```

What it does: installs deps if needed → `expo prebuild` if `android/` is missing (it's generated and gitignored) → typecheck → `gradlew assembleRelease` → copies the result to `dist/opensounds.apk`. First build ≈ 5 min (Gradle + NDK); rebuilds ≈ 15–30 s.

The APK is a standalone release build (JS bundled, no dev server needed), signed with the debug keystore — fine for sideloading, not for the Play Store.

## 4b. Signed release (for publishing)

`build-apk.sh` signs with the shared debug key, which is fine for your own phone but not for distributing. `scripts/release.sh` signs with **your** key and produces a phone-only (arm64) APK plus a SHA-256 checksum in `dist/release/`:

```bash
keytool -genkeypair -keystore ~/.config/opensounds/release.keystore -alias opensounds \
        -keyalg RSA -keysize 4096 -validity 36500          # once; keep it OUT of the repo
printf 'OPENSOUNDS_KEYSTORE=%s\nOPENSOUNDS_KEY_ALIAS=opensounds\nOPENSOUNDS_STORE_PASSWORD=%s\n' \
       ~/.config/opensounds/release.keystore '<password>' > ~/.config/opensounds/release.env
chmod 600 ~/.config/opensounds/release.*

scripts/release.sh               # build + verify the signature
scripts/release.sh --publish     # …and create the GitHub release v<version> (bump "version" in app.json first)
```

**Back up the keystore.** Android only installs an update over an existing app if it's signed with the same key; lose it and every user has to uninstall and reinstall. Switching from a debug-signed build to a release-signed one also needs one uninstall. (`ARCHS=arm64-v8a,x86_64 scripts/release.sh` adds x86_64 for testing on an emulator.)

## 5. Install on your phone

Pick one:

**a) Download over Tailscale (no cable)**
```bash
scripts/serve-apk.sh          # prints http://100.x.y.z:8099/opensounds.apk, Ctrl-C to stop
```
On the phone (Tailscale connected): open the URL in the browser, download, open the file, allow *Install unknown apps* for that browser. If Play Protect warns about an unrecognised app, choose *Install anyway* (debug-signed). The server binds to the Tailscale IP only, not your LAN.

**b) USB / wireless adb**
```bash
# USB: enable Developer options → USB debugging, plug in, accept the prompt
scripts/install.sh
# wireless: Developer options → Wireless debugging → "Pair device"
adb pair <ip:port>; adb connect <ip:port>; scripts/install.sh
```

**c) Taildrop:** `tailscale file cp dist/opensounds.apk <phone-name>:` then accept on the phone.

Updating later: just install the new APK over the old one — same signing key, so login and settings survive.

## 6. First launch

1. Make sure Tailscale is connected on the phone.
2. Server URL `http://<server-tailscale-ip>:4533`, Navidrome username + password → **Connect**.
3. You land on Home. Try **Daily mix** (a radio from what you play — takes ~15–40 s to crawl) and **Settings → Audio stats** to see formats and real data usage.

## 7. Test on an emulator

```bash
scripts/emulator.sh create    # once (needs avdmanager, or SOURCE_AVD=<existing avd> to clone)
scripts/emulator.sh start     # headless, waits until the user is unlocked
scripts/install.sh
scripts/emulator.sh shot /tmp/s.png     # screenshot
scripts/emulator.sh ui                  # UI tree (text + bounds) — scriptable assertions
scripts/emulator.sh stop
```

The emulator reaches the host as `10.0.2.2` and can also reach your Tailscale address through the host, so the same server URL works.

---

## 8. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `npm install` / `expo install` → `ERESOLVE` / "Could not resolve dependency" | Optional `react-native-worklets` peer range conflict. Use `npm install --legacy-peer-deps`, or `npx expo install <pkg> -- --legacy-peer-deps`. |
| Gradle fails with Java errors | Wrong JDK. Must be **17**: `JAVA_HOME=/usr/lib/jvm/java-17-openjdk`. |
| `Activity class … does not exist` when launching on an emulator | The emulator's user is still `RUNNING_LOCKED` (or the AVD has a screen lock). `scripts/emulator.sh start` waits for unlock; use a fresh AVD rather than one with a lock set. |
| App: *Wrong username or password* | Mistyped (`adb input text` also drops characters — type slowly), or wrong user. Verify with `curl`/the Navidrome web UI. |
| App: network error / hangs | Tailscale not connected on the phone, wrong IP, or Navidrome down (`systemctl status navidrome`, `scripts/doctor.sh`). |
| Library empty | Navidrome can't read the music dir (permissions) or the scan hasn't finished. |
| Radio finds few tracks | Sparse similarity data for that seed. Radios top up with genre/random tracks; better agents on the server improve it (§1). |
| Playback stops ~3 min after backgrounding | The foreground media service isn't active; check the media notification exists. (Known `expo-audio` behaviour if lock-screen mode isn't enabled — the app enables it per track.) |
| `react-native-track-player` | Don't add it: RN 0.86 is New-Architecture-only and it doesn't support that. The app uses `expo-audio`. |
| Stats overlay shows `n/a` | Native `TrafficStats` module not linked — rebuild after `expo prebuild`. |
| Play Protect warning on install | Expected for a debug-signed sideload. |
