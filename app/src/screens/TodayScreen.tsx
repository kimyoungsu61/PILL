import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { Bell, ChevronRight, Plus } from 'lucide-react-native';
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
              <Bell size={22} strokeWidth={1.8} color={colors.inkSoft} />
            </Pressable>
          </View>
          <View style={styles.heading}>
            <View style={styles.headingCopy}>
              <Text style={styles.heroDate}>{new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date())}</Text>
              <Text style={styles.heroTitle}>오늘의 복용</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="영양제 추가" onPress={() => setShowAdd(true)} style={styles.addButton}>
              <Plus size={18} color={colors.active} strokeWidth={2} />
              <Text style={styles.addButtonText}>추가</Text>
            </Pressable>
          </View>

          <View style={styles.progressCard}>
            <View style={styles.progressTop}>
              <View>
                <Text style={styles.progressCaption}>오늘의 기록</Text>
                <Text style={styles.progressValue}>{done}<Text style={styles.progressTotal}> / {doses.length}회</Text></Text>
              </View>
              <Text style={styles.remainingText}>{isLoading && !doses.length ? '불러오는 중' : doses.length ? remaining ? `${remaining}회 남았어요` : '모두 기록했어요' : '예정된 복용 없음'}</Text>
            </View>
            <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${percent}%` }]} /></View>
          </View>

          {error ? <View style={styles.error}>
            <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>
            <Pressable accessibilityRole="button" disabled={isPosting} onPress={() => void loadHome()} style={styles.retry}><Text style={styles.link}>다시 불러오기</Text></Pressable>
          </View> : null}

          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>복용 일정</Text>
            <Pressable accessibilityRole="button" onPress={() => navigation.navigate('MainTabs', { screen: 'Supplements' })} style={styles.collectionButton}>
              <Text style={styles.collectionButtonText}>내 영양제</Text>
              <ChevronRight size={15} color={colors.muted} />
            </Pressable>
          </View>

          {groups.length ? groups.map(([time, timeDoses]) => (
            <View key={time || 'unset'} style={styles.timeGroup}>
              <View style={styles.timeHeading}>
                <View style={[styles.timeDot, timeDoses.every(dose => dose.status === 'TAKEN') && styles.timeDotDone]} />
                <Text style={styles.timeText}>{timeLabel(time)}</Text>
                <View style={styles.timeLine} />
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
            <Text style={styles.emptyTitle}>{home.supplements.length ? '오늘 예정된 복용이 없어요' : '복용할 영양제를 추가해 주세요'}</Text>
            <Text style={styles.emptyBody}>{home.supplements.length ? '내 영양제에서 복용 시간을 확인할 수 있어요.' : '라벨을 촬영하거나 직접 입력하면 복용 일정을 정리할 수 있어요.'}</Text>
          </View> : null}

          <View style={styles.feedback} accessibilityLiveRegion="polite">
            {isPosting ? <ActivityIndicator size="small" color={colors.active} /> : null}
            <Text style={styles.feedbackText}>{isPosting ? '저장 중…' : savedMessage}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => navigation.navigate('DoseHistory')} style={styles.history}>
            <Text style={styles.historyText}>지난 복용 기록</Text>
            <ChevronRight size={17} color={colors.muted} />
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
  content: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 32 },
  rail: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  wordmark: { color: colors.active, fontSize: 20, fontWeight: '700', letterSpacing: 1.2 },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 24 },
  headingCopy: { flex: 1, minWidth: 0 },
  heroDate: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  heroTitle: { color: colors.ink, fontSize: 30, lineHeight: 40, fontWeight: '700', letterSpacing: -0.8, marginTop: 4 },
  addButton: { minHeight: 48, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.activeSoft, flexDirection: 'row', alignItems: 'center', gap: 5 },
  addButtonText: { color: colors.active, fontSize: 13, fontWeight: '600' },
  progressCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, marginBottom: 26 },
  progressTop: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  progressCaption: { color: colors.muted, fontSize: 12, marginBottom: 4 },
  progressValue: { color: colors.ink, fontSize: 32, lineHeight: 40, fontWeight: '600', fontVariant: ['tabular-nums'], letterSpacing: -1 },
  progressTotal: { color: colors.muted, fontSize: 16, fontWeight: '400', letterSpacing: 0 },
  remainingText: { color: colors.inkSoft, fontSize: 12, lineHeight: 20, marginBottom: 6 },
  progressTrack: { backgroundColor: colors.line, height: 4, borderRadius: 4, marginTop: 16, overflow: 'hidden' },
  progressFill: { backgroundColor: colors.active, height: 4, borderRadius: 4 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '600', letterSpacing: -0.3 },
  collectionButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 1 },
  collectionButtonText: { color: colors.muted, fontSize: 12, fontWeight: '500' },
  timeGroup: { marginBottom: 22 },
  timeHeading: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 12 },
  timeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.active },
  timeDotDone: { backgroundColor: colors.completed },
  timeText: { color: colors.inkSoft, fontSize: 13, fontWeight: '600' },
  timeLine: { height: 1, flex: 1, backgroundColor: colors.line, marginHorizontal: 3 },
  timeCount: { color: colors.muted, fontSize: 11 },
  doseGroup: { backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden' },
  doseDivider: { borderTopColor: colors.line, borderTopWidth: StyleSheet.hairlineWidth, marginHorizontal: 0 },
  empty: { padding: 22, gap: 8, backgroundColor: colors.surface, borderRadius: 16 },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: '600', lineHeight: 24 },
  emptyBody: { color: colors.muted, fontSize: 13, lineHeight: 22 },
  feedback: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 20 },
  feedbackText: { color: colors.muted, fontSize: 12 },
  history: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, borderRadius: 14, backgroundColor: colors.surface },
  historyText: { color: colors.inkSoft, fontSize: 14, fontWeight: '500' },
  error: { backgroundColor: colors.dangerSoft, padding: 16, marginBottom: 20, borderRadius: 12 },
  errorText: { color: colors.ink, fontSize: 13, lineHeight: 20 },
  retry: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  link: { color: colors.active, fontSize: 13, textDecorationLine: 'underline' },
});
