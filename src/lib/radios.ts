import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import type { RadioSeed } from './radio';
import type { Song } from './subsonic';

// Every radio you start is kept: the seed (so it can regenerate/extend) and a snapshot of its first
// tracks (so it replays instantly, even without waiting for the artist-graph crawl).
export type SavedRadio = { id: string; label: string; seed: RadioSeed; songs: Song[]; created: number };

const KEY = 'radios.v1';
const MAX = 40;
let list: SavedRadio[] = [];
const ls = new Set<() => void>();

export const seedKey = (s: RadioSeed) =>
  s.kind === 'song' ? `song:${s.song.id}` : s.kind === 'artist' ? `artist:${s.id}` : s.kind === 'album' ? `album:${s.album.id}` : 'mix';

const emit = () => { ls.forEach((l) => l()); AsyncStorage.setItem(KEY, JSON.stringify(list)).catch(() => {}); };

export async function loadRadios() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) list = JSON.parse(raw);
  } catch {}
  ls.forEach((l) => l());
}
export function saveRadio(label: string, seed: RadioSeed, songs: Song[]) {
  const id = seedKey(seed);
  list = [{ id, label, seed, songs, created: Date.now() }, ...list.filter((r) => r.id !== id)].slice(0, MAX);
  emit();
}
export function deleteRadio(id: string) {
  list = list.filter((r) => r.id !== id);
  emit();
}
export const useRadios = () => useSyncExternalStore((cb) => (ls.add(cb), () => void ls.delete(cb)), () => list);
