import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { AlbumTile } from '../../components/AlbumTile';
import { Cover } from '../../components/Cover';
import { openArtistMenu } from '../../lib/menu';
import { deleteRadio, useRadios } from '../../lib/radios';
import { playSavedRadio, startRadio } from '../../lib/radioUi';
import { createPlaylist } from '../../lib/subsonic';
import { SongRow } from '../../components/SongRow';
import { Chip, Icon, Segmented } from '../../components/ui';
import { useCached } from '../../lib/cache';
import { playSongs } from '../../lib/player';
import { type Album, type Artist, type Playlist, type Song, getAllAlbums, getArtists, getPlaylists, getStarred } from '../../lib/subsonic';
import { useTheme } from '../../lib/theme';

type Tab = 'albums' | 'artists' | 'playlists' | 'radios' | 'starred';
type AlbumSort = 'name' | 'artist' | 'year' | 'added' | 'plays';
type ArtistSort = 'name' | 'albums';

const ALBUM_SORTS: { key: AlbumSort; label: string }[] = [
  { key: 'name', label: 'A–Z' }, { key: 'artist', label: 'Artist' }, { key: 'year', label: 'Year' },
  { key: 'added', label: 'Recently added' }, { key: 'plays', label: 'Most played' },
];
const cmp = (a = '', b = '') => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });

export default function Library() {
  const t = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('albums');
  const [albumSort, setAlbumSort] = useState<AlbumSort>('artist');
  const [artistSort, setArtistSort] = useState<ArtistSort>('name');

  const artists = useCached<Artist[]>('lib:artists', getArtists);
  const albums = useCached<Album[]>('lib:albums', getAllAlbums);
  const playlists = useCached<Playlist[]>('lib:playlists', getPlaylists);
  const radios = useRadios();
  const starred = useCached<{ artists: Artist[]; albums: Album[]; songs: Song[] }>('lib:starred', getStarred);

  const sortedAlbums = useMemo(() => {
    const a = [...(albums.data ?? [])];
    switch (albumSort) {
      case 'name': return a.sort((x, y) => cmp(x.name, y.name));
      case 'artist': return a.sort((x, y) => cmp(x.artist, y.artist) || (x.year ?? 0) - (y.year ?? 0));
      case 'year': return a.sort((x, y) => (y.year ?? 0) - (x.year ?? 0));
      case 'added': return a.sort((x, y) => (y.created ?? '').localeCompare(x.created ?? ''));
      case 'plays': return a.sort((x, y) => (y.playCount ?? 0) - (x.playCount ?? 0));
    }
  }, [albums.data, albumSort]);
  const sortedArtists = useMemo(() => {
    const a = [...(artists.data ?? [])];
    return artistSort === 'name' ? a.sort((x, y) => cmp(x.name, y.name)) : a.sort((x, y) => (y.albumCount ?? 0) - (x.albumCount ?? 0));
  }, [artists.data, artistSort]);

  const radioActions = (r: ReturnType<typeof useRadios>[number]) =>
    Alert.alert(r.label, `${r.songs.length} tracks saved`, [
      { text: 'Play saved', onPress: () => playSavedRadio(r) },
      { text: 'Regenerate fresh', onPress: () => startRadio(r.seed) },
      { text: 'Save as playlist', onPress: async () => { await createPlaylist(r.label, r.songs.map((x) => x.id)); playlists.refresh(); Alert.alert('Saved as playlist'); } },
      { text: 'Delete', style: 'destructive', onPress: () => deleteRadio(r.id) },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const loading = (c: { data?: unknown; refreshing: boolean }) => !c.data && c.refreshing && <ActivityIndicator color={t.accent} style={{ marginTop: 40 }} />;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingTop: 4, paddingBottom: 10 }}>
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[{ key: 'albums', label: 'Albums' }, { key: 'artists', label: 'Artists' }, { key: 'playlists', label: 'Lists' }, { key: 'radios', label: 'Radios' }, { key: 'starred', label: 'Starred' }]}
        />
      </View>

      {tab === 'albums' && (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0, height: 46 }} contentContainerStyle={{ paddingHorizontal: 12, gap: 8, alignItems: 'center' }}>
            {ALBUM_SORTS.map((s) => <Chip key={s.key} label={s.label} active={albumSort === s.key} onPress={() => setAlbumSort(s.key)} />)}
          </ScrollView>
          {loading(albums)}
          <FlatList
            data={sortedAlbums}
            numColumns={2}
            keyExtractor={(a) => a.id}
            initialNumToRender={12}
            windowSize={7}
            contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 16 }}
            renderItem={({ item }) => <AlbumTile album={item} grid showYear />}
          />
        </>
      )}

      {tab === 'artists' && (
        <>
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 8 }}>
            <Chip label="A–Z" active={artistSort === 'name'} onPress={() => setArtistSort('name')} />
            <Chip label="Most albums" active={artistSort === 'albums'} onPress={() => setArtistSort('albums')} />
          </View>
          {loading(artists)}
          <FlatList
            data={sortedArtists}
            keyExtractor={(a) => a.id}
            initialNumToRender={20}
            renderItem={({ item }) => (
              <Pressable onPress={() => router.push(`/artist/${item.id}`)} onLongPress={() => openArtistMenu(item)} style={{ paddingHorizontal: 16, paddingVertical: 11 }}>
                <Text numberOfLines={1} style={{ color: t.text, fontSize: 16 }}>{item.name}</Text>
                <Text style={{ color: t.dim, fontSize: 12 }}>{item.albumCount ?? 0} album{item.albumCount === 1 ? '' : 's'}</Text>
              </Pressable>
            )}
          />
        </>
      )}

      {tab === 'playlists' && (
        <>
          {loading(playlists)}
          {playlists.data && !playlists.data.length && <Text style={{ color: t.dim, padding: 24, textAlign: 'center' }}>No playlists yet. Long-press a song → Add to playlist, or save your queue from the Now Playing screen.</Text>}
          <FlatList
            data={playlists.data}
            keyExtractor={(p) => p.id}
            renderItem={({ item }) => (
              <Pressable onPress={() => router.push(`/playlist/${item.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 }}>
                <Cover id={item.coverArt} size={52} radius={8} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: t.text, fontSize: 16 }}>{item.name}</Text>
                  <Text style={{ color: t.dim, fontSize: 12 }}>{item.songCount} songs</Text>
                </View>
                <Icon name="chevron-forward" size={18} color={t.dim} />
              </Pressable>
            )}
          />
        </>
      )}

      {tab === 'radios' && (
        <FlatList
          data={radios}
          keyExtractor={(r) => r.id}
          ListEmptyComponent={<Text style={{ color: t.dim, padding: 24, textAlign: 'center' }}>No radios yet. Start one from a song, album or artist (long-press → Start radio), or tap Daily mix on Home. They&apos;re saved here automatically.</Text>}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => playSavedRadio(item)}
              onLongPress={() => radioActions(item)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 }}>
              <View style={{ width: 52, height: 52, borderRadius: 8, overflow: 'hidden', backgroundColor: t.card }}>
                <Cover id={item.songs[0]?.coverArt} size={52} radius={8} />
                <View style={{ position: 'absolute', right: 2, bottom: 2, backgroundColor: t.bg + 'cc', borderRadius: 8, padding: 2 }}><Icon name="radio" size={12} color={t.accent3} /></View>
              </View>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: t.text, fontSize: 16 }}>{item.label}</Text>
                <Text numberOfLines={1} style={{ color: t.dim, fontSize: 12 }}>
                  {item.songs.length} tracks · {[...new Set(item.songs.map((s) => s.artist))].slice(0, 3).join(', ')}
                </Text>
              </View>
              <Pressable hitSlop={8} onPress={() => radioActions(item)}><Icon name="ellipsis-vertical" size={18} color={t.dim} /></Pressable>
            </Pressable>
          )}
        />
      )}

      {tab === 'starred' && (
        <>
          {loading(starred)}
          <FlatList
            data={starred.data?.songs}
            keyExtractor={(s) => s.id}
            ListEmptyComponent={starred.data ? <Text style={{ color: t.dim, padding: 24, textAlign: 'center' }}>Nothing starred yet — star songs from the ⋮ menu.</Text> : null}
            renderItem={({ item, index }) => <SongRow song={item} cover onPress={() => playSongs(starred.data!.songs, index)} />}
          />
        </>
      )}
    </View>
  );
}
