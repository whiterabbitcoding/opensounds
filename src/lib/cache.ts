import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

// Stale-while-revalidate JSON cache: paint cached data instantly, refresh in the background.
const P = 'cache.v1:';
const mem = new Map<string, unknown>();

export async function readCache<T>(key: string): Promise<T | undefined> {
  if (mem.has(key)) return mem.get(key) as T;
  try {
    const raw = await AsyncStorage.getItem(P + key);
    if (raw) {
      const v = JSON.parse(raw);
      mem.set(key, v);
      return v as T;
    }
  } catch {}
}
export async function writeCache(key: string, value: unknown) {
  mem.set(key, value);
  try {
    await AsyncStorage.setItem(P + key, JSON.stringify(value));
  } catch {}
}
export async function clearDataCache() {
  mem.clear();
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(P));
  await AsyncStorage.multiRemove(keys);
}

export function useCached<T>(key: string, fetcher: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const [refreshing, setRefreshing] = useState(true);
  const run = async () => {
    setRefreshing(true);
    try {
      const fresh = await fetcher();
      setData(fresh);
      writeCache(key, fresh);
      setError(undefined);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  };
  useEffect(() => {
    let live = true;
    readCache<T>(key).then((c) => live && c !== undefined && setData((d) => d ?? c));
    // Fetch-on-key hook: `run` flips `refreshing` synchronously by design (spinner while revalidating).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    run();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `run` closes over fetcher; caller-supplied deps drive refetch
  }, [key, ...deps]);
  return { data, error, refreshing, refresh: run };
}
