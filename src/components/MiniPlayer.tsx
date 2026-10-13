import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { fmtTime } from '../lib/format';
import { next, prev, toggle, usePlayer } from '../lib/player';
import { useTheme } from '../lib/theme';
import { Cover } from './Cover';
import { Icon } from './ui';

export function MiniPlayer() {
  const t = useTheme();
  const router = useRouter();
  const { queue, index, playing, loading, position, duration, radio } = usePlayer();
  const track = queue[index];
  if (!track) return null;
  const pct = duration ? Math.min(100, (position / duration) * 100) : 0;

  return (
    <View style={{ backgroundColor: t.card, borderTopWidth: 1, borderColor: t.line }}>
      <View style={{ height: 2, backgroundColor: t.line }}>
        <View style={{ height: 2, width: `${pct}%`, backgroundColor: t.accent2 }} />
      </View>
      <Pressable onPress={() => router.push('/now-playing')} style={{ flexDirection: 'row', alignItems: 'center', padding: 10, gap: 12 }}>
        <Cover id={track.coverArt} size={44} radius={6} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ color: t.text, fontWeight: '600' }}>{track.title}</Text>
          <Text numberOfLines={1} style={{ color: t.dim, fontSize: 12 }}>
            {radio ? `📻 ${radio} · ` : ''}{track.artist} · {fmtTime(position)}/{fmtTime(duration)}
          </Text>
        </View>
        <Pressable hitSlop={8} onPress={prev}><Icon name="play-skip-back" size={22} /></Pressable>
        <Pressable hitSlop={8} onPress={toggle}>
          <Icon name={loading ? 'hourglass-outline' : playing ? 'pause-circle' : 'play-circle'} size={40} color={t.accent} />
        </Pressable>
        <Pressable hitSlop={8} onPress={next}><Icon name="play-skip-forward" size={22} /></Pressable>
      </Pressable>
    </View>
  );
}
