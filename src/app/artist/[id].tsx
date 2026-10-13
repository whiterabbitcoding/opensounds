import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, ScrollView, Text, View } from 'react-native';
import { Chip, PillButton, SectionTitle } from '../../components/ui';
import { useCached } from '../../lib/cache';
import { playSongs, shuffleSongs } from '../../lib/player';
import { startRadio } from '../../lib/radioUi';
import { type Album, type Artist, type Song, getArtist, getArtistSongs, getSimilarArtists } from '../../lib/subsonic';
import { AlbumTile } from '../../components/AlbumTile';
import { openArtistMenu } from '../../lib/menu';
import { useTheme } from '../../lib/theme';

export default function ArtistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const { data } = useCached<{ artist: Artist; albums: Album[] }>(`artist:${id}`, () => getArtist(id), [id]);
  const similar = useCached<Artist[]>(`similar:${id}`, () => getSimilarArtists(id, 12), [id]);

  const act = async (fn: (songs: Song[]) => unknown) => {
    if (busy || !data) return;
    setBusy(true);
    try { fn(await getArtistSongs(id)); } finally { setBusy(false); }
  };

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: '' }} />
      <FlatList
        data={data?.albums}
        numColumns={2}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 16 }}
        ListHeaderComponent={
          data && (
            <View style={{ paddingHorizontal: 8 }}>
              <Text style={{ color: t.text, fontSize: 28, fontWeight: '800', paddingHorizontal: 8 }}>{data.artist.name}</Text>
              <Text style={{ color: t.dim, paddingHorizontal: 8, marginTop: 2 }}>{data.albums.length} album{data.albums.length === 1 ? '' : 's'}</Text>
              <View style={{ flexDirection: 'row', gap: 10, padding: 8, paddingTop: 14, flexWrap: 'wrap' }}>
                <PillButton icon="play" label="Play all" onPress={() => act((s) => playSongs(s))} />
                <PillButton icon="shuffle" label="Shuffle" solid={false} onPress={() => act(shuffleSongs)} />
                <PillButton icon="radio" label="Radio" solid={false} onPress={() => startRadio({ kind: 'artist', id: data.artist.id, name: data.artist.name })} />
                <PillButton icon="ellipsis-horizontal" label="More" solid={false} onPress={() => openArtistMenu(data.artist)} />
              </View>
              {!!similar.data?.length && (
                <>
                  <SectionTitle>Similar artists</SectionTitle>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0, height: 44 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 8, alignItems: 'center' }}>
                    {similar.data.map((a) => <Chip key={a.id} label={a.name} onPress={() => router.push(`/artist/${a.id}`)} />)}
                  </ScrollView>
                </>
              )}
              <SectionTitle>Albums</SectionTitle>
            </View>
          )
        }
        renderItem={({ item }) => <AlbumTile album={item} grid showYear />}
      />
    </View>
  );
}
