import { Image } from 'expo-image';
import { View } from 'react-native';
import { coverUrl } from '../lib/subsonic';
import { useTheme } from '../lib/theme';

// Disk-cached artwork. Media URLs are stable per session, and cacheKey keeps the cache valid across sessions
// (the auth salt in the URL changes each launch, the artwork doesn't).
export function Cover({ id, size, radius = 8 }: { id?: string; size: number; radius?: number }) {
  const t = useTheme();
  const style = { width: size, height: size, borderRadius: radius, backgroundColor: t.card };
  if (!id) return <View style={style} />;
  const px = Math.round(size * 2 > 300 ? (size * 2 > 600 ? 800 : 500) : 300);
  return (
    <Image
      source={{ uri: coverUrl(id, px), cacheKey: `cover:${id}:${px}` }}
      style={style}
      cachePolicy="disk"
      recyclingKey={id}
      transition={120}
      contentFit="cover"
    />
  );
}
