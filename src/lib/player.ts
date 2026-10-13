import AsyncStorage from '@react-native-async-storage/async-storage';
import { type AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { useSyncExternalStore } from 'react';
import { getSettings } from './settings';
import { coverUrl, scrobble, streamUrl, type Song } from './subsonic';

// One long-lived native player + a JS-side queue. expo-audio's lock-screen integration is per-player
// (no native next/prev yet), so queue advancement happens here.
export type Repeat = 'off' | 'all' | 'one';
export type RadioSession = { label: string; more(count: number): Promise<Song[]> };

export type PlayerState = {
  base: Song[]; // queue in original order (restored when shuffle is turned off)
  queue: Song[]; // actual play order
  index: number;
  playing: boolean;
  position: number;
  duration: number;
  shuffle: boolean;
  repeat: Repeat;
  radio: string | null; // label of the active radio, if any
  loading: boolean;
};

const PERSIST = 'player.v1';
const HISTORY = 'history.v1';

let player: AudioPlayer | null = null;
let loaded = false;
let radioSession: RadioSession | null = null;
let extending = false;
let scrobbled = false;
let history: string[] = []; // most recent first

let state: PlayerState = { base: [], queue: [], index: -1, playing: false, position: 0, duration: 0, shuffle: false, repeat: 'off', radio: null, loading: false };
const listeners = new Set<() => void>();
const set = (p: Partial<PlayerState>) => {
  state = { ...state, ...p };
  listeners.forEach((l) => l());
};

export const usePlayer = () =>
  useSyncExternalStore((cb) => (listeners.add(cb), () => void listeners.delete(cb)), () => state);
export const getPlayerState = () => state;
export const getHistory = () => history;
export const currentSong = () => state.queue[state.index];

// ---- persistence --------------------------------------------------------------
let persistTimer: ReturnType<typeof setTimeout> | undefined;
function persist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    const { base, queue, index, shuffle, repeat } = state;
    AsyncStorage.setItem(PERSIST, JSON.stringify({ base, queue, index, shuffle, repeat })).catch(() => {});
  }, 800);
}

// ---- setup --------------------------------------------------------------------
let setupPromise: Promise<AudioPlayer> | null = null;
export function setupPlayer() {
  setupPromise ??= (async () => {
    await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' });
    const p = createAudioPlayer(null, { updateInterval: 500 });
    p.addListener('playbackStatusUpdate', (s) => {
      set({ playing: s.playing, position: s.currentTime, duration: s.duration || state.duration, loading: s.isBuffering && !s.playing });
      const cur = currentSong();
      if (cur && !scrobbled && getSettings().scrobble && s.currentTime >= Math.min((s.duration || cur.duration || 240) / 2, 240)) {
        scrobbled = true;
        scrobble(cur.id, true);
      }
      if (s.didJustFinish) onFinished();
    });
    player = p;
    try {
      const [q, h] = await Promise.all([AsyncStorage.getItem(PERSIST), AsyncStorage.getItem(HISTORY)]);
      if (h) history = JSON.parse(h);
      if (q) {
        const saved = JSON.parse(q);
        if (saved.queue?.length) set({ ...saved, duration: saved.queue[saved.index]?.duration ?? 0 });
      }
    } catch {}
    return p;
  })();
  return setupPromise;
}

async function load(index: number, autoplay = true) {
  const p = await setupPlayer();
  const song = state.queue[index];
  if (!song) return;
  scrobbled = false;
  set({ index, position: 0, duration: song.duration ?? 0, loading: true });
  p.replace(streamUrl(song.id));
  loaded = true;
  p.setActiveForLockScreen(true, {
    title: song.title,
    artist: song.artist,
    albumTitle: song.album,
    artworkUrl: song.coverArt ? coverUrl(song.coverArt, 500) : undefined,
  });
  if (autoplay) p.play();
  history = [song.id, ...history.filter((x) => x !== song.id)].slice(0, 200);
  AsyncStorage.setItem(HISTORY, JSON.stringify(history)).catch(() => {});
  if (getSettings().scrobble) scrobble(song.id, false);
  persist();
  maybeExtendRadio();
}

function shuffled<T>(a: T[]) {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

// ---- queue control ------------------------------------------------------------
export async function playSongs(songs: Song[], startIndex = 0, opts: { shuffle?: boolean; radio?: RadioSession } = {}) {
  if (!songs.length) return;
  radioSession = opts.radio ?? null;
  const shuffle = opts.shuffle ?? state.shuffle;
  let queue = songs;
  let index = startIndex;
  if (shuffle) {
    const first = opts.shuffle ? Math.floor(Math.random() * songs.length) : startIndex;
    const start = songs[first];
    queue = [start, ...shuffled(songs.filter((_, i) => i !== first))];
    index = 0;
  }
  set({ base: songs, queue, shuffle, radio: opts.radio?.label ?? null });
  await load(index);
}

export const shuffleSongs = (songs: Song[]) => playSongs(songs, 0, { shuffle: true });

export async function next() {
  if (state.index + 1 < state.queue.length) return load(state.index + 1);
  if (state.repeat === 'all' && state.queue.length) return load(0);
  player?.pause();
}
export async function prev() {
  if (state.position > 3 || state.index <= 0) return void player?.seekTo(0);
  return load(state.index - 1);
}
export const jumpTo = (i: number) => load(i);

function onFinished() {
  if (state.repeat === 'one') {
    player?.seekTo(0);
    player?.play();
    return;
  }
  next();
}

export async function toggle() {
  const p = await setupPlayer();
  if (!loaded) return void (state.queue[state.index] && load(state.index));
  if (state.playing) p.pause();
  else p.play();
}
export const seekTo = (s: number) => void player?.seekTo(s);

export function setShuffle(on: boolean) {
  if (on === state.shuffle) return;
  const cur = currentSong();
  if (on) {
    const rest = shuffled(state.queue.filter((_, i) => i !== state.index));
    set({ shuffle: true, queue: cur ? [cur, ...rest] : rest, index: cur ? 0 : -1 });
  } else {
    const i = cur ? state.base.findIndex((s) => s.id === cur.id) : -1;
    set({ shuffle: false, queue: state.base, index: i });
  }
  persist();
}
export function cycleRepeat() {
  set({ repeat: state.repeat === 'off' ? 'all' : state.repeat === 'all' ? 'one' : 'off' });
  persist();
}

export function playNext(songs: Song[]) {
  if (!state.queue.length) return void playSongs(songs);
  const at = state.index + 1;
  set({ queue: [...state.queue.slice(0, at), ...songs, ...state.queue.slice(at)], base: [...state.base, ...songs] });
  persist();
}
export function addToQueue(songs: Song[]) {
  if (!state.queue.length) return void playSongs(songs);
  set({ queue: [...state.queue, ...songs], base: [...state.base, ...songs] });
  persist();
}
export function removeFromQueue(i: number) {
  if (i === state.index) return;
  const queue = state.queue.filter((_, k) => k !== i);
  set({ queue, index: i < state.index ? state.index - 1 : state.index });
  persist();
}
export function stopAndClear() {
  player?.pause();
  loaded = false;
  radioSession = null;
  set({ base: [], queue: [], index: -1, playing: false, position: 0, duration: 0, radio: null });
  persist();
}

// ---- radio --------------------------------------------------------------------
async function maybeExtendRadio() {
  if (!radioSession || extending || state.queue.length - state.index > 6) return;
  extending = true;
  try {
    const more = await radioSession.more(25);
    if (more.length && radioSession) {
      set({ queue: [...state.queue, ...more], base: [...state.base, ...more] });
      persist();
    }
  } catch {
  } finally {
    extending = false;
  }
}
