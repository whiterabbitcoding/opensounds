import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../lib/theme';

export const Icon = ({ name, size = 22, color }: { name: keyof typeof Ionicons.glyphMap; size?: number; color?: string }) => {
  const t = useTheme();
  return <Ionicons name={name} size={size} color={color ?? t.text} />;
};

export function Segmented<T extends string>({ options, value, onChange }: { options: { key: T; label: string }[]; value: T; onChange: (k: T) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: t.card, borderRadius: 10, padding: 3, marginHorizontal: 12 }}>
      {options.map((o) => (
        <Pressable key={o.key} onPress={() => onChange(o.key)} style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: o.key === value ? t.accent : 'transparent' }}>
          <Text style={{ color: o.key === value ? t.onAccent : t.dim, fontWeight: '600' }}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Chip({ label, active, onPress, icon }: { label: string; active?: boolean; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, backgroundColor: active ? t.accent : t.card }}>
      {icon && <Ionicons name={icon} size={15} color={active ? t.onAccent : t.dim} />}
      <Text style={{ color: active ? t.onAccent : t.text, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function PillButton({ label, icon, onPress, solid = true, style }: { label: string; icon?: keyof typeof Ionicons.glyphMap; onPress: () => void; solid?: boolean; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 24, backgroundColor: solid ? t.accent : t.card }, style]}>
      {icon && <Ionicons name={icon} size={18} color={solid ? t.onAccent : t.text} />}
      <Text style={{ color: solid ? t.onAccent : t.text, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

export const SectionTitle = ({ children, right }: { children: string; right?: React.ReactNode }) => {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginTop: 22, marginBottom: 10 }}>
      <Text style={{ color: t.text, fontSize: 18, fontWeight: '700' }}>{children}</Text>
      {right}
    </View>
  );
};
