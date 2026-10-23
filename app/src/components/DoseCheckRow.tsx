import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DoseStatus, TodayDose } from '../api/types';
import { colors } from '../theme';
import SupplementThumb from './SupplementThumb';
import DoseRecordActions from './DoseRecordActions';
import { doseRecordLabel, isRecordedDose } from '../utils/doseRecord';

type Props = {
  dose: TodayDose;
  disabled?: boolean;
  onClear: () => void;
  onRecord: (status: DoseStatus) => void;
  onOpen: () => void;
  showTime?: boolean;
};

export default function DoseCheckRow({ disabled = false, dose, onClear, onRecord, onOpen, showTime = true }: Props) {
  const recorded = isRecordedDose(dose.status);
  const name = dose.displayNameKo || dose.productName || '이름 없는 영양제';
  return (
    <View style={styles.row}>
      <View style={styles.heading}>
      {showTime ? <Text style={styles.time}>{dose.confirmedTime || '미설정'}</Text> :
        <SupplementThumb supplementId={dose.supplementId} imageUri={dose.imageUri} name={name} size={42} />}
      <Pressable accessibilityRole="button" accessibilityLabel={name + ' 상세 정보'} onPress={onOpen} style={styles.identity}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.status}>{doseRecordLabel(dose.status)}</Text>
      </Pressable>
      {recorded ? <Pressable accessibilityRole="button" accessibilityLabel={name + ' 기록 지우기'} disabled={disabled}
        onPress={() => { if (!disabled) onClear(); }} style={({ pressed }) => [styles.clear, (pressed || disabled) && styles.dimmed]}>
        <Text style={styles.clearLabel}>지우기</Text>
      </Pressable> : null}
      </View>
      <DoseRecordActions status={dose.status} disabled={disabled} onRecord={onRecord} name={name} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 12, paddingVertical: 16, paddingHorizontal: 14 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  time: { width: 48, color: colors.inkSoft, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  identity: { flex: 1, minWidth: 0, justifyContent: 'center', minHeight: 48, gap: 4 },
  name: { color: colors.ink, fontSize: 15, lineHeight: 22, fontWeight: '500' },
  status: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  clear: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  clearLabel: { fontSize: 11, color: colors.muted },
  dimmed: { opacity: 0.5 },
});
