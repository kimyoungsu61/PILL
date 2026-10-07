import { useCallback, useState } from 'react';
import WebNotificationSettingsScreen from './WebNotificationSettingsScreen';
import { Platform, ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Bell, BellOff, BellRing, ChevronRight, Clock3, RefreshCw, ShieldCheck } from 'lucide-react-native';
import { apiRequest } from '../api/client';
import type { SupplementDetailResponse, SupplementSummary } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import RitualAction from '../components/RitualAction';
import RitualSurface from '../components/RitualSurface';
import SupplementThumb from '../components/SupplementThumb';
import type { RootStackParamList } from '../navigation/AppNavigator';
import {
  cancelSupplementReminders,
  clearAllDoseReminders,
  getDoseReminderPermissionStatus,
  parseDoseTimes,
  requestDoseReminderPermission,
  scheduleSupplementReminders,
  scheduledDoseReminderTimes,
  type DoseReminderPermissionStatus,
} from '../notifications/doseReminderNotifications';
import { colors, radius, spacing, type } from '../theme';
import { contentRailWidth } from '../utils/responsiveLayout';

type Props = NativeStackScreenProps<RootStackParamList, 'NotificationSettings'>;

type ReminderSupplement = SupplementSummary & {
  times: string[];
};

type ScheduledDose = {
  dayOffset: number;
  item: ReminderSupplement;
  minutes: number;
  time: string;
};

export default function NotificationSettingsScreen(props: Props) {
  return Platform.OS === 'web' ? <WebNotificationSettingsScreen {...props} /> : <NativeNotificationSettingsScreen {...props} />;
}

function NativeNotificationSettingsScreen({ navigation }: Props) {
  const { token } = useAuth();
  const { width } = useWindowDimensions();
  const [supplements, setSupplements] = useState<ReminderSupplement[]>([]);
  const [scheduledTimes, setScheduledTimes] = useState<Map<number, Set<string>>>(new Map());
  const [permission, setPermission] = useState<DoseReminderPermissionStatus | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      const [[permissionStatus, ids], summaries] = await Promise.all([
        Promise.all([
          getDoseReminderPermissionStatus(),
          scheduledDoseReminderTimes(),
        ]),
        apiRequest<SupplementSummary[]>('/api/supplements', {}, token),
      ]);
      setPermission(permissionStatus);
      setScheduledTimes(ids);
      const details = await Promise.all(summaries.map(async (summary) => {
        const detail = await apiRequest<SupplementDetailResponse>(`/api/supplements/${summary.id}`, {}, token);
        return { summary, detail };
      }));
      setSupplements(details.map(({ summary, detail }) => ({
        ...summary,
        displayNameKo: detail.displayNameKo || summary.displayNameKo,
        productName: detail.productName || summary.productName,
        times: parseDoseTimes(detail.confirmedDoseTime),
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : '알림 설정을 불러오지 못했어요.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  async function enablePermission() {
    setIsRequestingPermission(true);
    setError('');
    try {
      const status = await requestDoseReminderPermission();
      setPermission(status);
      if (status !== 'granted') {
        setError('기기 알림이 허용되지 않았어요. 태블릿 설정에서 PILL 알림을 켜주세요.');
      }
    } catch {
      setError('알림 권한을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsRequestingPermission(false);
    }
  }

  async function toggleReminder(item: ReminderSupplement, time: string, enabled: boolean) {
    setBusyId(item.id);
    setError('');
    try {
      const nextTimes = new Set(activeReminderTimes(item, scheduledTimes));
      if (enabled) {
        nextTimes.add(time);
      } else {
        nextTimes.delete(time);
      }
      if (nextTimes.size) {
        const result = await scheduleSupplementReminders({
          supplementId: item.id,
          productName: item.productName,
          displayNameKo: item.displayNameKo,
          times: Array.from(nextTimes),
        });
        setPermission(result.permissionStatus as DoseReminderPermissionStatus);
        if (result.permissionStatus !== 'granted') {
          setError('기기 알림이 허용되지 않아 예약하지 못했어요. 먼저 알림 권한을 켜주세요.');
          return;
        }
      } else {
        await cancelSupplementReminders(item.id);
      }
      setScheduledTimes((current) => {
        const next = new Map(current);
        if (nextTimes.size) {
          next.set(item.id, nextTimes);
        } else {
          next.delete(item.id);
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '알림 설정을 저장하지 못했어요.');
    } finally {
      setBusyId(null);
    }
  }

  function confirmClearAll() {
    Alert.alert('모든 복용 알림을 끌까요?', '영양제와 복용 시간은 그대로 유지되고, 이 기기에 예약된 알림만 취소됩니다.', [
      { text: '취소', style: 'cancel' },
      { text: '모두 끄기', style: 'destructive', onPress: () => void clearAll() },
    ]);
  }

  async function clearAll() {
    setIsClearing(true);
    setError('');
    try {
      await clearAllDoseReminders();
      setScheduledTimes(new Map());
    } catch {
      setError('일부 알림을 끄지 못했어요. 다시 시도해 주세요.');
    } finally {
      setIsClearing(false);
    }
  }

  const granted = permission === 'granted';
  const unavailable = permission === 'unavailable';
  const permissionCopy = unavailable
    ? '현재 Expo Go에서는 Android 알림 모듈을 사용할 수 없어요. 개발 빌드에서 실제 복용 알림이 활성화됩니다.'
    : '복용 시간에 알림을 받으려면 기기 알림 권한을 허용해 주세요.';
  const scheduledDoses = supplements.flatMap((item) => (
    item.times
      .filter((time) => activeReminderTimes(item, scheduledTimes).has(time))
      .map((time) => ({ item, minutes: timeToMinutes(time), time }))
  ));
  const nextDose = findNextDose(scheduledDoses);

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <View style={[styles.rail, { maxWidth: contentRailWidth(width) }]}>
        <View style={styles.header}>
          <Text style={styles.kicker}>REMINDERS</Text>
          <View style={styles.titleRow}>
            <Text style={styles.title}>알림 설정</Text>
            {granted ? (
              <View accessibilityLabel="기기 알림 켜짐" style={styles.permissionBadge}>
                <View style={styles.permissionDot} />
                <Text style={styles.permissionBadgeText}>기기 알림 켜짐</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.subtitle}>제품은 하나로 묶고, 오전·오후·저녁 알림은 시간별로 따로 켜거나 끌 수 있어요.</Text>
        </View>

        {permission === null ? (
          <RitualSurface accessibilityLabel="알림 설정 확인 중" style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View>
                <Text style={styles.summaryKicker}>TODAY</Text>
                <Text style={styles.summaryTitle}>오늘의 알림</Text>
              </View>
              <View style={styles.summaryIcon}>
                <BellRing color={colors.primaryText} size={21} strokeWidth={2.5} />
              </View>
            </View>
            <View style={styles.summaryLoading}>
              <ActivityIndicator color={colors.active} size="small" />
              <Text style={styles.summaryLoadingText}>기기 알림 상태를 확인하고 있어요.</Text>
            </View>
          </RitualSurface>
        ) : !granted ? (
          <RitualSurface style={styles.permissionCard} variant="warning">
            <View style={styles.permissionIcon}>
              <ShieldCheck color={colors.warning} size={23} strokeWidth={2.5} />
            </View>
            <View style={styles.permissionCopy}>
              <Text style={styles.permissionTitle}>{unavailable ? '개발 빌드가 필요해요' : '기기 알림 권한이 필요해요'}</Text>
              <Text style={styles.permissionBody}>{permissionCopy}</Text>
            </View>
            {!unavailable ? (
              <RitualAction
                fullWidth
                icon={<Bell color={colors.primaryText} size={18} strokeWidth={2.5} />}
                label="알림 권한 켜기"
                loading={isRequestingPermission}
                onPress={() => void enablePermission()}
              />
            ) : null}
          </RitualSurface>
        ) : (
          <RitualSurface accessibilityLabel="오늘의 알림 요약" style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View>
                <Text style={styles.summaryKicker}>TODAY</Text>
                <Text style={styles.summaryTitle}>오늘의 알림</Text>
              </View>
              <View style={styles.summaryIcon}>
                <BellRing color={colors.primaryText} size={21} strokeWidth={2.5} />
              </View>
            </View>

            {isLoading ? (
              <View style={styles.summaryLoading}>
                <ActivityIndicator color={colors.active} size="small" />
                <Text style={styles.summaryLoadingText}>오늘의 복용 알림을 불러오고 있어요.</Text>
              </View>
            ) : scheduledDoses.length ? (
              <>
                <Text style={styles.summaryCount}>오늘 {scheduledDoses.length}개의 복용 알림이 예정되어 있어요.</Text>
                {nextDose ? (
                  <Pressable
                    accessibilityHint="다음 알림 제품의 상세 화면으로 이동합니다"
                    accessibilityRole="button"
                    onPress={() => navigation.navigate('SupplementDetail', { supplementId: nextDose.item.id })}
                    style={({ pressed }) => [styles.nextDoseRow, pressed && styles.pressed]}
                  >
                    <View style={styles.nextDoseCopy}>
                      <Text style={styles.nextDoseLabel}>다음 알림 · {nextDose.dayOffset ? '내일' : '오늘'}</Text>
                      <Text numberOfLines={1} style={styles.nextDoseValue}>
                        {formatKoreanTime(nextDose.time)} · {nextDose.item.displayNameKo || nextDose.item.productName || '영양제'}
                      </Text>
                    </View>
                    <View style={styles.scheduleLink}>
                      <Text style={styles.scheduleLinkText}>일정 보기</Text>
                      <ChevronRight color={colors.active} size={16} strokeWidth={2.5} />
                    </View>
                  </Pressable>
                ) : null}
              </>
            ) : (
              <View style={styles.summaryEmpty}>
                <Text style={styles.summaryEmptyTitle}>오늘 예정된 알림이 없어요</Text>
                <Text style={styles.summaryEmptyBody}>아래에서 제품별 복용 알림을 켜보세요.</Text>
              </View>
            )}
          </RitualSurface>
        )}

        {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionKicker}>MY ROUTINES</Text>
            <Text style={styles.sectionTitle}>제품별 복용 알림</Text>
          </View>
          <Pressable accessibilityLabel="알림 목록 새로고침" accessibilityRole="button" onPress={() => void load()} style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}>
            <RefreshCw color={colors.active} size={17} strokeWidth={2.5} />
          </Pressable>
        </View>

        {isLoading ? <ActivityIndicator color={colors.active} style={styles.loading} /> : null}
        {!isLoading && !supplements.length ? (
          <RitualSurface style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>아직 저장된 영양제가 없어요</Text>
            <Text style={styles.emptyBody}>영양제를 등록하면 이곳에서 복용 알림을 관리할 수 있어요.</Text>
          </RitualSurface>
        ) : null}
        {supplements.map((item) => {
          const enabledTimes = activeReminderTimes(item, scheduledTimes);
          const enabled = enabledTimes.size > 0;
          const name = item.displayNameKo || item.productName || '영양제';
          return (
            <RitualSurface key={item.id} padded={false} style={styles.reminderCard} variant={enabled ? 'active' : 'default'}>
              <View style={styles.reminderTop}>
                <SupplementThumb imageUri={item.imageUri} name={name} size={52} />
                <View style={styles.reminderCopy}>
                  <Text numberOfLines={1} style={styles.reminderName}>{name}</Text>
                  <Text style={styles.reminderStatus}>{enabledTimes.size}/{item.times.length}개 시간 알림 켜짐</Text>
                </View>
              </View>
              <View style={styles.timeReminderList}>
                {item.times.map((time) => {
                  const timeEnabled = enabledTimes.has(time);
                  return (
                    <View key={time} style={styles.timeReminderRow}>
                      <View style={styles.timeReminderIcon}>
                        <Clock3 color={timeEnabled ? colors.completed : colors.muted} size={17} strokeWidth={2.5} />
                      </View>
                      <View style={styles.timeReminderCopy}>
                        <Text style={styles.timeReminderLabel}>{formatKoreanTime(time)}</Text>
                        <Text style={styles.timeReminderMeta}>매일 · 개별 알림</Text>
                      </View>
                      <Switch
                        accessibilityLabel={`${name} ${formatKoreanTime(time)} 알림 ${timeEnabled ? '끄기' : '켜기'}`}
                        disabled={unavailable || busyId === item.id}
                        onValueChange={(value) => void toggleReminder(item, time, value)}
                        thumbColor={timeEnabled ? colors.cream : colors.surfaceMuted}
                        trackColor={{ false: colors.line, true: colors.completed }}
                        value={timeEnabled}
                      />
                    </View>
                  );
                })}
              </View>
              <Pressable accessibilityRole="button" onPress={() => navigation.navigate('SupplementDetail', { supplementId: item.id })} style={({ pressed }) => [styles.editLink, pressed && styles.pressed]}>
                <Text style={styles.editLinkText}>복용 시간 편집</Text>
                <ChevronRight color={colors.active} size={16} strokeWidth={2.5} />
              </Pressable>
            </RitualSurface>
          );
        })}

        {scheduledDoses.length ? (
          <RitualAction
            fullWidth
            icon={<BellOff color={colors.danger} size={18} strokeWidth={2.5} />}
            label="이 기기의 모든 알림 끄기"
            loading={isClearing}
            onPress={confirmClearAll}
            tone="danger"
          />
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  content: { padding: spacing.xl, paddingBottom: 112 },
  rail: { alignSelf: 'center', gap: spacing.lg, width: '100%' },
  header: { gap: spacing.xs },
  kicker: { color: colors.active, fontSize: 11, fontWeight: '900', letterSpacing: 2.2 },
  titleRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'space-between' },
  title: { ...type.hero, fontSize: 30, lineHeight: 38 },
  subtitle: { ...type.body, color: colors.inkSoft },
  permissionBadge: { alignItems: 'center', backgroundColor: colors.completedSoft, borderColor: colors.completed, borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  permissionDot: { backgroundColor: colors.completed, borderRadius: 999, height: 7, width: 7 },
  permissionBadgeText: { color: colors.completed, fontSize: 11, fontWeight: '900' },
  permissionCard: { alignItems: 'flex-start', gap: spacing.md },
  permissionIcon: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 999, height: 48, justifyContent: 'center', width: 48 },
  permissionCopy: { gap: spacing.xs },
  permissionTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  permissionBody: { ...type.body, color: colors.inkSoft },
  summaryCard: { gap: spacing.lg },
  summaryHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  summaryKicker: { color: colors.active, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  summaryTitle: { color: colors.ink, fontSize: 18, fontWeight: '900', marginTop: spacing.xs },
  summaryIcon: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.md, height: 42, justifyContent: 'center', width: 42 },
  summaryLoading: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 48 },
  summaryLoadingText: { color: colors.muted, fontSize: 13, fontWeight: '800' },
  summaryCount: { color: colors.inkSoft, fontSize: 14, fontWeight: '800', lineHeight: 21 },
  nextDoseRow: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderColor: colors.line, borderRadius: radius.lg, borderWidth: 1, flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between', minHeight: 74, padding: spacing.md },
  nextDoseCopy: { flex: 1, gap: spacing.xs, minWidth: 0 },
  nextDoseLabel: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  nextDoseValue: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  scheduleLink: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  scheduleLinkText: { color: colors.active, fontSize: 12, fontWeight: '900' },
  summaryEmpty: { gap: spacing.xs },
  summaryEmptyTitle: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  summaryEmptyBody: { ...type.body, color: colors.muted },
  error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  sectionKicker: { color: colors.active, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  sectionTitle: { ...type.section, marginTop: spacing.xs },
  refreshButton: { alignItems: 'center', backgroundColor: colors.activeSoft, borderRadius: radius.md, height: 42, justifyContent: 'center', width: 42 },
  loading: { marginVertical: spacing.xxl },
  emptyCard: { gap: spacing.xs },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  emptyBody: { ...type.body, color: colors.inkSoft },
  reminderCard: { overflow: 'hidden' },
  reminderTop: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, padding: spacing.lg },
  reminderCopy: { flex: 1, gap: spacing.xs, minWidth: 0 },
  reminderName: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  reminderStatus: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  timeReminderList: { borderTopColor: colors.line, borderTopWidth: 1 },
  timeReminderRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 68, paddingHorizontal: spacing.lg },
  timeReminderIcon: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: radius.md, height: 38, justifyContent: 'center', width: 38 },
  timeReminderCopy: { flex: 1, gap: 2 },
  timeReminderLabel: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  timeReminderMeta: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  editLink: { alignItems: 'center', borderTopColor: colors.line, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 48, paddingHorizontal: spacing.lg },
  editLinkText: { color: colors.active, fontSize: 13, fontWeight: '900' },
  pressed: { opacity: 0.75 },
});

function activeReminderTimes(
  item: ReminderSupplement,
  schedules: Map<number, Set<string>>
) {
  const storedTimes = schedules.get(item.id) ?? new Set<string>();
  return storedTimes.has('*')
    ? new Set(item.times)
    : new Set(item.times.filter((time) => storedTimes.has(time)));
}

function timeToMinutes(time: string) {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function findNextDose(doses: Array<Omit<ScheduledDose, 'dayOffset'>>): ScheduledDose | null {
  if (!doses.length) {
    return null;
  }
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return doses
    .map((dose) => ({
      ...dose,
      dayOffset: dose.minutes < currentMinutes ? 1 : 0,
    }))
    .sort((left, right) => (
      (left.dayOffset * 24 * 60 + left.minutes) - (right.dayOffset * 24 * 60 + right.minutes)
    ))[0];
}

function formatKoreanTime(time: string) {
  const [hour, minute] = time.split(':').map(Number);
  const period = hour < 12 ? '오전' : '오후';
  const displayHour = hour % 12 || 12;
  return `${period} ${displayHour}:${String(minute).padStart(2, '0')}`;
}
