import Slider from '@react-native-community/slider';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Cover } from '../components/Cover';
import { Icon } from '../components/ui';
import { audioInfo, fmtTime } from '../lib/format';
import { openSongMenu } from '../lib/menu';
import { cycleRepeat, jumpTo, next, prev, removeFromQueue, seekTo, setShuffle, stopAndClear, toggle, usePlayer } from '../lib/player';
import { startRadio } from '../lib/radioUi';
import { createPlaylist, star, unstar } from '../lib/subsonic';
import { useSettings } from '../lib/settings';
import { useTheme } from '../lib/theme';

export default function NowPlaying() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { queue, index, playing, loading, position, duration, shuffle, repeat, radio } = usePlayer();
  const { quality } = useSettings();
  const song = queue[index];
  const [showQueue, setShowQueue] = useState(false);
  const [seeking, setSeeking] = useState<number | null>(null);
  const [likeOverride, setLikeOverride] = useState<{ id: string; v: boolean }>();
  const [plName, setPlName] = useState('');

  useEffect(() => { if (!song) router.back(); }, [song, router]);
  if (!song) return null;
  const liked = likeOverride?.id === song.id ? likeOverride.v : !!song.starred; // per-track override, no effect needed

  const art = Math.min(width - 56, 380);
  const shown = seeking ?? position;
  const btn = (name: any, onPress: () => void, color?: string, size = 26) => (
    <Pressable hitSlop={10} onPress={onPress}><Icon name={name} size={size} color={color} /></Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top + 6, paddingBottom: insets.bottom + 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }}>
        {btn('chevron-down', () => router.back(), t.text, 30)}
        <Text numberOfLines={1} style={{ color: t.dim, fontSize: 12, flex: 1, textAlign: 'center', marginHorizontal: 8 }}>
          {radio ? `RADIO · ${radio}` : 'NOW PLAYING'}
        </Text>
        {btn('ellipsis-horizontal', () => openSongMenu(song), t.text, 24)}
      </View>

      {showQueue ? (
        <View style={{ flex: 1, marginTop: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8 }}>
            <TextInput value={plName} onChangeText={setPlName} placeholder="Save queue as playlist…" placeholderTextColor={t.dim} style={{ flex: 1, backgroundColor: t.card, color: t.text, borderRadius: 10, paddingHorizontal: 12, height: 40 }} />
            <Pressable
              onPress={async () => {
                if (!plName.trim()) return;
                await createPlaylist(plName.trim(), queue.map((s) => s.id));
                Alert.alert(`Saved "${plName.trim()}"`);
                setPlName('');
              }}
              style={{ backgroundColor: t.accent, borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center' }}>
              <Text style={{ color: t.onAccent, fontWeight: '700' }}>Save</Text>
            </Pressable>
          </View>
          <FlatList
            data={queue}
            keyExtractor={(s, i) => s.id + i}
            initialScrollIndex={Math.max(0, index - 2)}
            getItemLayout={(_, i) => ({ length: 60, offset: 60 * i, index: i })}
            renderItem={({ item, index: i }) => (
              <Pressable onPress={() => jumpTo(i)} style={{ height: 60, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 }}>
                <Cover id={item.coverArt} size={40} radius={5} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: i === index ? t.accent2 : t.text, fontSize: 15 }}>{item.title}</Text>
                  <Text numberOfLines={1} style={{ color: t.dim, fontSize: 12 }}>{item.artist}</Text>
                </View>
                {i !== index && <Pressable hitSlop={8} onPress={() => removeFromQueue(i)}><Icon name="close" size={18} color={t.dim} /></Pressable>}
              </Pressable>
            )}
          />
        </View>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Cover id={song.coverArt} size={art} radius={16} />
          <View style={{ width: art, marginTop: 22 }}>
            <Text numberOfLines={2} style={{ color: t.text, fontSize: 22, fontWeight: '800' }}>{song.title}</Text>
            <Pressable onPress={() => song.artistId && router.push(`/artist/${song.artistId}`)}>
              <Text numberOfLines={1} style={{ color: t.accent2, fontSize: 16, marginTop: 2 }}>{song.artist}</Text>
            </Pressable>
            <Text numberOfLines={1} style={{ color: t.dim, fontSize: 13, marginTop: 2 }}>{song.album}</Text>
            <Text style={{ color: t.dim, fontSize: 11, marginTop: 8, fontFamily: 'monospace' }}>
              {quality === 'original' ? audioInfo(song) : `${quality.toUpperCase().replace('-', ' ')} · transcoded from ${audioInfo(song)}`}
            </Text>
          </View>
        </View>
      )}

      <View style={{ paddingHorizontal: 24 }}>
        <Slider
          value={shown}
          minimumValue={0}
          maximumValue={Math.max(duration, 1)}
          minimumTrackTintColor={t.accent2}
          maximumTrackTintColor={t.line}
          thumbTintColor={t.accent}
          onValueChange={setSeeking}
          onSlidingComplete={(v) => { seekTo(v); setSeeking(null); }}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 }}>
          <Text style={{ color: t.dim, fontSize: 12 }}>{fmtTime(shown)}</Text>
          <Text style={{ color: t.dim, fontSize: 12 }}>{fmtTime(duration)}</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 28, marginTop: 10 }}>
        {btn('shuffle', () => setShuffle(!shuffle), shuffle ? t.accent : t.dim)}
        {btn('play-skip-back', prev, t.text, 32)}
        <Pressable onPress={toggle}>
          <Icon name={loading && !playing ? 'hourglass' : playing ? 'pause-circle' : 'play-circle'} size={74} color={t.accent} />
        </Pressable>
        {btn('play-skip-forward', next, t.text, 32)}
        {btn(repeat === 'one' ? 'repeat' : 'repeat', cycleRepeat, repeat === 'off' ? t.dim : t.accent)}
      </View>
      {repeat === 'one' && <Text style={{ color: t.accent, fontSize: 10, textAlign: 'center', position: 'absolute', right: 30, bottom: insets.bottom + 66 }}>1</Text>}

      <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 18, paddingHorizontal: 24 }}>
        {btn(liked ? 'heart' : 'heart-outline', async () => {
          const was = liked;
          setLikeOverride({ id: song.id, v: !was });
          await (was ? unstar({ id: song.id }) : star({ id: song.id })).catch(() => setLikeOverride({ id: song.id, v: was }));
        }, liked ? t.accent : t.dim, 24)}
        {btn('radio-outline', () => startRadio({ kind: 'song', song }), radio ? t.accent3 : t.dim, 24)}
        {btn(showQueue ? 'musical-note' : 'list', () => setShowQueue((v) => !v), showQueue ? t.accent : t.dim, 24)}
        {btn('stop-circle-outline', () => { stopAndClear(); router.back(); }, t.dim, 24)}
      </View>
    </View>
  );
}
