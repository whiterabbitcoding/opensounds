import { Pressable, Text, View } from 'react-native';
import { currentSong, usePlayer } from '../lib/player';
import { fmtTime } from '../lib/format';
import { openSongMenu } from '../lib/menu';
import type { Song } from '../lib/subsonic';
import { useTheme } from '../lib/theme';
import { Cover } from './Cover';
import { Icon } from './ui';

export function SongRow({ song, onPress, cover, number, sub = 'artist' }: { song: Song; onPress: () => void; cover?: boolean; number?: number; sub?: 'artist' | 'album' | 'none' }) {
  const t = useTheme();
  usePlayer(); // re-render when current song changes
  const active = currentSong()?.id === song.id;
  const subText = sub === 'artist' ? [song.artist, song.album].filter(Boolean).join(' · ') : sub === 'album' ? song.album : '';
  return (
    <Pressable onPress={onPress} onLongPress={() => openSongMenu(song)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16, paddingVertical: 9 }}>
      {number !== undefined && <Text style={{ color: active ? t.accent2 : t.dim, width: 22 }}>{number}</Text>}
      {cover && <Cover id={song.coverArt} size={44} radius={6} />}
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: active ? t.accent2 : t.text, fontSize: 15 }}>{song.title}</Text>
        {!!subText && <Text numberOfLines={1} style={{ color: t.dim, fontSize: 12, marginTop: 1 }}>{subText}</Text>}
      </View>
      <Text style={{ color: t.dim, fontSize: 12 }}>{fmtTime(song.duration)}</Text>
      <Pressable hitSlop={8} onPress={() => openSongMenu(song)} style={{ paddingHorizontal: 12 }}>
        <Icon name="ellipsis-vertical" size={18} color={t.dim} />
      </Pressable>
    </Pressable>
  );
}
