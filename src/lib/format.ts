import type { Song } from './subsonic';

export const fmtTime = (s = 0) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export const fmtBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : n < 1073741824 ? `${(n / 1048576).toFixed(1)} MB` : `${(n / 1073741824).toFixed(2)} GB`;

export function audioInfo(s?: Song) {
  if (!s) return '';
  const fmt = (s.suffix ?? '').toUpperCase();
  const khz = s.samplingRate ? `${+(s.samplingRate / 1000).toFixed(1)} kHz` : '';
  const bits = s.bitDepth ? `${s.bitDepth}-bit` : '';
  const br = s.bitRate ? `${s.bitRate} kbps` : '';
  return [fmt, [khz, bits].filter(Boolean).join(' / '), br].filter(Boolean).join(' · ');
}
