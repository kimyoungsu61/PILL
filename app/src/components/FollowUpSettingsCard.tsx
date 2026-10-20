import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { type FollowUpSettings } from '../notifications/webPush';
import { colors } from '../theme';
import RitualAction from './RitualAction';
import RitualSurface from './RitualSurface';
import TimePickerField from './TimePickerField';

type Props = { settings: FollowUpSettings; busy: boolean; onSave: (settings: FollowUpSettings) => void };
export default function FollowUpSettingsCard({ settings, busy, onSave }: Props) {
  const [draft, setDraft] = useState(settings);
  useEffect(() => { setDraft(settings); }, [settings]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);
  return <RitualSurface style={styles.card}>
    <View style={styles.row}>
      <View style={styles.copy}><Text style={styles.title}>후속 알림</Text><Text style={styles.body}>복용 기록이 없을 때 한 번 더 알려드려요.</Text></View>
      <Switch accessibilityLabel="후속 알림" value={draft.enabled} disabled={busy}
        trackColor={{ false: colors.line, true: colors.active }} onValueChange={enabled => setDraft(value => ({ ...value, enabled }))} />
    </View>
    {draft.enabled ? <>
      <Text style={styles.label}>다시 알려줄 간격</Text>
      <View style={styles.choices}>{[1, 5, 15, 30, 60].map(value => <Choice key={value} label={`${value}분`} selected={draft.intervalMinutes === value}
        disabled={busy} onPress={() => setDraft(current => ({ ...current, intervalMinutes: value }))} />)}</View>
      <Text style={styles.label}>최대 추가 알림</Text>
      <View style={styles.choices}>{[1, 2, 3].map(value => <Choice key={value} label={`${value}회`} selected={draft.maxFollowUps === value}
        disabled={busy} onPress={() => setDraft(current => ({ ...current, maxFollowUps: value }))} />)}</View>
      <Text style={styles.body}>완료하거나 건너뛴 일정에는 다시 알리지 않아요.</Text>
    </> : null}
    <View style={styles.row}><View style={styles.copy}><Text style={styles.label}>알림 쉬는 시간</Text>
      <Text style={styles.body}>이 시간에는 후속 알림과 미룬 알림을 보내지 않아요. 원래 복용 알림은 그대로 받아요.</Text></View>
      <Switch accessibilityLabel="후속 알림 쉬는 시간" value={draft.quietEnabled} disabled={busy}
        trackColor={{ false: colors.line, true: colors.active }} onValueChange={quietEnabled => setDraft(value => ({ ...value, quietEnabled }))} /></View>
    {draft.quietEnabled ? <View style={styles.quiet}>
      <View style={styles.copy}><TimePickerField label="쉬는 시간 시작" value={draft.quietStart} disabled={busy} onChange={quietStart => setDraft(value => ({ ...value, quietStart }))} /></View>
      <View style={styles.copy}><TimePickerField label="쉬는 시간 종료" value={draft.quietEnd} disabled={busy} onChange={quietEnd => setDraft(value => ({ ...value, quietEnd }))} /></View>
    </View> : null}
    {dirty ? <RitualAction fullWidth label="후속 알림 저장" loading={busy} onPress={() => onSave(draft)} /> : null}
  </RitualSurface>;
}
function Choice({ label, selected, disabled, onPress }: { label: string; selected: boolean; disabled: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: selected, disabled }} aria-checked={selected} disabled={disabled}
    onPress={onPress} style={[styles.choice, selected && styles.selected]}><Text style={[styles.choiceText, selected && styles.selectedText]}>{label}</Text></Pressable>;
}
const styles = StyleSheet.create({
  card: { padding: 22, gap: 14 }, row: { flexDirection: 'row', alignItems: 'center', gap: 14 }, copy: { flex: 1, minWidth: 0 },
  title: { color: colors.ink, fontSize: 18, fontWeight: '600', lineHeight: 27 }, body: { color: colors.muted, fontSize: 13, lineHeight: 21 },
  label: { color: colors.inkSoft, fontSize: 14, fontWeight: '500', lineHeight: 23 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minHeight: 44, minWidth: 48, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.surfaceMuted },
  selected: { backgroundColor: colors.activeSoft }, choiceText: { color: colors.inkSoft, fontSize: 14 }, selectedText: { color: colors.active, fontWeight: '600' },
  quiet: { flexDirection: 'row', gap: 10 },
});
