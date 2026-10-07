import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { Bell, ChevronRight, Clock3, Plus } from 'lucide-react-native';
import { apiRequest } from '../api/client';
import type { HomeResponse, TodayDose } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import AddSupplementSheet from '../components/AddSupplementSheet';
import DoseCheckRow from '../components/DoseCheckRow';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme';
import { applyTodayDoseStatus, clearTodayDoseStatus } from '../utils/todayDoseDisplay';

function timeLabel(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) return '시간 미설정';
  const [hour, minute] = value.split(':').map(Number);
  return `${hour < 12 ? '오전' : '오후'} ${hour % 12 || 12}:${String(minute).padStart(2, '0')}`;
}

export default function TodayScreen() {
  const { token } = useAuth();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [home, setHome] = useState<HomeResponse>({ supplements: [], todayDoses: [] });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const posting = useRef(false);
  const requestVersion = useRef(0);
  const doses = useMemo(() => [...home.todayDoses].sort((a, b) =>
    (a.confirmedTime || '99:99').localeCompare(b.confirmedTime || '99:99')
    || a.supplementId - b.supplementId), [home.todayDoses]);
  const groups = useMemo(() => {
    const byTime = new Map<string, TodayDose[]>();
    doses.forEach(dose => {
      const time = dose.confirmedTime || '';
      byTime.set(time, [...(byTime.get(time) || []), dose]);
    });
    return Array.from(byTime);
  }, [doses]);
  const done = doses.filter(dose => dose.status === 'TAKEN').length;
  const remaining = doses.length - done;
  const percent = doses.length ? Math.round(done / doses.length * 100) : 0;

  const loadHome = useCallback(async () => {
    if (!token || posting.current) return;
    const version = ++requestVersion.current;
    setError('');
    setIsLoading(true);
    try {
      const response = await apiRequest<HomeResponse>('/api/home', {}, token);
      if (version === requestVersion.current) setHome(response);
    } catch (err) {
      if (version === requestVersion.current) setError(err instanceof Error ? err.message : '복용 목록을 불러오지 못했어요.');
    } finally {
      if (version === requestVersion.current) setIsLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { void loadHome(); }, [loadHome]));

  async function toggleDose(dose: TodayDose) {
    if (!token || posting.current || isLoading) return;
    posting.current = true;
    ++requestVersion.current;
    const previous = home;
    const clear = dose.status === 'TAKEN';
    setHome(current => ({ ...current, todayDoses: clear
      ? clearTodayDoseStatus(current.todayDoses, dose)
      : applyTodayDoseStatus(current.todayDoses, dose, 'TAKEN') }));
    setIsPosting(true);
    setError('');
    setSavedMessage('');
    try {
      const query = clear && dose.confirmedTime ? '?doseTime=' + encodeURIComponent(dose.confirmedTime) : '';
      await apiRequest<void>('/api/supplements/' + dose.supplementId + '/dose-logs' + query, {
        method: clear ? 'DELETE' : 'POST',
        ...(clear ? {} : { body: JSON.stringify({ status: 'TAKEN', memo: '', doseTime: dose.confirmedTime }) }),
      }, token);
      setSavedMessage(clear ? '완료 기록을 취소했어요.' : '복용 기록을 저장했어요.');
    } catch (err) {
      setHome(previous);
      setError(err instanceof Error ? err.message : '기록을 저장하지 못했어요. 다시 체크해 주세요.');
    } finally {
      posting.current = false;
      setIsPosting(false);
    }
  }

  function openAdd(destination: 'ImageInput' | 'ManualSupplement') {
    setShowAdd(false);
    navigation.navigate(destination);
  }

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => void loadHome()} tintColor={colors.active} />}>
        <View style={styles.rail}>
          <View style={styles.topbar}>
            <Text style={styles.wordmark}>PILL</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="알림 설정" onPress={() => navigation.navigate('NotificationSettings')} style={styles.iconButton}>
              <Bell size={21} strokeWidth={2.2} color={colors.active} />
            </Pressable>
          </View>
          <View style={styles.hero}>
            <Text style={styles.heroDate}>{new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date())}</Text>
            <Text style={styles.heroTitle}>오늘의 복용</Text>
            <View style={styles.progressCard}>
              <View style={styles.progressTop}>
                <View>
                  <Text style={styles.progressCaption}>오늘의 달성률</Text>
                  <Text style={styles.percent}>{doses.length ? `${percent}%` : '—'}</Text>
                </View>
                <View style={styles.remainingPill}>
                  <Text style={styles.remainingText}>{isLoading && !doses.length ? '불러오는 중' : doses.length ? remaining ? `${remaining}회 남았어요` : '오늘 모두 완료했어요' : '예정된 복용 없음'}</Text>
                </View>
              </View>
              <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${percent}%` }]} /></View>
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={() => setShowAdd(true)} style={styles.addButton}>
              <Plus size={18} color={colors.white} strokeWidth={2.8} />
              <Text style={styles.addButtonText}>영양제 추가</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => navigation.navigate('MainTabs', { screen: 'Supplements' })} style={styles.collectionButton}>
              <Text style={styles.collectionButtonText}>내 영양제</Text>
              <ChevronRight size={17} color={colors.active} />
            </Pressable>
          </View>

          {error ? <View style={styles.error}>
            <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>
            <Pressable accessibilityRole="button" disabled={isPosting} onPress={() => void loadHome()} style={styles.retry}><Text style={styles.link}>다시 불러오기</Text></Pressable>
          </View> : null}

          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.sectionTitle}>오늘의 일정</Text>
              <Text style={styles.sectionSubtitle}>시간에 맞춰 하나씩 기록해요</Text>
            </View>
            <Text style={styles.sectionCount}>{doses.length ? `${done}/${doses.length} 완료` : ''}</Text>
          </View>

          {groups.length ? groups.map(([time, timeDoses]) => (
            <View key={time || 'unset'} style={styles.timeGroup}>
              <View style={styles.timeHeading}>
                <Clock3 size={17} color={colors.active} />
                <Text style={styles.timeText}>{timeLabel(time)}</Text>
                <Text style={styles.timeCount}>{timeDoses.length}개</Text>
              </View>
              <View style={styles.doseGroup}>
                {timeDoses.map((dose, index) => (
                <View key={dose.supplementId + '-' + (dose.confirmedTime ?? 'default')} style={index ? styles.doseDivider : undefined}>
                  <DoseCheckRow dose={dose} showTime={false} disabled={isPosting || isLoading}
                    onClear={() => void toggleDose(dose)} onTaken={() => void toggleDose(dose)}
                    onOpen={() => navigation.navigate('SupplementDetail', { supplementId: dose.supplementId })} />
                </View>
                ))}
              </View>
            </View>
          )) : !isLoading && !error ? <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{home.supplements.length ? '오늘 예정된 복용이 없어요' : '첫 영양제를 등록해 보세요'}</Text>
            <Text style={styles.emptyBody}>{home.supplements.length ? '등록한 영양제에서 복용 시간을 확인할 수 있어요.' : '제품을 등록하면 오늘의 복용 일정이 여기에 보여요.'}</Text>
          </View> : null}

          <View style={styles.feedback} accessibilityLiveRegion="polite">
            {isPosting ? <ActivityIndicator size="small" color={colors.active} /> : null}
            <Text style={styles.feedbackText}>{isPosting ? '저장 중…' : savedMessage}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => navigation.navigate('DoseHistory')} style={styles.history}>
            <Text style={styles.historyText}>지난 복용 기록</Text>
            <ChevronRight size={17} color={colors.active} />
          </Pressable>
        </View>
      </ScrollView>
      <AddSupplementSheet visible={showAdd} onClose={() => setShowAdd(false)}
        onScan={() => openAdd('ImageInput')} onManual={() => openAdd('ManualSupplement')} />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 44 },
  rail: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  wordmark: { color: colors.active, fontSize: 19, fontWeight: '900', letterSpacing: 2.5 },
  iconButton: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  hero: { borderRadius: 26, backgroundColor: '#253F9A', padding: 18, marginBottom: 16 },
  heroDate: { color: '#D5DEFB', fontSize: 13, fontWeight: '700' },
  heroTitle: { color: colors.white, fontSize: 25, fontWeight: '900', marginTop: 5, marginBottom: 17 },
  progressCard: { backgroundColor: colors.surface, borderRadius: 19, paddingHorizontal: 16, paddingVertical: 13 },
  progressTop: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  progressCaption: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  percent: { color: colors.ink, fontSize: 39, lineHeight: 45, fontWeight: '900', fontVariant: ['tabular-nums'] },
  remainingPill: { backgroundColor: colors.activeSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 4 },
  remainingText: { color: colors.active, fontSize: 12, fontWeight: '800' },
  progressTrack: { backgroundColor: colors.surfaceMuted, height: 7, borderRadius: 8, marginTop: 13, overflow: 'hidden' },
  progressFill: { backgroundColor: colors.active, height: 7, borderRadius: 8 },
  actions: { flexDirection: 'row', gap: 10, marginBottom: 30 },
  addButton: { backgroundColor: colors.active, flex: 1, minHeight: 52, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  addButtonText: { color: colors.white, fontSize: 14, fontWeight: '900' },
  collectionButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, minHeight: 52, paddingHorizontal: 15, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 2 },
  collectionButtonText: { color: colors.active, fontSize: 13, fontWeight: '800' },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18 },
  sectionTitle: { color: colors.ink, fontSize: 23, fontWeight: '900', letterSpacing: -0.4 },
  sectionSubtitle: { color: colors.muted, fontSize: 12, marginTop: 4 },
  sectionCount: { color: colors.muted, fontSize: 12, fontWeight: '800', marginBottom: 3 },
  timeGroup: { gap: 10, marginBottom: 22 },
  timeHeading: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 2 },
  timeText: { color: colors.active, fontSize: 14, fontWeight: '900' },
  timeCount: { color: colors.faint, fontSize: 11, fontWeight: '800', marginLeft: 'auto' },
  doseGroup: { backgroundColor: colors.surface, borderRadius: 20, borderColor: colors.line, borderWidth: 1, overflow: 'hidden' },
  doseDivider: { borderTopColor: colors.line, borderTopWidth: 1 },
  empty: { padding: 22, gap: 10, alignItems: 'flex-start', backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 20 },
  emptyTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  emptyBody: { color: colors.muted, fontSize: 13, lineHeight: 21, marginBottom: 7 },
  feedback: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 30 },
  feedbackText: { color: colors.muted, fontSize: 12 },
  history: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  historyText: { color: colors.active, fontSize: 13, fontWeight: '800' },
  error: { backgroundColor: colors.dangerSoft, padding: 15, marginBottom: 20, borderRadius: 14 },
  errorText: { color: colors.ink, fontSize: 13, lineHeight: 20 },
  retry: { minHeight: 40, justifyContent: 'center', alignSelf: 'flex-start' },
  link: { color: colors.active, fontSize: 13, textDecorationLine: 'underline' },
});
