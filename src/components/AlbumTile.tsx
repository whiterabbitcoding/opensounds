import { useRouter } from 'expo-router';
import { Pressable, Text, useWindowDimensions } from 'react-native';
import { openAlbumMenu } from '../lib/menu';
import type { Album } from '../lib/subsonic';
import { useTheme } from '../lib/theme';
import { Cover } from './Cover';

// Tap = open, long-press = actions menu (radio, queue, playlist, go to artist, star…).
export function AlbumTile({ album, size = 160, showYear, grid }: { album: Album; size?: number; showYear?: boolean; grid?: boolean }) {
  const t = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const px = grid ? Math.floor((width - 16) / 2 - 12) : size; // 2-col grid fills the screen
  return (
    <Pressable
      onPress={() => router.push(`/album/${album.id}`)}
      onLongPress={() => openAlbumMenu(album)}
      style={grid ? { width: px, margin: 6 } : { width: size, marginHorizontal: 4 }}>
      <Cover id={album.coverArt} size={px} radius={10} />
      <Text numberOfLines={1} style={{ color: t.text, marginTop: 6, fontSize: 13 }}>{album.name}</Text>
      <Text numberOfLines={1} style={{ color: t.dim, fontSize: 12 }}>{album.artist}{showYear && album.year ? ` · ${album.year}` : ''}</Text>
    </Pressable>
  );
}
