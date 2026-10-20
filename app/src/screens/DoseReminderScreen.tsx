import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { actOnReminderDose, getReminderDose, getWebPushState, webPushError, type ReminderDose, type WebPushState } from '../notifications/webPush';
import RitualAction from '../components/RitualAction';
import RitualSurface from '../components/RitualSurface';
import { colors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'DoseReminder'>;
export default function DoseReminderScreen({ route, navigation }: Props) {
  const { token } = useAuth();
  const [state, setState] = useState<WebPushState | null>(null);
  const [dose, setDose] = useState<ReminderDose | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const inFlight = useRef(false);
  const { supplementId, doseDate, doseTime } = route.params;
  useFocusEffect(useCallback(() => {
    let current = true;
    if (!token) return;
    setLoading(true); setError(''); setDose(null); setMessage('');
    void (async () => {
      try {
        const device = await getWebPushState(token);
        if (!device) throw new Error('이 기기의 알림 연결을 찾지 못했어요. 오늘의 복용에서 기록을 확인해 주세요.');
        const result = await getReminderDose(token, device, supplementId, doseDate, doseTime);
        if (current) { setState(device); setDose(result); }
      } catch (err) { if (current) setError(webPushError(err)); }
      finally { if (current) setLoading(false); }
    })();
    return () => { current = false; };
  }, [token, supplementId, doseDate, doseTime]));
  async function act(action: 'TAKEN' | 'SKIPPED' | 'SNOOZE') {
    if (!token || !state || !dose || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const result = await actOnReminderDose(token, state, dose, action);
      setDose(result);
      setMessage(action === 'SNOOZE' ? '15분 뒤 다시 알려드릴게요.' : result.status === 'TAKEN' ? '복용 완료로 기록했어요.' : '이번 복용을 건너뛴 것으로 기록했어요.');
    } catch (err) { setError(webPushError(err)); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}><View style={styles.rail}>
    {loading ? <ActivityIndicator accessibilityLabel="복용 기록 확인 중" color={colors.active} /> : dose ? <RitualSurface style={styles.card}>
      <Text style={styles.date}>{dose.doseDate.replaceAll('-', '.')} · {dose.doseTime}</Text>
      <Text style={styles.title}>{dose.name}</Text>
      <Text style={styles.body}>{dose.status === 'TAKEN' ? '복용 완료로 기록된 일정이에요.' : dose.status === 'SKIPPED' ? '건너뛴 것으로 기록된 일정이에요.' : dose.active ? '이번 복용을 기록해 주세요.' : '지난 알림이에요. 오늘의 복용에서 현재 일정을 확인해 주세요.'}</Text>
      {dose.nextReminderAt && !message ? <Text style={styles.body}>{new Date(dose.nextReminderAt).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })}에 다시 알려드릴 예정이에요.</Text> : null}
      {dose.active && !dose.status ? <>
        <RitualAction fullWidth label="복용 완료" loading={busy} onPress={() => void act('TAKEN')} />
        {dose.canSnooze ? <RitualAction fullWidth tone="secondary" label="15분 뒤 다시 알림" disabled={busy} onPress={() => void act('SNOOZE')} /> : null}
        <RitualAction fullWidth tone="quiet" label="이번 복용 건너뛰기" disabled={busy} onPress={() => void act('SKIPPED')} />
      </> : null}
    </RitualSurface> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {message ? <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text> : null}
    <RitualAction fullWidth tone="secondary" label="오늘의 복용 보기" disabled={busy} onPress={() => navigation.navigate('MainTabs', { screen: 'Today' })} />
  </View></ScrollView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, content: { padding: 24, paddingBottom: 40 }, rail: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: 20 },
  card: { padding: 24, gap: 18 }, date: { color: colors.muted, fontSize: 14 }, title: { color: colors.ink, fontSize: 24, lineHeight: 34, fontWeight: '600' },
  body: { color: colors.inkSoft, fontSize: 15, lineHeight: 25 }, error: { color: colors.danger, fontSize: 14, lineHeight: 23 }, message: { color: colors.active, fontSize: 14, lineHeight: 23 },
});
