import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SectionTitle } from '../../components/ui';
import { clearDataCache } from '../../lib/cache';
import { stopAndClear } from '../../lib/player';
import { type Quality, type Settings, updateSettings, useSettings } from '../../lib/settings';
import { clearServer, getServer } from '../../lib/subsonic';
import { themes, useTheme } from '../../lib/theme';

const QUALITIES: { key: Quality; label: string; note: string }[] = [
  { key: 'original', label: 'Original (lossless)', note: 'Bit-perfect file as stored — best on wifi / unlimited data' },
  { key: 'mp3-320', label: 'MP3 320', note: 'Transcoded by Navidrome, ~2.4 MB/min' },
  { key: 'mp3-192', label: 'MP3 192', note: 'Transcoded, ~1.4 MB/min' },
  { key: 'opus-128', label: 'Opus 128', note: 'Transcoded, ~1 MB/min — best for mobile data' },
];

export default function SettingsScreen() {
  const t = useTheme();
  const router = useRouter();
  const s = useSettings();
  const server = getServer();

  const row = (title: string, sub: string | undefined, right: React.ReactNode, onPress?: () => void) => (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontSize: 16 }}>{title}</Text>
        {!!sub && <Text style={{ color: t.dim, fontSize: 12, marginTop: 2 }}>{sub}</Text>}
      </View>
      {right}
    </Pressable>
  );
  const sw = (v: boolean, onChange: (v: boolean) => void) => (
    <Switch value={v} onValueChange={onChange} trackColor={{ true: t.accent, false: t.line }} thumbColor={t.dark ? '#fff' : '#fff'} />
  );

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
      <SectionTitle>Theme</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16 }}>
        {(Object.keys(themes) as Settings['theme'][]).map((k) => {
          const th = themes[k];
          const on = s.theme === k;
          return (
            <Pressable key={k} onPress={() => updateSettings({ theme: k })} style={{ width: '47%', backgroundColor: th.bg, borderRadius: 12, padding: 12, borderWidth: 2, borderColor: on ? th.accent : th.line }}>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                {[th.accent, th.accent2, th.accent3].map((c, i) => <View key={i} style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: c, borderWidth: 1, borderColor: th.line }} />)}
              </View>
              <Text style={{ color: th.text, fontWeight: '700' }}>{th.name}</Text>
            </Pressable>
          );
        })}
      </View>

      <SectionTitle>Streaming quality</SectionTitle>
      {QUALITIES.map((q) => row(q.label, q.note, s.quality === q.key ? <Text style={{ color: t.accent, fontWeight: '700' }}>●</Text> : null, () => updateSettings({ quality: q.key })))}

      <SectionTitle>Audio stats</SectionTitle>
      {row('Show stats overlay', 'Format, sample rate, bit depth, bitrate and real network data, bottom-left', sw(s.showStats, (v) => updateSettings({ showStats: v })))}
      {row('Detailed stats', 'Adds per-track data, API traffic and file size', sw(s.statsDetail === 'full', (v) => updateSettings({ statsDetail: v ? 'full' : 'compact' })))}

      <SectionTitle>Playback</SectionTitle>
      {row('Scrobble plays', 'Reports plays to Navidrome (powers Recently / Most played and radio variety)', sw(s.scrobble, (v) => updateSettings({ scrobble: v })))}

      <SectionTitle>Storage</SectionTitle>
      {row('Clear artwork cache', 'Cover art is cached on disk for instant loading', null, async () => {
        await Image.clearDiskCache(); await Image.clearMemoryCache(); Alert.alert('Artwork cache cleared');
      })}
      {row('Clear library cache', 'Cached artist/album lists (refetched on next open)', null, async () => { await clearDataCache(); Alert.alert('Library cache cleared'); })}

      <SectionTitle>Server</SectionTitle>
      {row(server?.url ?? 'Not connected', server ? `Signed in as ${server.user}` : undefined, null, () => router.push('/login'))}
      {row('Log out', 'Stops playback and forgets this server', null, async () => {
        stopAndClear(); await clearServer(); router.replace('/login');
      })}
    </ScrollView>
  );
}
