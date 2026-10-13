import { useSyncExternalStore } from 'react';
import type { Album, Artist, Song } from './subsonic';

// One global sheet for "more actions" on any item.
export type MenuTarget = { kind: 'song'; song: Song } | { kind: 'album'; album: Album } | { kind: 'artist'; artist: Artist };

let target: MenuTarget | null = null;
const ls = new Set<() => void>();
const open = (t: MenuTarget) => { target = t; ls.forEach((l) => l()); };
export const openSongMenu = (song: Song) => open({ kind: 'song', song });
export const openAlbumMenu = (album: Album) => open({ kind: 'album', album });
export const openArtistMenu = (artist: Artist) => open({ kind: 'artist', artist });
export const closeMenu = () => { target = null; ls.forEach((l) => l()); };
export const useMenu = () => useSyncExternalStore((cb) => (ls.add(cb), () => void ls.delete(cb)), () => target);
