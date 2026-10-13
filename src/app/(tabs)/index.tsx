import { useState } from 'react';
import { FlatList, RefreshControl, ScrollView, View } from 'react-native';
import { AlbumTile } from '../../components/AlbumTile';
import { PillButton, SectionTitle } from '../../components/ui';
import { useCached } from '../../lib/cache';
import { playSongs } from '../../lib/player';
import { startRadio } from '../../lib/radioUi';
import { type Album, type AlbumListType, getAlbumList, getRandomSongs } from '../../lib/subsonic';

function Shelf({ title, type, bump }: { title: string; type: AlbumListType; bump: number }) {
  const { data } = useCached<Album[]>(`home:${type}`, () => getAlbumList(type, 20), [bump]);
  if (!data?.length) return null;
  return (
    <>
      <SectionTitle>{title}</SectionTitle>
      <FlatList
        horizontal
        data={data}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12 }}
        keyExtractor={(a) => a.id}
        renderItem={({ item }) => <AlbumTile album={item} size={140} />}
      />
    </>
  );
}

export default function Home() {
  const [bump, setBump] = useState(0);
  const [busy, setBusy] = useState(false);
  return (
    <ScrollView refreshControl={<RefreshControl refreshing={false} onRefresh={() => setBump((b) => b + 1)} />}>
      <View style={{ flexDirection: 'row', gap: 10, padding: 16, flexWrap: 'wrap' }}>
        <PillButton icon="shuffle" label="Shuffle all" onPress={async () => {
          if (busy) return; setBusy(true);
          try { await playSongs(await getRandomSongs(100), 0, { shuffle: false }); } finally { setBusy(false); }
        }} />
        <PillButton icon="radio" label="Daily mix" solid={false} onPress={() => startRadio({ kind: 'mix' })} />
      </View>
      <Shelf title="Recently played" type="recent" bump={bump} />
      <Shelf title="Recently added" type="newest" bump={bump} />
      <Shelf title="Most played" type="frequent" bump={bump} />
      <Shelf title="Rediscover" type="random" bump={bump} />
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}
