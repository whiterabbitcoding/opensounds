import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, FlatList, Text, View } from 'react-native';
import { SongRow } from '../../components/SongRow';
import { PillButton } from '../../components/ui';
import { useCached } from '../../lib/cache';
import { playSongs, shuffleSongs } from '../../lib/player';
import { type Playlist, type Song, deletePlaylist, getPlaylist } from '../../lib/subsonic';
import { useTheme } from '../../lib/theme';

export default function PlaylistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const router = useRouter();
  const { data } = useCached<{ playlist: Playlist; songs: Song[] }>(`playlist:${id}`, () => getPlaylist(id), [id]);
  const songs = data?.songs ?? [];
  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: '' }} />
      <FlatList
        data={songs}
        keyExtractor={(s, i) => s.id + i}
        ListHeaderComponent={
          data && (
            <View style={{ padding: 16, gap: 4 }}>
              <Text style={{ color: t.text, fontSize: 26, fontWeight: '800' }}>{data.playlist.name}</Text>
              <Text style={{ color: t.dim }}>{songs.length} songs</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                <PillButton icon="play" label="Play" onPress={() => playSongs(songs)} />
                <PillButton icon="shuffle" label="Shuffle" solid={false} onPress={() => shuffleSongs(songs)} />
                <PillButton icon="trash-outline" label="Delete" solid={false} onPress={() =>
                  Alert.alert('Delete playlist?', data.playlist.name, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: async () => { await deletePlaylist(id); router.back(); } },
                  ])} />
              </View>
            </View>
          )
        }
        renderItem={({ item, index }) => <SongRow song={item} cover onPress={() => playSongs(songs, index)} />}
      />
    </View>
  );
}
