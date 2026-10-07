import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Bell, BellRing, Plus, ShieldCheck } from 'lucide-react-native';
import { apiRequest } from '../api/client';
import type { SupplementDetailResponse, SupplementSummary } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import RitualAction from '../components/RitualAction';
import RitualSurface from '../components/RitualSurface';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { parseDoseTimes } from '../notifications/doseReminderNotifications';
import { connectWebPush, disconnectWebPush, getWebPushConfig, getWebPushState, prepareWebPush, saveWebReminderTimes, sendWebPushTest, webPushError, webPushSupport, type WebPushState, type WebPushConfig, type WebPushPreparation } from '../notifications/webPush';
import { colors, radius } from '../theme';
import { contentRailWidth } from '../utils/responsiveLayout';

type Props = NativeStackScreenProps<RootStackParamList, 'NotificationSettings'>;
type Product = { id: number; name: string; times: string[] };
export default function WebNotificationSettingsScreen({ navigation }: Props) {
  const { token } = useAuth(); const { width } = useWindowDimensions();
  const [config, setConfig] = useState<WebPushConfig | null>(null);
  const [state, setState] = useState<WebPushState | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const prepared = useRef<WebPushPreparation | null>(null); const actionInFlight = useRef(false);
  const support = webPushSupport();
  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError('');
    try {
      const [settings, current, summaries] = await Promise.all([getWebPushConfig(token), getWebPushState(token), apiRequest<SupplementSummary[]>('/api/supplements', {}, token)]);
      setConfig(settings); setState(current);
      const details = await Promise.all(summaries.map(item => apiRequest<SupplementDetailResponse>('/api/supplements/' + item.id, {}, token)));
      setProducts(details.map(item => ({ id: item.id, name: item.displayNameKo || item.productName || '영양제', times: parseDoseTimes(item.confirmedDoseTime) })));
      if (support === 'supported' && settings.enabled) prepared.current = await prepareWebPush();
    } catch (err) { setError(webPushError(err)); }
    finally { setLoading(false); }
  }, [support, token]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function action(work: () => Promise<void>) {
    if (actionInFlight.current) return;
    actionInFlight.current = true; setBusy(true); setError(''); setMessage('');
    try { await work(); } catch (err) { setError(webPushError(err)); }
    finally { actionInFlight.current = false; setBusy(false); }
  }
  function connect() {
    if (!token || !config?.enabled || !prepared.current) return;
    // action invokes work synchronously; permission stays attached to this tap.
    void action(async () => {
      setState(await connectWebPush(token, config.publicKey, prepared.current!));
      setMessage('알림이 연결됐어요. 아래에서 받을 복용 시간을 켜주세요.');
    });
  }
  function toggle(product: Product, time: string, enabled: boolean) {
    if (!token || !state) return;
    void action(async () => {
      const times = new Set(state.reminders.filter(item => item.supplementId === product.id).map(item => item.time));
      if (enabled) times.add(time); else times.delete(time);
      setState(await saveWebReminderTimes(token, state, product.id, [...times]));
    });
  }
  const connected = state?.enabled === true && support === 'supported' && typeof Notification !== 'undefined' && Notification.permission === 'granted';
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <View style={[styles.rail, { maxWidth: contentRailWidth(width) }]}><Text style={styles.title}>복용 알림</Text>
      <Text style={styles.body}>PILL을 닫아도 복용 시간이 되면 이 기기로 알려드려요.</Text>
      {support === 'home-screen-required' ? <RitualSurface style={styles.card} variant="warning">
        <Plus color={colors.active} size={24} /><Text style={styles.cardTitle}>홈 화면에 PILL을 추가해 주세요</Text>
        <Text style={styles.body}>Safari에서 공유 버튼을 누르고 ‘홈 화면에 추가’를 선택하세요. 추가된 PILL 아이콘으로 열면 알림을 켤 수 있어요.</Text>
      </RitualSurface> : support === 'unsupported' ? <RitualSurface style={styles.card} variant="warning">
        <Text style={styles.cardTitle}>이 기기에서 웹 알림을 지원하지 않아요</Text>
        <Text style={styles.body}>아이폰은 iOS 16.4 이상에서 홈 화면에 추가한 PILL로 이용해 주세요.</Text>
      </RitualSurface> : null}
      {loading ? <ActivityIndicator color={colors.active} accessibilityLabel="알림 상태 확인 중" /> : config && !config.enabled ? <RitualSurface style={styles.card}>
        <Text style={styles.cardTitle}>알림 서비스를 준비 중이에요</Text><Text style={styles.body}>연결이 준비되면 이 화면에서 알림을 켤 수 있어요.</Text>
      </RitualSurface> : support === 'supported' && config?.enabled ? <RitualSurface style={styles.card}>
        <ShieldCheck color={colors.active} size={26} /><Text style={styles.cardTitle}>{connected ? '이 기기로 알림을 받을 수 있어요' : '복용 시간을 놓치지 않도록'}</Text>
        <Text style={styles.body}>{connected ? '기기에 설정된 시간대를 기준으로 알려드려요. 다른 기기의 알림 설정에는 영향을 주지 않아요.' : '알림을 허용하고 받을 복용 시간을 선택해 주세요.'}</Text>
        {!connected ? <RitualAction fullWidth label="알림 켜기" icon={<Bell color={colors.primaryText} size={19} />} disabled={!prepared.current} loading={busy} onPress={connect} /> : <>
          <RitualAction fullWidth label="테스트 알림 보내기" icon={<BellRing color={colors.primaryText} size={19} />} loading={busy} onPress={() => void action(async () => { await sendWebPushTest(token!, state!); setMessage('전송 요청을 보냈어요. 잠금 화면에서 알림을 확인해 주세요.'); })} />
          <RitualAction fullWidth label="이 기기 알림 끄기" tone="secondary" disabled={busy} onPress={() => void action(async () => { await disconnectWebPush(token!, state); prepared.current = await prepareWebPush(); setState(null); setMessage('이 기기의 복용 알림을 껐어요.'); })} />
        </>}
      </RitualSurface> : null}
      {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
      {message ? <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text> : null}
      {!loading && !products.length ? <RitualSurface style={styles.card}><Text style={styles.cardTitle}>먼저 영양제를 등록해 주세요</Text><Text style={styles.body}>제품을 등록하고 복용 시간을 저장하면 알림을 설정할 수 있어요.</Text><RitualAction label="내 영양제 보기" onPress={() => navigation.navigate('MainTabs', { screen: 'Supplements' })} /></RitualSurface> : null}
      {products.map(product => <RitualSurface key={product.id} style={styles.card}>
        <Text style={styles.cardTitle}>{product.name}</Text>
        {product.times.length ? product.times.map(time => <View key={time} style={styles.timeRow}>
          <Text style={styles.time}>{time}</Text><Switch accessibilityLabel={product.name + ' ' + time + ' 복용 알림'} value={connected && state!.reminders.some(item => item.supplementId === product.id && item.time === time)} disabled={!connected || busy} onValueChange={enabled => toggle(product, time, enabled)} trackColor={{ false: colors.line, true: colors.active }} />
        </View>) : <Text style={styles.body}>제품 상세에서 복용 시간을 먼저 저장해 주세요.</Text>}
        <RitualAction label="복용 시간 편집" tone="secondary" onPress={() => navigation.navigate('SupplementDetail', { supplementId: product.id })} />
      </RitualSurface>)}
      <Text style={styles.note}>알림은 인터넷 연결이 필요해요. 집중 모드와 기기 알림 설정에 따라 소리나 표시가 달라질 수 있어요.</Text>
    </View>
  </ScrollView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, content: { padding: 20, paddingBottom: 44 }, rail: { alignSelf: 'center', width: '100%', gap: 16 },
  kicker: { fontSize: 10, fontWeight: '600', letterSpacing: 1.6, color: colors.active }, title: { fontSize: 28, fontWeight: '600', color: colors.ink },
  card: { padding: 22, gap: 14, borderRadius: radius.xl }, cardTitle: { fontSize: 18, fontWeight: '600', lineHeight: 27, color: colors.ink },
  body: { color: colors.muted, fontSize: 14, lineHeight: 23 }, timeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 52 },
  time: { fontSize: 18, fontWeight: '700', color: colors.ink }, error: { color: colors.danger, fontSize: 14, lineHeight: 22 },
  message: { color: colors.active, fontSize: 14, lineHeight: 22 }, note: { color: colors.muted, fontSize: 12, lineHeight: 20 },
});
