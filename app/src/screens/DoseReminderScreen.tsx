import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { actOnReminderDose, getReminderDose, getWebPushState, webPushError, type ReminderDose, type WebPushState } from '../notifications/webPush';
import { reminderConfirmation } from '../notifications/reminderConfirmation';
import RitualAction from '../components/RitualAction';
import DoseRecordActions from '../components/DoseRecordActions';
import RitualSurface from '../components/RitualSurface';
import { colors } from '../theme';
import { readGarden } from '../garden/requests';
import { useGardenGrowth } from '../garden/GardenGrowthContext';
import type { DoseStatus } from '../api/types';
import { doseRecordLabel, isRecordedDose } from '../utils/doseRecord';

type Props = NativeStackScreenProps<RootStackParamList, 'DoseReminder'>;
export default function DoseReminderScreen({ route, navigation }: Props) {
  const { token } = useAuth();
  const { observeGarden } = useGardenGrowth();
  const [state, setState] = useState<WebPushState | null>(null);
  const [dose, setDose] = useState<ReminderDose | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const focusSession = useRef<{ active: boolean } | null>(null);
  const { supplementId, doseDate, doseTime } = route.params;
  const occurrence = `${supplementId}/${doseDate}/${doseTime}`;
  const currentOccurrence = useRef(occurrence);
  currentOccurrence.current = occurrence;
  useFocusEffect(useCallback(() => {
    const session = { active: true };
    focusSession.current = session;
    setBusy(inFlight.current);
    if (!token) return () => { session.active = false; };
    setLoading(true); setError(''); setDose(null); setState(null);
    void (async () => {
      try {
        const device = await getWebPushState(token);
        if (!device) throw new Error('이 기기의 알림 연결을 찾지 못했어요. 오늘의 복용에서 기록을 확인해 주세요.');
        const result = await getReminderDose(token, device, supplementId, doseDate, doseTime);
        if (session.active) { setState(device); setDose(result); }
      } catch (err) { if (session.active) setError(webPushError(err)); }
      finally { if (session.active) setLoading(false); }
    })();
    return () => { session.active = false; };
  }, [token, supplementId, doseDate, doseTime]));
  async function act(action: DoseStatus | 'SNOOZE') {
    if (!token || !state || !dose || loading || inFlight.current) return;
    const session = focusSession.current;
    const isCurrent = () => session?.active && session === focusSession.current
      && occurrence === currentOccurrence.current && navigation.isFocused();
    inFlight.current = true; setBusy(true); setError('');
    try {
      // The notification flow resets the home screen. Preserve a confirmed
      // baseline in the shared session before the write, even on a cold launch.
      if (action !== 'SNOOZE') {
        const before = await readGarden(token, 2000).catch(() => null);
        if (!isCurrent()) return;
        if (before) observeGarden(before, false);
      }
      const result = await actOnReminderDose(token, state, dose, action);
      if (!isCurrent()) return;
      const confirmation = reminderConfirmation(result);
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs', params: {
        screen: 'Today', params: { reminderConfirmation: confirmation },
      } }] });
    } catch (err) { if (isCurrent()) setError(webPushError(err)); }
    finally {
      inFlight.current = false;
      if (focusSession.current?.active) setBusy(false);
    }
  }
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}><View style={styles.rail}>
    {loading ? <ActivityIndicator accessibilityLabel="복용 기록 확인 중" color={colors.active} /> : dose ? <RitualSurface style={styles.card}>
      <Text style={styles.date}>{dose.doseDate.replaceAll('-', '.')} · {dose.doseTime}</Text>
      <Text style={styles.title}>{dose.name}</Text>
      <Text style={styles.body}>{!dose.active ? '지난 알림이에요. 오늘의 복용에서 현재 일정을 확인해 주세요.' : isRecordedDose(dose.status) ? `‘${doseRecordLabel(dose.status)}’로 기록했어요. 다른 답을 눌러 바로 바꿀 수 있어요.` : '이번 시간은 어땠나요? 편하게 기록해 주세요.'}</Text>
      {dose.nextReminderAt ? <Text style={styles.body}>{new Date(dose.nextReminderAt).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })}에 다시 알려드릴 예정이에요.</Text> : null}
      {dose.active ? <>
        <DoseRecordActions
          status={isRecordedDose(dose.status) ? dose.status : undefined}
          disabled={busy}
          name={dose.name}
          onRecord={(status) => void act(status)}
        />
        {!isRecordedDose(dose.status) && dose.canSnooze ? <RitualAction fullWidth tone="secondary" label="15분 뒤 다시 알림" disabled={busy} onPress={() => void act('SNOOZE')} /> : null}
      </> : null}
    </RitualSurface> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <RitualAction fullWidth tone="secondary" label="오늘의 복용 보기" disabled={busy} onPress={() => navigation.reset({ index: 0, routes: [{ name: 'MainTabs', params: { screen: 'Today' } }] })} />
  </View></ScrollView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, content: { padding: 24, paddingBottom: 40 }, rail: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: 20 },
  card: { padding: 24, gap: 18 }, date: { color: colors.muted, fontSize: 14 }, title: { color: colors.ink, fontSize: 24, lineHeight: 34, fontWeight: '600' },
  body: { color: colors.inkSoft, fontSize: 15, lineHeight: 25 }, error: { color: colors.danger, fontSize: 14, lineHeight: 23 },
});
