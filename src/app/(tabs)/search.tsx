import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Pressable, Text, TextInput, View } from 'react-native';
import { Cover } from '../../components/Cover';
import { SongRow } from '../../components/SongRow';
import { SectionTitle } from '../../components/ui';
import { openAlbumMenu, openArtistMenu } from '../../lib/menu';
import { playSongs } from '../../lib/player';
import { type Album, type Artist, type Song, search } from '../../lib/subsonic';
import { useTheme } from '../../lib/theme';

export default function Search() {
  const t = useTheme();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [res, setRes] = useState<{ artists: Artist[]; albums: Album[]; songs: Song[] }>();
  const [err, setErr] = useState('');
  const active = q.trim().length >= 2;
  const shown = active ? res : undefined; // derived: no state reset needed when the query is cleared

  useEffect(() => {
    if (q.trim().length < 2) return;
    const id = setTimeout(() => search(q.trim()).then((r) => { setRes(r); setErr(''); }).catch((e) => setErr(e.message)), 250);
    return () => clearTimeout(id);
  }, [q]);

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Artists, albums, songs"
        placeholderTextColor={t.dim}
        autoCapitalize="none"
        autoCorrect={false}
        style={{ backgroundColor: t.card, color: t.text, margin: 12, padding: 13, borderRadius: 12, fontSize: 16 }}
      />
      {!!err && <Text style={{ color: t.danger, paddingHorizontal: 16 }}>{err}</Text>}
      {shown && !shown.artists.length && !shown.albums.length && !shown.songs.length && <Text style={{ color: t.dim, textAlign: 'center', padding: 24 }}>No results</Text>}

      {!!shown?.artists.length && <SectionTitle>Artists</SectionTitle>}
      {shown?.artists.map((a) => (
        <Pressable key={a.id} onPress={() => router.push(`/artist/${a.id}`)} onLongPress={() => openArtistMenu(a)} style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
          <Text style={{ color: t.text, fontSize: 16 }}>{a.name}</Text>
        </Pressable>
      ))}

      {!!shown?.albums.length && <SectionTitle>Albums</SectionTitle>}
      {shown?.albums.map((a) => (
        <Pressable key={a.id} onPress={() => router.push(`/album/${a.id}`)} onLongPress={() => openAlbumMenu(a)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 }}>
          <Cover id={a.coverArt} size={48} radius={6} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ color: t.text, fontSize: 15 }}>{a.name}</Text>
            <Text numberOfLines={1} style={{ color: t.dim, fontSize: 12 }}>{a.artist}{a.year ? ` · ${a.year}` : ''}</Text>
          </View>
        </Pressable>
      ))}

      {!!shown?.songs.length && <SectionTitle>Songs</SectionTitle>}
      {shown?.songs.map((s, i) => <SongRow key={s.id} song={s} cover onPress={() => playSongs(shown.songs, i)} />)}
    </ScrollView>
  );
}
