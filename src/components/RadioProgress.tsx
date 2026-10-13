import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { cancelRadio, useRadioStatus } from '../lib/radioUi';
import { useTheme } from '../lib/theme';

export function RadioProgress() {
  const t = useTheme();
  const { active, msg, error } = useRadioStatus();
  if (!active) return null;
  return (
    <Modal transparent animationType="fade" onRequestClose={cancelRadio}>
      <View style={{ flex: 1, backgroundColor: '#000a', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <View style={{ backgroundColor: t.card, borderRadius: 18, padding: 24, width: '100%', alignItems: 'center', gap: 14 }}>
          {error ? (
            <Text style={{ color: t.danger, textAlign: 'center' }}>{error}</Text>
          ) : (
            <>
              <ActivityIndicator color={t.accent} size="large" />
              <Text style={{ color: t.text, fontWeight: '700', fontSize: 16 }}>Building your radio</Text>
              <Text style={{ color: t.dim, textAlign: 'center' }}>{msg}</Text>
            </>
          )}
          <Pressable onPress={cancelRadio} style={{ paddingVertical: 8, paddingHorizontal: 20 }}>
            <Text style={{ color: t.accent, fontWeight: '700' }}>{error ? 'Close' : 'Cancel'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
