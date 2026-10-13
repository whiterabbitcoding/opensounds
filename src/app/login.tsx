import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput } from 'react-native';
import { getServer, ping, saveServer } from '../lib/subsonic';
import { useTheme } from '../lib/theme';

export default function Login() {
  const t = useTheme();
  const router = useRouter();
  const cur = getServer();
  const [url, setUrl] = useState(cur?.url ?? '');
  const [user, setUser] = useState(cur?.user ?? '');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const connect = async () => {
    setErr('');
    setBusy(true);
    try {
      const s = { url: url.trim().replace(/\/+$/, ''), user: user.trim(), password };
      await ping(s);
      await saveServer(s);
      router.replace('/');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const input = { backgroundColor: t.card, color: t.text, padding: 14, borderRadius: 10, marginBottom: 12, fontSize: 16 } as const;
  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}>
      <Stack.Screen options={{ title: 'Connect' }} />
      <Text style={{ color: t.dim, marginBottom: 16 }}>Navidrome server (reachable over Tailscale)</Text>
      <TextInput style={input} value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} placeholder="http://<tailscale-ip>:4533" placeholderTextColor={t.dim} />
      <TextInput style={input} value={user} onChangeText={setUser} autoCapitalize="none" autoCorrect={false} placeholder="Username" placeholderTextColor={t.dim} />
      <TextInput style={input} value={password} onChangeText={setPassword} secureTextEntry placeholder="Password" placeholderTextColor={t.dim} />
      {!!err && <Text style={{ color: t.danger, marginBottom: 12 }}>{err}</Text>}
      <Pressable onPress={connect} disabled={busy} style={{ backgroundColor: t.accent, padding: 14, borderRadius: 10, alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
        <Text style={{ fontWeight: '700', color: t.onAccent }}>{busy ? 'Connecting…' : 'Connect'}</Text>
      </Pressable>
    </ScrollView>
  );
}
