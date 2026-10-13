import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

export type Quality = 'original' | 'mp3-320' | 'mp3-192' | 'opus-128';
export type Settings = {
  theme: 'symposium' | 'dathomir' | 'tokyo' | 'dracula' | 'light';
  quality: Quality;
  showStats: boolean;
  statsDetail: 'compact' | 'full';
  scrobble: boolean;
};

const DEFAULTS: Settings = { theme: 'symposium', quality: 'original', showStats: false, statsDetail: 'compact', scrobble: true };
const KEY = 'settings.v1';

let state: Settings = DEFAULTS;
const listeners = new Set<() => void>();

export const getSettings = () => state;
export async function loadSettings() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) state = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  listeners.forEach((l) => l());
}
export function updateSettings(p: Partial<Settings>) {
  state = { ...state, ...p };
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  listeners.forEach((l) => l());
}
export const useSettings = () =>
  useSyncExternalStore((cb) => (listeners.add(cb), () => void listeners.delete(cb)), () => state);
