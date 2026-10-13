import { useSyncExternalStore } from 'react';
import { playSongs } from './player';
import { buildRadio, resumeRadio, type RadioSeed } from './radio';
import { saveRadio, type SavedRadio } from './radios';

// Global "building radio…" state so any screen can start one and the root renders the progress sheet.
type S = { active: boolean; msg: string; error?: string };
let state: S = { active: false, msg: '' };
let token = 0;
const ls = new Set<() => void>();
const set = (p: Partial<S>) => { state = { ...state, ...p }; ls.forEach((l) => l()); };
export const useRadioStatus = () => useSyncExternalStore((cb) => (ls.add(cb), () => void ls.delete(cb)), () => state);

export async function startRadio(seed: RadioSeed) {
  const mine = ++token;
  set({ active: true, msg: 'Starting…', error: undefined });
  try {
    const { session, first } = await buildRadio(seed, (m) => mine === token && set({ msg: m }));
    if (mine !== token) return; // cancelled
    if (!first.length) throw new Error('No related tracks found for this seed');
    saveRadio(session.label, seed, first);
    await playSongs(first, 0, { radio: session, shuffle: false });
    set({ active: false });
  } catch (e: any) {
    if (mine === token) set({ error: e.message ?? 'Radio failed' });
  }
}
export const cancelRadio = () => { token++; set({ active: false, error: undefined }); };

// Instant replay of a saved radio (no crawl until it needs more tracks).
export const playSavedRadio = (r: SavedRadio) => playSongs(r.songs, 0, { radio: resumeRadio(r), shuffle: false });
