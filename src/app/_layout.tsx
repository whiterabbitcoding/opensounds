import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MiniPlayer } from '../components/MiniPlayer';
import { RadioProgress } from '../components/RadioProgress';
import { EntityMenu } from '../components/EntityMenu';
import { StatsOverlay } from '../components/StatsOverlay';
import { setupPlayer } from '../lib/player';
import { loadRadios } from '../lib/radios';
import { loadSettings } from '../lib/settings';
import { loadServer } from '../lib/subsonic';
import { useTheme } from '../lib/theme';

function Shell() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const segments = useSegments() as string[];
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      await loadSettings();
      loadRadios();
      setupPlayer();
      const s = await loadServer();
      setReady(true);
      if (!s) router.replace('/login');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot once; the router instance is stable
  }, []);

  const top = segments[0];
  const inTabs = top === '(tabs)';
  // Tabs render their own mini player above the tab bar; stack screens get it here; now-playing/login don't.
  const showMini = ready && !inTabs && top !== 'now-playing' && top !== 'login';
  // Keep the chip clear of each screen's own controls (Now Playing: park it between the track info and the seek bar).
  const statsBottom = top === 'now-playing' ? 190 + insets.bottom : (inTabs ? 140 : top === 'login' ? 12 : 72) + insets.bottom;

  if (!ready) return <View style={{ flex: 1, backgroundColor: t.bg }} />;
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingBottom: inTabs || top === 'now-playing' ? 0 : insets.bottom }}>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.bg },
          headerTintColor: t.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: t.bg },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="now-playing" options={{ headerShown: false, presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
      {showMini && <MiniPlayer />}
      <StatsOverlay bottom={statsBottom} />
      <EntityMenu />
      <RadioProgress />
    </View>
  );
}

export default function Root() {
  return (
    <SafeAreaProvider>
      <Shell />
    </SafeAreaProvider>
  );
}
