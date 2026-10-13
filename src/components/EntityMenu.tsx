import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { audioInfo, fmtBytes } from '../lib/format';
import { closeMenu, useMenu, type MenuTarget } from '../lib/menu';
import { addToQueue, playNext, playSongs, shuffleSongs } from '../lib/player';
import { startRadio } from '../lib/radioUi';
import {
  addToPlaylist, createPlaylist, getAlbum, getArtistSongs, getPlaylists, star, unstar,
  type Playlist, type Song,
} from '../lib/subsonic';
import { useTheme } from '../lib/theme';
import { Icon } from './ui';

// Long-press / ⋮ sheet for songs, albums and artists: info, play/queue, radio, navigation, star, playlists.
export function EntityMenu() {
  const target = useMenu();
  if (!target) return null;
  const key = target.kind === 'song' ? target.song.id : target.kind === 'album' ? target.album.id : target.artist.id;
  // Keyed: opening the menu for another item remounts the body, resetting its local state without effects.
  return <MenuBody key={target.kind + key} target={target} />;
}

function MenuBody({ target }: { target: MenuTarget }) {
  const t = useTheme();
  const router = useRouter();
  const [starred, setStarred] = useState(!!(target.kind === 'song' ? target.song.starred : target.kind === 'album' ? target.album.starred : target.artist.starred));
  const [picker, setPicker] = useState<Playlist[] | null>(null);
  const [newName, setNewName] = useState('');

  const go = (path: string) => { closeMenu(); router.push(path as any); };
  const songs = async (): Promise<Song[]> =>
    target.kind === 'song' ? [target.song] : target.kind === 'album' ? (await getAlbum(target.album.id)).songs : getArtistSongs(target.artist.id);
  const run = (fn: (s: Song[]) => unknown) => async () => { closeMenu(); fn(await songs()); };
  const toast = (msg: string) => { closeMenu(); Alert.alert(msg); };

  const title = target.kind === 'song' ? target.song.title : target.kind === 'album' ? target.album.name : target.artist.name;
  const sub = target.kind === 'song' ? [target.song.artist, target.song.album].filter(Boolean).join(' · ') : target.kind === 'album' ? target.album.artist : `${target.artist.albumCount ?? '?'} albums`;
  const info = target.kind === 'song'
    ? [audioInfo(target.song), target.song.size ? fmtBytes(target.song.size) : '', target.song.year, target.song.genre].filter(Boolean).join(' · ')
    : target.kind === 'album'
    ? [target.album.year, target.album.songCount ? `${target.album.songCount} tracks` : '', target.album.genre].filter(Boolean).join(' · ')
    : '';

  const item = (icon: any, label: string, onPress: () => void) => (
    <Pressable key={label} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 13, paddingHorizontal: 20 }}>
      <Icon name={icon} size={22} color={t.dim} />
      <Text style={{ color: t.text, fontSize: 16 }}>{label}</Text>
    </Pressable>
  );

  const toggleStar = async () => {
    const was = starred;
    setStarred(!was);
    const p = target.kind === 'song' ? { id: target.song.id } : target.kind === 'album' ? { albumId: target.album.id } : { artistId: target.artist.id };
    await (was ? unstar(p) : star(p)).catch(() => setStarred(was));
  };

  const radioSeed = () =>
    target.kind === 'song' ? ({ kind: 'song', song: target.song } as const)
    : target.kind === 'album' ? ({ kind: 'album', album: target.album } as const)
    : ({ kind: 'artist', id: target.artist.id, name: target.artist.name } as const);

  const artistId = target.kind === 'song' ? target.song.artistId : target.kind === 'album' ? target.album.artistId : undefined;
  const albumId = target.kind === 'song' ? target.song.albumId : undefined;

  return (
    <Modal transparent animationType="slide" onRequestClose={closeMenu}>
      <Pressable style={{ flex: 1, backgroundColor: '#0008' }} onPress={closeMenu} />
      <View style={{ backgroundColor: t.card, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingBottom: 24, maxHeight: '78%' }}>
        <View style={{ padding: 20, borderBottomWidth: 1, borderColor: t.line, gap: 2 }}>
          <Text numberOfLines={1} style={{ color: t.text, fontSize: 17, fontWeight: '700' }}>{title}</Text>
          {!!sub && <Text numberOfLines={1} style={{ color: t.dim }}>{sub}</Text>}
          {!!info && <Text numberOfLines={2} style={{ color: t.dim, fontSize: 11, fontFamily: 'monospace', marginTop: 4 }}>{info}</Text>}
        </View>
        {picker ? (
          <FlatList
            data={picker}
            keyExtractor={(p) => p.id}
            ListHeaderComponent={
              <View style={{ flexDirection: 'row', gap: 8, padding: 14 }}>
                <TextInput value={newName} onChangeText={setNewName} placeholder="New playlist name" placeholderTextColor={t.dim} style={{ flex: 1, color: t.text, backgroundColor: t.bg, borderRadius: 10, paddingHorizontal: 12 }} />
                <Pressable
                  onPress={async () => { if (newName.trim()) { const ids = (await songs()).map((s) => s.id); await createPlaylist(newName.trim(), ids); toast(`Created "${newName.trim()}"`); } }}
                  style={{ backgroundColor: t.accent, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' }}>
                  <Text style={{ color: t.onAccent, fontWeight: '700' }}>Create</Text>
                </Pressable>
              </View>
            }
            renderItem={({ item: p }) => item('musical-notes-outline', `${p.name} (${p.songCount})`, async () => { const ids = (await songs()).map((s) => s.id); await addToPlaylist(p.id, ids); toast(`Added to "${p.name}"`); })}
          />
        ) : (
          <FlatList
            data={[0]}
            keyExtractor={() => 'm'}
            renderItem={() => (
              <View>
                {target.kind !== 'song' && item('play', target.kind === 'artist' ? 'Play all' : 'Play', run((s) => playSongs(s)))}
                {target.kind !== 'song' && item('shuffle', 'Shuffle', run(shuffleSongs))}
                {item('play-forward-outline', 'Play next', run(playNext))}
                {item('list-outline', 'Add to queue', run(addToQueue))}
                {item('radio-outline', 'Start radio', () => { closeMenu(); startRadio(radioSeed()); })}
                {item(starred ? 'heart' : 'heart-outline', starred ? 'Unstar' : 'Star', toggleStar)}
                {item('albums-outline', 'Add to playlist', async () => setPicker(await getPlaylists()))}
                {artistId && target.kind !== 'artist' && item('person-outline', 'Go to artist', () => go(`/artist/${artistId}`))}
                {albumId && item('disc-outline', 'Go to album', () => go(`/album/${albumId}`))}
                {target.kind === 'artist' && item('open-outline', 'Open artist page', () => go(`/artist/${target.artist.id}`))}
                {target.kind === 'album' && item('open-outline', 'Open album page', () => go(`/album/${target.album.id}`))}
              </View>
            )}
          />
        )}
      </View>
    </Modal>
  );
}
