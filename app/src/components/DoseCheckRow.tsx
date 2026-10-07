import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import type { TodayDose } from '../api/types';
import { colors } from '../theme';
import SupplementThumb from './SupplementThumb';

type Props = {
  dose: TodayDose;
  disabled?: boolean;
  onClear: () => void;
  onTaken: () => void;
  onOpen: () => void;
  showTime?: boolean;
};

export default function DoseCheckRow({ disabled = false, dose, onClear, onTaken, onOpen, showTime = true }: Props) {
  const taken = dose.status === 'TAKEN';
  const name = dose.displayNameKo || dose.productName || '이름 없는 영양제';
  return (
    <View style={styles.row}>
      {showTime ? <Text style={[styles.time, taken && styles.muted]}>{dose.confirmedTime || '미설정'}</Text> :
        <SupplementThumb imageUri={dose.imageUri} name={name} size={42} />}
      <Pressable accessibilityRole="button" accessibilityLabel={name + ' 상세 정보'} onPress={onOpen} style={styles.identity}>
        <Text style={[styles.name, taken && styles.muted]}>{name}</Text>
        <Text style={styles.status}>{taken ? '복용 완료' : dose.status === 'SKIPPED' ? '건너뜀' : '복용 예정'}</Text>
      </Pressable>
      <Pressable accessibilityRole="checkbox" accessibilityLabel={name + (taken ? ' 복용 완료 취소' : ' 복용 완료')}
        accessibilityState={{ checked: taken, disabled }} aria-checked={taken} aria-disabled={disabled}
        disabled={disabled} onPress={taken ? onClear : onTaken}
        style={({ pressed }) => [styles.checkTarget, (pressed || disabled) && styles.dimmed]}>
        <View style={[styles.check, taken && styles.checked]}>
          {taken ? <Check size={19} strokeWidth={2.4} color={colors.white} /> : null}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 82, paddingVertical: 12, paddingHorizontal: 14 },
  time: { width: 48, color: colors.active, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  identity: { flex: 1, minWidth: 0, justifyContent: 'center', minHeight: 48, gap: 4 },
  name: { color: colors.ink, fontSize: 15, lineHeight: 22, fontWeight: '500' },
  status: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  muted: { color: colors.muted },
  checkTarget: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  check: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: colors.completed, borderColor: colors.completed },
  dimmed: { opacity: 0.5 },
});
