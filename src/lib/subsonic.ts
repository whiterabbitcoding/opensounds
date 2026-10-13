import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { getSettings, type Quality } from './settings';

export type Server = { url: string; user: string; password: string };
export type Artist = { id: string; name: string; albumCount?: number; starred?: string };
export type Album = {
  id: string; name: string; artist?: string; artistId?: string; coverArt?: string;
  year?: number; songCount?: number; duration?: number; created?: string; playCount?: number; genre?: string; starred?: string;
};
export type Song = {
  id: string; title: string; artist?: string; artistId?: string; album?: string; albumId?: string; coverArt?: string;
  duration?: number; track?: number; discNumber?: number; suffix?: string; bitRate?: number; samplingRate?: number;
  bitDepth?: number; size?: number; genre?: string; year?: number; starred?: string; playCount?: number; channelCount?: number;
};
export type Playlist = { id: string; name: string; songCount: number; duration?: number; coverArt?: string };

const KEY = 'server';
let server: Server | null = null;
let authQ: URLSearchParams | null = null;

// Rolling byte counters for JSON API traffic (audio is counted natively, see traffic-stats module).
export const net = { apiBytes: 0, apiCalls: 0 };

async function buildAuth(s: Server) {
  // Subsonic token auth: t = md5(password + salt). One salt per session keeps media URLs stable (image/disk caching).
  const salt = Crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  const t = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.MD5, s.password + salt);
  return new URLSearchParams({ u: s.user, t, s: salt, v: '1.16.1', c: 'symposium' });
}

export async function loadServer() {
  const raw = await SecureStore.getItemAsync(KEY);
  server = raw ? JSON.parse(raw) : null;
  authQ = server ? await buildAuth(server) : null;
  return server;
}
export async function saveServer(s: Server) {
  server = { ...s, url: s.url.replace(/\/+$/, '') };
  authQ = await buildAuth(server);
  await SecureStore.setItemAsync(KEY, JSON.stringify(server));
}
export async function clearServer() {
  server = null;
  authQ = null;
  await SecureStore.deleteItemAsync(KEY);
}
export const getServer = () => server;

async function call<T = any>(endpoint: string, params: Record<string, string | number | undefined> = {}, s = server): Promise<T> {
  if (!s) throw new Error('No server configured');
  const q = new URLSearchParams(s === server && authQ ? authQ : await buildAuth(s));
  q.set('f', 'json');
  for (const [k, v] of Object.entries(params)) if (v !== undefined) q.set(k, String(v));
  const res = await fetch(`${s.url}/rest/${endpoint}?${q}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  net.apiBytes += text.length;
  net.apiCalls++;
  const body = JSON.parse(text)['subsonic-response'];
  if (body.status !== 'ok') throw new Error(body.error?.message ?? 'Subsonic error');
  return body;
}

export const ping = (s: Server) => call('ping', {}, s);

// ---- Browse -----------------------------------------------------------------
export async function getArtists(): Promise<Artist[]> {
  const r = await call('getArtists');
  return (r.artists.index ?? []).flatMap((i: any) => i.artist ?? []);
}
export async function getArtist(id: string): Promise<{ artist: Artist; albums: Album[] }> {
  const r = (await call('getArtist', { id })).artist;
  return { artist: r, albums: r.album ?? [] };
}
export async function getAlbum(id: string): Promise<{ album: Album; songs: Song[] }> {
  const r = (await call('getAlbum', { id })).album;
  return { album: r, songs: r.song ?? [] };
}
export type AlbumListType = 'recent' | 'newest' | 'frequent' | 'random' | 'alphabeticalByName' | 'alphabeticalByArtist' | 'starred';
export async function getAlbumList(type: AlbumListType, size = 20, offset = 0): Promise<Album[]> {
  return (await call('getAlbumList2', { type, size, offset })).albumList2?.album ?? [];
}
export async function getAllAlbums(): Promise<Album[]> {
  const out: Album[] = [];
  for (let offset = 0; ; offset += 500) {
    const page = await getAlbumList('alphabeticalByName', 500, offset);
    out.push(...page);
    if (page.length < 500) break;
  }
  return out;
}
export async function getRandomSongs(size = 50, extra: { genre?: string; fromYear?: number; toYear?: number } = {}): Promise<Song[]> {
  return (await call('getRandomSongs', { size, ...extra })).randomSongs?.song ?? [];
}
export async function search(query: string): Promise<{ artists: Artist[]; albums: Album[]; songs: Song[] }> {
  const r = (await call('search3', { query, artistCount: 10, albumCount: 20, songCount: 40 })).searchResult3 ?? {};
  return { artists: r.artist ?? [], albums: r.album ?? [], songs: r.song ?? [] };
}
export async function getStarred(): Promise<{ artists: Artist[]; albums: Album[]; songs: Song[] }> {
  const r = (await call('getStarred2')).starred2 ?? {};
  return { artists: r.artist ?? [], albums: r.album ?? [], songs: r.song ?? [] };
}

// ---- Discovery --------------------------------------------------------------
export async function getSimilarArtists(id: string, count = 20): Promise<Artist[]> {
  const r = await call('getArtistInfo2', { id, count, includeNotPresent: 'false' });
  return r.artistInfo2?.similarArtist ?? [];
}
export async function getSimilarSongs(id: string, count = 40): Promise<Song[]> {
  return (await call('getSimilarSongs2', { id, count })).similarSongs2?.song ?? [];
}
export async function getTopSongs(artist: string, count = 10): Promise<Song[]> {
  try {
    return (await call('getTopSongs', { artist, count })).topSongs?.song ?? [];
  } catch {
    return [];
  }
}

// ---- Library state ----------------------------------------------------------
export const star = (p: { id?: string; albumId?: string; artistId?: string }) => call('star', p);
export const unstar = (p: { id?: string; albumId?: string; artistId?: string }) => call('unstar', p);
export const scrobble = (id: string, submission: boolean) => call('scrobble', { id, submission: String(submission) }).catch(() => {});

export async function getPlaylists(): Promise<Playlist[]> {
  return (await call('getPlaylists')).playlists?.playlist ?? [];
}
export async function getPlaylist(id: string): Promise<{ playlist: Playlist; songs: Song[] }> {
  const p = (await call('getPlaylist', { id })).playlist;
  return { playlist: p, songs: p.entry ?? [] };
}
export async function createPlaylist(name: string, songIds: string[]) {
  const q = new URLSearchParams(authQ!);
  q.set('f', 'json');
  q.set('name', name);
  songIds.forEach((id) => q.append('songId', id));
  const res = await fetch(`${server!.url}/rest/createPlaylist?${q}`);
  const body = (await res.json())['subsonic-response'];
  if (body.status !== 'ok') throw new Error(body.error?.message ?? 'Subsonic error');
  return body.playlist as Playlist;
}
export async function addToPlaylist(playlistId: string, songIds: string[]) {
  const q = new URLSearchParams(authQ!);
  q.set('f', 'json');
  q.set('playlistId', playlistId);
  songIds.forEach((id) => q.append('songIdToAdd', id));
  await fetch(`${server!.url}/rest/updatePlaylist?${q}`);
}
export const deletePlaylist = (id: string) => call('deletePlaylist', { id });

// ---- Media URLs (synchronous: auth is cached per session) --------------------
function mediaUrl(endpoint: string, params: Record<string, string | number>) {
  const q = new URLSearchParams(authQ!);
  for (const [k, v] of Object.entries(params)) q.set(k, String(v));
  return `${server!.url}/rest/${endpoint}?${q}`;
}
export const coverUrl = (id: string, size = 300) => mediaUrl('getCoverArt', { id, size });

const QUALITY: Record<Exclude<Quality, 'original'>, { format: string; maxBitRate: number }> = {
  'mp3-320': { format: 'mp3', maxBitRate: 320 },
  'mp3-192': { format: 'mp3', maxBitRate: 192 },
  'opus-128': { format: 'opus', maxBitRate: 128 },
};
export function streamUrl(id: string) {
  const q = getSettings().quality;
  return q === 'original' ? mediaUrl('stream', { id }) : mediaUrl('stream', { id, ...QUALITY[q] });
}

// All songs by an artist, oldest album first.
export async function getArtistSongs(artistId: string): Promise<Song[]> {
  const { albums } = await getArtist(artistId);
  const sorted = [...albums].sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
  return (await Promise.all(sorted.map((a) => getAlbum(a.id).then((r) => r.songs)))).flat();
}
