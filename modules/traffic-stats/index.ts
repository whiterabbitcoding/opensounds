import { requireNativeModule } from 'expo';

type Native = { getRxBytes(): number };
let mod: Native | null = null;
try {
  mod = requireNativeModule<Native>('TrafficStats');
} catch {
  mod = null;
}

/** Total bytes received by this app since device boot, or -1 if unavailable. */
export const getRxBytes = () => {
  try {
    return mod ? mod.getRxBytes() : -1;
  } catch {
    return -1;
  }
};
