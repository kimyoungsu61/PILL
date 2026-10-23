import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DoseStatus } from '../api/types';
import { DOSE_RECORD_OPTIONS } from '../utils/doseRecord';
import { colors } from '../theme';

type Props = {
  status?: DoseStatus;
  disabled?: boolean;
  onRecord: (status: DoseStatus) => void;
  name?: string;
};

/** Each answer is one tap, with identical emphasis and no default answer. */
export default function DoseRecordActions({ status, disabled = false, onRecord, name }: Props) {
  return <View style={styles.actions}>
    {DOSE_RECORD_OPTIONS.map(option => {
      const selected = status === option.status;
      return <Pressable key={option.status} accessibilityRole="button"
        accessibilityLabel={name ? `${name} ${option.label}` : option.label}
        accessibilityState={{ selected, disabled: disabled || selected }}
        disabled={disabled || selected} onPress={() => { if (!disabled && !selected) onRecord(option.status); }}
        style={({ pressed }) => [styles.action, selected && styles.selected, (pressed || disabled) && styles.dimmed]}>
        <Text style={[styles.label, selected && styles.selectedLabel]}>{option.label}</Text>
      </Pressable>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  actions: { width: '100%', flexDirection: 'row', gap: 6 },
  action: { flex: 1, minWidth: 48, minHeight: 54, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5, paddingVertical: 9,
    borderRadius: 11, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  selected: { borderColor: colors.active, backgroundColor: colors.activeSoft },
  label: { fontSize: 12, lineHeight: 18, fontWeight: '500', color: colors.inkSoft, textAlign: 'center' },
  selectedLabel: { color: colors.active, fontWeight: '600' },
  dimmed: { opacity: 0.55 },
});
