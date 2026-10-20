import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Bell, CheckCircle2, X } from 'lucide-react-native';
import type { RegistrationReminders } from '../notifications/registrationReminders';
import { colors, spacing, type } from '../theme';
import RitualAction from './RitualAction';
import RitualSurface from './RitualSurface';

type Props = {
  result: RegistrationReminders;
  busy: boolean;
  onRetry: () => void;
  onSettings: () => void;
  onDismiss: () => void;
};

export default function RegistrationReminderNotice({ result, busy, onRetry, onSettings, onDismiss }: Props) {
  const enabled = result.status === 'enabled';
  return <RitualSurface style={styles.surface}>
    <View style={styles.heading}>
      {enabled ? <CheckCircle2 color={colors.completed} size={21} /> : <Bell color={colors.active} size={21} />}
      <Text accessibilityLiveRegion="polite" style={styles.title}>{enabled ? '복용 알림도 켰어요' : '영양제는 등록됐어요'}</Text>
      <Pressable accessibilityLabel="등록 안내 닫기" accessibilityRole="button" disabled={busy} onPress={onDismiss} style={styles.close}>
        <X color={colors.muted} size={18} />
      </Pressable>
    </View>
    <Text style={styles.body}>{enabled
      ? `${result.times.join(' · ')}에 이 기기로 알려드릴게요.`
      : result.status === 'needs-setup'
        ? '이 기기의 알림이 꺼져 있어요. 알림 설정에서 켜고 복용 시간을 선택해 주세요.'
        : '복용 시간은 저장했지만 알림을 연결하지 못했어요. 영양제를 다시 등록할 필요 없이 알림만 다시 연결할 수 있어요.'}</Text>
    {!enabled ? <RitualAction fullWidth label={result.status === 'retry' ? '알림 다시 연결' : '알림 설정 열기'} loading={busy}
      tone="secondary" onPress={result.status === 'retry' ? onRetry : onSettings} /> : null}
  </RitualSurface>;
}

const styles = StyleSheet.create({
  surface: { gap: spacing.sm },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...type.body, flex: 1, color: colors.ink, fontWeight: '700' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginVertical: -8, marginRight: -8 },
  body: { ...type.body, color: colors.inkSoft },
});
