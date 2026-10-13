import { Tabs } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MiniPlayer } from '../../components/MiniPlayer';
import { Icon } from '../../components/ui';
import { useTheme } from '../../lib/theme';

const TABS: Record<string, { label: string; icon: any; iconOn: any }> = {
  index: { label: 'Home', icon: 'home-outline', iconOn: 'home' },
  library: { label: 'Library', icon: 'library-outline', iconOn: 'library' },
  search: { label: 'Search', icon: 'search-outline', iconOn: 'search' },
  settings: { label: 'Settings', icon: 'settings-outline', iconOn: 'settings' },
};

export default function TabsLayout() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{ headerStyle: { backgroundColor: t.bg }, headerTintColor: t.text, headerShadowVisible: false, sceneStyle: { backgroundColor: t.bg } }}
      tabBar={({ state, navigation }) => (
        <View>
          <MiniPlayer />
          <View style={{ flexDirection: 'row', backgroundColor: t.bg, borderTopWidth: 1, borderColor: t.line, paddingBottom: insets.bottom, paddingTop: 6 }}>
            {state.routes.map((r, i) => {
              const cfg = TABS[r.name];
              if (!cfg) return null;
              const on = state.index === i;
              return (
                <Pressable key={r.key} onPress={() => navigation.navigate(r.name)} style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
                  <Icon name={on ? cfg.iconOn : cfg.icon} size={22} color={on ? t.accent : t.dim} />
                  <Text style={{ color: on ? t.accent : t.dim, fontSize: 11, marginTop: 2 }}>{cfg.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}>
      <Tabs.Screen name="index" options={{ title: 'Symposium' }} />
      <Tabs.Screen name="library" options={{ title: 'Library' }} />
      <Tabs.Screen name="search" options={{ title: 'Search' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
