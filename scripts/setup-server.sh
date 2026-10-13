#!/usr/bin/env bash
# Installs and configures the SERVER side on an Arch/Manjaro box: Navidrome (Subsonic API) + Tailscale.
# Interactive and idempotent; needs sudo. Run it yourself — it changes system services:
#   scripts/setup-server.sh --music-dir /path/to/music
# Other distros: follow docs/SETUP.md §1–2 by hand.
set -euo pipefail
source "$(dirname "$0")/lib.sh"

MUSIC_DIR=""
while [ $# -gt 0 ]; do
  case "$1" in
    --music-dir) MUSIC_DIR="$2"; shift 2 ;;
    -h|--help) sed -n '2,6p' "$0"; exit 0 ;;
    *) die "unknown option $1" ;;
  esac
done

command -v pacman >/dev/null || die "pacman not found — this helper is Arch-only; see docs/SETUP.md §1–2"
[ -n "$MUSIC_DIR" ] || read -rp "Absolute path to your music library: " MUSIC_DIR
[ -d "$MUSIC_DIR" ] || die "music dir '$MUSIC_DIR' does not exist"

echo "== Packages =="
sudo pacman -S --needed --noconfirm navidrome tailscale

echo "== Navidrome config =="
CONF=/etc/navidrome/navidrome.toml
if grep -qs "^MusicFolder" "$CONF"; then
  info "$CONF already has MusicFolder — leaving it alone (edit by hand to change)"
else
  sudo tee -a "$CONF" >/dev/null <<TOML
MusicFolder = "$MUSIC_DIR"
Address = "0.0.0.0"   # reachable on the tailnet; firewall the LAN if you don't want that
Port = 4533
ScanSchedule = "@every 1h"
EnableFavourites = true
TOML
  ok "wrote $CONF"
fi
# Navidrome runs as its own user and must be able to read the library.
if ! sudo -u navidrome test -r "$MUSIC_DIR"; then
  warn "user 'navidrome' cannot read $MUSIC_DIR — fix permissions (e.g. chmod -R o+rX) or it will see an empty library"
fi
sudo systemctl enable --now navidrome
ok "navidrome.service enabled"

echo "== Tailscale =="
sudo systemctl enable --now tailscaled
if tailscale ip -4 >/dev/null 2>&1; then
  ok "tailscale already connected"
else
  info "authenticating — open the URL it prints in a browser"
  sudo tailscale up
fi
IP=$(tailscale ip -4 | head -1)

echo
ok "server ready"
echo "  1. Create the admin user:   http://localhost:4533   (first visit asks you to create it)"
echo "  2. Phone: install the Tailscale app, sign in with the SAME account"
echo "  3. In Symposium use server URL:  http://$IP:4533"
echo "  4. Verify:  SYMPOSIUM_SERVER=http://$IP:4533 scripts/doctor.sh"
