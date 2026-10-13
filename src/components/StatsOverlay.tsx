import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { getRxBytes } from '../../modules/traffic-stats';
import { audioInfo, fmtBytes } from '../lib/format';
import { currentSong, usePlayer } from '../lib/player';
import { useSettings } from '../lib/settings';
import { net } from '../lib/subsonic';
import { useTheme } from '../lib/theme';

// Optional "nerd stats" chip, bottom-left. Bytes come from Android's per-UID TrafficStats (real network
// bytes incl. native audio streaming + artwork), so this is what the radio actually pulled, not an estimate.
export function StatsOverlay({ bottom }: { bottom: number }) {
  const t = useTheme();
  const { showStats, statsDetail, quality } = useSettings();
  const { index, queue } = usePlayer();
  const [{ session, track }, setBytes] = useState({ session: -1, track: -1 });
  const base = useRef(0);
  const trackBase = useRef(0);
  const trackId = queue[index]?.id;

  useEffect(() => { base.current = getRxBytes(); }, []);
  useEffect(() => { trackBase.current = getRxBytes(); }, [trackId]);
  useEffect(() => {
    if (!showStats) return;
    const sample = () => {
      const rx = getRxBytes();
      setBytes(rx >= 0 ? { session: rx - base.current, track: rx - trackBase.current } : { session: -1, track: -1 });
    };
    const first = setTimeout(sample, 0);
    const i = setInterval(sample, 1000);
    return () => { clearTimeout(first); clearInterval(i); };
  }, [showStats]);

  if (!showStats) return null;
  const song = currentSong();
  const transcoded = quality !== 'original';
  const line1 = song ? (transcoded ? `${quality.replace('-', ' ').toUpperCase()} (transcoded from ${(song.suffix ?? '').toUpperCase()})` : audioInfo(song)) : 'idle';
  const mono = { color: t.text, fontSize: 10.5, fontFamily: 'monospace' as const };

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 8, bottom, backgroundColor: t.bg + 'e6', borderRadius: 8, paddingVertical: 5, paddingHorizontal: 8, borderWidth: 1, borderColor: t.line }}>
      <Text style={mono}>{line1}</Text>
      <Text style={{ ...mono, color: t.accent3 }}>
        ↓ {session >= 0 ? fmtBytes(session) : 'n/a'} session{statsDetail === 'full' ? ` · ${track >= 0 ? fmtBytes(track) : 'n/a'} this track` : ''}
      </Text>
      {statsDetail === 'full' && (
        <Text style={{ ...mono, color: t.dim }}>
          api {fmtBytes(net.apiBytes)} / {net.apiCalls} calls{song?.size ? ` · file ${fmtBytes(song.size)}` : ''}
        </Text>
      )}
    </View>
  );
}
