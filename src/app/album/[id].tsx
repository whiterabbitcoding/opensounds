import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Cover } from '../../components/Cover';
import { SongRow } from '../../components/SongRow';
import { PillButton } from '../../components/ui';
import { useCached } from '../../lib/cache';
import { audioInfo, fmtTime } from '../../lib/format';
import { addToQueue, playSongs, shuffleSongs } from '../../lib/player';
import { startRadio } from '../../lib/radioUi';
import { openAlbumMenu } from '../../lib/menu';
import { type Album, type Song, getAlbum } from '../../lib/subsonic';
import { useTheme } from '../../lib/theme';

export default function AlbumScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const router = useRouter();
  const { data } = useCached<{ album: Album; songs: Song[] }>(`album:${id}`, () => getAlbum(id), [id]);
  const songs = data?.songs ?? [];
  const total = songs.reduce((n, s) => n + (s.duration ?? 0), 0);
  const multiDisc = new Set(songs.map((s) => s.discNumber ?? 1)).size > 1;

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: '' }} />
      <FlatList
        data={songs}
        keyExtractor={(s) => s.id}
        ListHeaderComponent={
          data && (
            <View style={{ alignItems: 'center', padding: 16, gap: 4 }}>
              <Cover id={data.album.coverArt} size={230} radius={12} />
              <Text style={{ color: t.text, fontSize: 21, fontWeight: '700', marginTop: 12, textAlign: 'center' }}>{data.album.name}</Text>
              <Pressable onPress={() => data.album.artistId && router.push(`/artist/${data.album.artistId}`)}>
                <Text style={{ color: t.accent, fontSize: 15 }}>{data.album.artist}</Text>
              </Pressable>
              <Text style={{ color: t.dim, fontSize: 12, textAlign: 'center' }}>
                {[data.album.year, `${songs.length} tracks`, fmtTime(total), audioInfo(songs[0])].filter(Boolean).join(' · ')}
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                <PillButton icon="play" label="Play" onPress={() => playSongs(songs)} />
                <PillButton icon="shuffle" label="Shuffle" solid={false} onPress={() => shuffleSongs(songs)} />
                <PillButton icon="radio" label="Radio" solid={false} onPress={() => startRadio({ kind: 'album', album: data.album })} />
                <PillButton icon="add" label="Queue" solid={false} onPress={() => addToQueue(songs)} />
                <PillButton icon="ellipsis-horizontal" label="More" solid={false} onPress={() => openAlbumMenu(data.album)} />
              </View>
            </View>
          )
        }
        renderItem={({ item, index }) => (
          <SongRow song={item} number={multiDisc ? undefined : item.track ?? index + 1} sub={multiDisc ? 'album' : 'none'} onPress={() => playSongs(songs, index)} />
        )}
      />
    </View>
  );
}
