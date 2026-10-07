import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CalendarDays, CheckCircle2, ChevronRight, History, RefreshCw, XCircle } from 'lucide-react-native';
import { apiRequest } from '../api/client';
import type { DoseHistoryEntry, DoseHistoryResponse } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import RitualSurface from '../components/RitualSurface';
import SupplementThumb from '../components/SupplementThumb';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { colors, radius, spacing, type } from '../theme';
import { contentRailWidth } from '../utils/responsiveLayout';
import {
  formatDoseHistoryDate,
  formatDoseHistoryTime,
  formatHistoryRange,
  groupDoseHistory,
} from './DoseHistoryScreen.helpers';

type Props = NativeStackScreenProps<RootStackParamList, 'DoseHistory'>;
type RangeDays = 7 | 30 | 90;

const rangeOptions: Array<{ days: RangeDays; label: string }> = [
  { days: 7, label: '7일' },
  { days: 30, label: '30일' },
  { days: 90, label: '90일' },
];

const emptyHistory: DoseHistoryResponse = {
  from: '',
  to: '',
  summary: { total: 0, taken: 0, skipped: 0, missed: 0, completionRate: 0 },
  entries: [],
};

export default function DoseHistoryScreen({ navigation }: Props) {
  const { token } = useAuth();
  const { width } = useWindowDimensions();
  const [days, setDays] = useState<RangeDays>(30);
  const [history, setHistory] = useState<DoseHistoryResponse>(emptyHistory);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const groups = useMemo(() => groupDoseHistory(history.entries), [history.entries]);

  const load = useCallback(async () => {
    if (!token) {
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      const response = await apiRequest<DoseHistoryResponse>(`/api/dose-history?days=${days}`, {}, token);
      setHistory(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : '복용 기록을 불러오지 못했어요.');
    } finally {
      setIsLoading(false);
    }
  }, [days, token]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <View style={[styles.rail, { maxWidth: contentRailWidth(width) }]}>
        <View style={styles.header}>
          <Text style={styles.kicker}>DOSE HISTORY</Text>
          <Text style={styles.title}>복용 기록</Text>
          <Text style={styles.subtitle}>예정 시간이 지났는데 체크하지 않은 회차도 미복용으로 자동 집계해요.</Text>
        </View>

        <View accessibilityLabel="조회 기간" style={styles.rangeRow}>
          {rangeOptions.map((option) => {
            const selected = option.days === days;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={option.days}
                onPress={() => setDays(option.days)}
                style={({ pressed }) => [
                  styles.rangeButton,
                  selected && styles.rangeButtonSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.rangeText, selected && styles.rangeTextSelected]}>{option.label}</Text>
              </Pressable>
            );
          })}
          <Pressable
            accessibilityLabel="복용 기록 새로고침"
            accessibilityRole="button"
            onPress={() => void load()}
            style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}
          >
            <RefreshCw color={colors.active} size={17} strokeWidth={2.5} />
          </Pressable>
        </View>

        <RitualSurface style={styles.summaryCard} variant="active">
          <View style={styles.summaryHeading}>
            <View>
              <Text style={styles.summaryKicker}>COMPLETION</Text>
              <Text style={styles.summaryLabel}>복용 완료율</Text>
            </View>
            <View style={styles.historyIcon}>
              <History color={colors.primaryText} size={22} strokeWidth={2.6} />
            </View>
          </View>
          <View style={styles.rateRow}>
            <Text style={styles.rateValue}>{history.summary.completionRate}</Text>
            <Text style={styles.rateUnit}>%</Text>
          </View>
          <Text style={styles.rangeLabel}>
            {history.from && history.to ? formatHistoryRange(history.from, history.to) : `최근 ${days}일`}
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${history.summary.completionRate}%` }]} />
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <CheckCircle2 color={colors.completed} size={19} strokeWidth={2.6} />
              <View>
                <Text style={styles.statValue}>{history.summary.taken}</Text>
                <Text style={styles.statLabel}>복용 완료</Text>
              </View>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <XCircle color={colors.danger} size={19} strokeWidth={2.6} />
              <View>
                <Text style={styles.statValue}>{history.summary.skipped}</Text>
                <Text style={styles.statLabel}>건너뜀</Text>
              </View>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <XCircle color={colors.danger} size={19} strokeWidth={2.6} />
              <View>
                <Text style={styles.statValue}>{history.summary.missed}</Text>
                <Text style={styles.statLabel}>미복용</Text>
              </View>
            </View>
          </View>
        </RitualSurface>

        {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
        {isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.active} />
            <Text style={styles.loadingText}>복용 기록을 정리하고 있어요.</Text>
          </View>
        ) : null}

        {!isLoading && !groups.length ? (
          <RitualSurface style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <CalendarDays color={colors.active} size={23} strokeWidth={2.5} />
            </View>
            <Text style={styles.emptyTitle}>아직 집계할 복용 회차가 없어요</Text>
            <Text style={styles.emptyBody}>복용 예정 시간이 지나면 완료·건너뜀·미복용 상태가 날짜별로 정리됩니다.</Text>
          </RitualSurface>
        ) : null}

        {!isLoading && groups.map((group) => (
          <View key={group.date} style={styles.dateSection}>
            <View style={styles.dateHeader}>
              <View style={styles.dateDot} />
              <Text style={styles.dateTitle}>{formatDoseHistoryDate(group.date)}</Text>
              <Text style={styles.dateCount}>{group.entries.length}건</Text>
            </View>
            <RitualSurface padded={false} style={styles.entriesCard}>
              {group.entries.map((entry, index) => (
                <HistoryRow
                  entry={entry}
                  isLast={index === group.entries.length - 1}
                  key={`${entry.supplementId}-${entry.doseDate}-${entry.doseTime}-${entry.checkedAt}`}
                  onPress={() => navigation.navigate('SupplementDetail', { supplementId: entry.supplementId })}
                />
              ))}
            </RitualSurface>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function HistoryRow({ entry, isLast, onPress }: { entry: DoseHistoryEntry; isLast: boolean; onPress: () => void }) {
  const taken = entry.status === 'TAKEN';
  const skipped = entry.status === 'SKIPPED';
  const statusLabel = taken ? '완료' : skipped ? '건너뜀' : '미복용';
  const name = entry.displayNameKo || entry.productName || '영양제';
  return (
    <Pressable
      accessibilityLabel={`${name}, ${statusLabel}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.entryRow, !isLast && styles.entryDivider, pressed && styles.pressed]}
    >
      <SupplementThumb imageUri={entry.imageUri} name={name} size={48} muted={!taken} />
      <View style={styles.entryCopy}>
        <Text numberOfLines={1} style={styles.entryName}>{name}</Text>
        <Text style={styles.entryTime}>{formatDoseHistoryTime(entry.doseTime)}</Text>
        {entry.memo ? <Text numberOfLines={1} style={styles.entryMemo}>{entry.memo}</Text> : null}
      </View>
      <View style={styles.entryTrailing}>
        <View style={[
          styles.statusBadge,
          taken ? styles.takenBadge : skipped ? styles.skippedBadge : styles.missedBadge,
        ]}>
          <Text style={[
            styles.statusText,
            taken ? styles.takenText : skipped ? styles.skippedText : styles.missedText,
          ]}>
            {statusLabel}
          </Text>
        </View>
        <ChevronRight color={colors.faint} size={16} strokeWidth={2.5} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  content: { padding: spacing.xl, paddingBottom: 112 },
  rail: { alignSelf: 'center', gap: spacing.xl, width: '100%' },
  header: { gap: spacing.xs },
  kicker: { color: colors.active, fontSize: 11, fontWeight: '900', letterSpacing: 2.2 },
  title: { ...type.hero, fontSize: 30, lineHeight: 38 },
  subtitle: { ...type.body, color: colors.inkSoft },
  rangeRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  rangeButton: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderColor: colors.line, borderRadius: 999, borderWidth: 1, minHeight: 42, minWidth: 66, paddingHorizontal: spacing.md, justifyContent: 'center' },
  rangeButtonSelected: { backgroundColor: colors.activeSoft, borderColor: colors.active },
  rangeText: { color: colors.muted, fontSize: 13, fontWeight: '900' },
  rangeTextSelected: { color: colors.active },
  refreshButton: { alignItems: 'center', backgroundColor: colors.activeSoft, borderRadius: radius.md, height: 42, justifyContent: 'center', marginLeft: 'auto', width: 42 },
  summaryCard: { gap: spacing.md },
  summaryHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  summaryKicker: { color: colors.active, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  summaryLabel: { color: colors.inkSoft, fontSize: 14, fontWeight: '900', marginTop: spacing.xs },
  historyIcon: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.md, height: 44, justifyContent: 'center', width: 44 },
  rateRow: { alignItems: 'baseline', flexDirection: 'row' },
  rateValue: { color: colors.primary, fontSize: 56, fontWeight: '900', letterSpacing: -2, lineHeight: 60 },
  rateUnit: { color: colors.primary, fontSize: 22, fontWeight: '900', marginLeft: spacing.xs },
  rangeLabel: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  progressTrack: { backgroundColor: colors.surfaceMuted, borderRadius: 999, height: 8, overflow: 'hidden' },
  progressFill: { backgroundColor: colors.primary, borderRadius: 999, height: '100%' },
  statsRow: { alignItems: 'center', borderTopColor: colors.line, borderTopWidth: 1, flexDirection: 'row', paddingTop: spacing.md },
  statItem: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
  statDivider: { backgroundColor: colors.line, height: 34, width: 1 },
  statValue: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  statLabel: { color: colors.muted, fontSize: 11, fontWeight: '800', marginTop: 2 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  loadingRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', minHeight: 90 },
  loadingText: { ...type.meta },
  emptyCard: { alignItems: 'flex-start', gap: spacing.sm },
  emptyIcon: { alignItems: 'center', backgroundColor: colors.activeSoft, borderRadius: radius.md, height: 46, justifyContent: 'center', width: 46 },
  emptyTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  emptyBody: { ...type.body },
  dateSection: { gap: spacing.sm },
  dateHeader: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xs },
  dateDot: { backgroundColor: colors.active, borderRadius: 999, height: 8, width: 8 },
  dateTitle: { ...type.section },
  dateCount: { color: colors.muted, fontSize: 12, fontWeight: '800', marginLeft: 'auto' },
  entriesCard: { overflow: 'hidden' },
  entryRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 82, padding: spacing.md },
  entryDivider: { borderBottomColor: colors.line, borderBottomWidth: 1 },
  entryCopy: { flex: 1, gap: 2, minWidth: 0 },
  entryName: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  entryTime: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  entryMemo: { color: colors.faint, fontSize: 11, marginTop: 2 },
  entryTrailing: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  statusBadge: { borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  takenBadge: { backgroundColor: colors.completedSoft },
  skippedBadge: { backgroundColor: colors.warningSoft },
  missedBadge: { backgroundColor: colors.dangerSoft },
  statusText: { fontSize: 11, fontWeight: '900' },
  takenText: { color: colors.completed },
  skippedText: { color: colors.warning },
  missedText: { color: colors.danger },
  pressed: { opacity: 0.74 },
});
