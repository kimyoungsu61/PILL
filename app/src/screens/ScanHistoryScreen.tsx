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
import {
  AlertTriangle,
  Archive,
  Camera,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  RefreshCw,
  ScanLine,
} from 'lucide-react-native';
import { apiRequest } from '../api/client';
import type { ScanHistoryEntry, ScanHistoryResponse, ScanResult } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import RitualAction from '../components/RitualAction';
import RitualSurface from '../components/RitualSurface';
import SupplementThumb from '../components/SupplementThumb';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { colors, radius, spacing, type } from '../theme';
import { contentRailWidth } from '../utils/responsiveLayout';
import {
  filterScanHistory,
  formatScanHistoryDate,
  scanHistoryName,
  scanHistoryStatus,
} from './ScanHistoryScreen.helpers';
import type { ScanHistoryFilter } from './ScanHistoryScreen.helpers';

type Props = NativeStackScreenProps<RootStackParamList, 'ScanHistory'>;

const emptyHistory: ScanHistoryResponse = {
  summary: { total: 0, saved: 0, needsReview: 0, failed: 0 },
  entries: [],
};

const filters: Array<{ key: ScanHistoryFilter; label: string }> = [
  { key: 'ALL', label: '전체' },
  { key: 'SAVED', label: '저장됨' },
  { key: 'REVIEW', label: '저장 전' },
  { key: 'FAILED', label: '실패' },
];

export default function ScanHistoryScreen({ navigation }: Props) {
  const { token } = useAuth();
  const { width } = useWindowDimensions();
  const [history, setHistory] = useState<ScanHistoryResponse>(emptyHistory);
  const [filter, setFilter] = useState<ScanHistoryFilter>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [openingScanId, setOpeningScanId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const visibleEntries = useMemo(
    () => filterScanHistory(history.entries, filter),
    [filter, history.entries],
  );

  const load = useCallback(async () => {
    if (!token) {
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      setHistory(await apiRequest<ScanHistoryResponse>('/api/scans', {}, token));
    } catch (err) {
      setError(err instanceof Error ? err.message : '스캔 기록을 불러오지 못했어요.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  async function openEntry(entry: ScanHistoryEntry) {
    if (entry.saved && entry.supplementId) {
      navigation.navigate('SupplementDetail', { supplementId: entry.supplementId });
      return;
    }
    if (entry.status === 'FAILED') {
      navigation.navigate('ImageInput');
      return;
    }
    if (entry.status === 'PROCESSING') {
      await load();
      return;
    }
    if (!token) {
      return;
    }

    setOpeningScanId(entry.scanId);
    setError('');
    try {
      const result = await apiRequest<ScanResult>(`/api/scans/${entry.scanId}`, {}, token);
      navigation.navigate('ScanResult', { result });
    } catch (err) {
      setError(err instanceof Error ? err.message : '분석 결과를 다시 열지 못했어요.');
    } finally {
      setOpeningScanId(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <View style={[styles.rail, { maxWidth: contentRailWidth(width) }]}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>스캔 기록</Text>
            <Text style={styles.subtitle}>
              AI가 읽은 라벨과 보관함 저장 여부를 한눈에 확인하고, 저장 전 결과도 다시 이어볼 수 있어요.
            </Text>
          </View>
          <Pressable
            accessibilityLabel="새 영양제 스캔"
            accessibilityRole="button"
            onPress={() => navigation.navigate('ImageInput')}
            style={({ pressed }) => [styles.newScanButton, pressed && styles.pressed]}
          >
            <Camera color={colors.primaryText} size={22} strokeWidth={2.6} />
          </Pressable>
        </View>

        <RitualSurface style={styles.summaryCard} variant="active">
          <View style={styles.summaryTop}>
            <View>
              <View style={styles.totalRow}>
                <Text style={styles.totalValue}>{history.summary.total}</Text>
                <Text style={styles.totalUnit}>건</Text>
              </View>
            </View>
            <View style={styles.scanIcon}>
              <ScanLine color={colors.primaryText} size={24} strokeWidth={2.6} />
            </View>
          </View>
          <View style={styles.summaryGrid}>
            <SummaryStat
              icon={<CheckCircle2 color={colors.completed} size={18} strokeWidth={2.6} />}
              label="보관함 저장"
              value={history.summary.saved}
            />
            <SummaryStat
              icon={<ScanLine color={colors.active} size={18} strokeWidth={2.6} />}
              label="저장 전 확인"
              value={history.summary.needsReview}
            />
            <SummaryStat
              icon={<AlertTriangle color={colors.danger} size={18} strokeWidth={2.6} />}
              label="분석 실패"
              value={history.summary.failed}
            />
          </View>
        </RitualSurface>

        <View accessibilityLabel="스캔 기록 필터" style={styles.filterRow}>
          {filters.map((option) => {
            const selected = filter === option.key;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={option.key}
                onPress={() => setFilter(option.key)}
                style={({ pressed }) => [
                  styles.filterButton,
                  selected && styles.filterButtonSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{option.label}</Text>
              </Pressable>
            );
          })}
          <Pressable
            accessibilityLabel="스캔 기록 새로고침"
            accessibilityRole="button"
            onPress={() => void load()}
            style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}
          >
            <RefreshCw color={colors.active} size={17} strokeWidth={2.5} />
          </Pressable>
        </View>

        {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}

        {isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.active} />
            <Text style={styles.loadingText}>AI 분석 기록을 정리하고 있어요.</Text>
          </View>
        ) : null}

        {!isLoading && !visibleEntries.length ? (
          <RitualSurface style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Archive color={colors.active} size={25} strokeWidth={2.5} />
            </View>
            <Text style={styles.emptyTitle}>
              {history.summary.total ? '이 조건에 맞는 기록이 없어요' : '아직 스캔 기록이 없어요'}
            </Text>
            <Text style={styles.emptyBody}>
              영양제 앞면과 뒷면을 촬영하면 AI 분석 결과가 이곳에 자동으로 쌓입니다.
            </Text>
            <RitualAction
              fullWidth
              icon={<Camera color={colors.primaryText} size={19} strokeWidth={2.5} />}
              label="첫 영양제 스캔하기"
              onPress={() => navigation.navigate('ImageInput')}
            />
          </RitualSurface>
        ) : null}

        {!isLoading && visibleEntries.length ? (
          <View style={styles.listSection}>
            <View style={styles.listHeading}>
              <Text style={styles.listTitle}>최근 분석</Text>
              <Text style={styles.listCount}>{visibleEntries.length}건</Text>
            </View>
            <View style={styles.cardList}>
              {visibleEntries.map((entry) => (
                <ScanHistoryCard
                  entry={entry}
                  isOpening={openingScanId === entry.scanId}
                  key={entry.scanId}
                  onPress={() => void openEntry(entry)}
                />
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function SummaryStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <View style={styles.summaryStat}>
      {icon}
      <View>
        <Text style={styles.summaryValue}>{value}</Text>
        <Text style={styles.summaryLabel}>{label}</Text>
      </View>
    </View>
  );
}

function ScanHistoryCard({
  entry,
  isOpening,
  onPress,
}: {
  entry: ScanHistoryEntry;
  isOpening: boolean;
  onPress: () => void;
}) {
  const status = scanHistoryStatus(entry);
  const name = scanHistoryName(entry);
  const badgeStyle = status.tone === 'SAVED'
    ? styles.savedBadge
    : status.tone === 'REVIEW'
      ? styles.reviewBadge
      : status.tone === 'FAILED'
        ? styles.failedBadge
        : styles.processingBadge;
  const badgeTextStyle = status.tone === 'SAVED'
    ? styles.savedText
    : status.tone === 'REVIEW'
      ? styles.reviewText
      : status.tone === 'FAILED'
        ? styles.failedText
        : styles.processingText;

  return (
    <Pressable
      accessibilityLabel={`${name}, ${status.label}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.historyCard, pressed && styles.pressed]}
    >
      <View style={styles.cardTop}>
        <SupplementThumb imageUri={entry.imageUri} name={name} size={58} muted={status.tone === 'FAILED'} />
        <View style={styles.cardCopy}>
          <View style={[styles.statusBadge, badgeStyle]}>
            <Text style={[styles.statusText, badgeTextStyle]}>{status.label}</Text>
          </View>
          <Text numberOfLines={1} style={styles.cardName}>{name}</Text>
          {entry.brandName ? <Text numberOfLines={1} style={styles.cardBrand}>{entry.brandName}</Text> : null}
        </View>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.dateText}>{formatScanHistoryDate(entry.createdAt)}</Text>
        {entry.ingredientCount > 0 ? (
          <Text style={styles.metaText}>성분 {entry.ingredientCount}개</Text>
        ) : null}
        {entry.reviewIngredientCount > 0 ? (
          <View style={styles.reviewSignal}>
            <CircleDashed color={colors.warning} size={13} strokeWidth={2.5} />
            <Text style={styles.reviewSignalText}>확인 {entry.reviewIngredientCount}</Text>
          </View>
        ) : null}
        {entry.hasWarnings ? (
          <View style={styles.warningSignal}>
            <AlertTriangle color={colors.danger} size={13} strokeWidth={2.5} />
            <Text style={styles.warningSignalText}>주의 문구</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.cardAction}>
        {isOpening ? <ActivityIndicator color={colors.active} size="small" /> : null}
        <Text style={styles.cardActionText}>{isOpening ? '결과 여는 중' : status.action}</Text>
        {!isOpening ? <ChevronRight color={colors.active} size={17} strokeWidth={2.6} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  content: { padding: spacing.xl, paddingBottom: 112 },
  rail: { alignSelf: 'center', gap: spacing.xl, width: '100%' },
  header: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md },
  headerCopy: { flex: 1, gap: spacing.xs },
  kicker: { color: colors.active, fontSize: 11, fontWeight: '700', letterSpacing: 2.2 },
  title: { ...type.hero, fontSize: 30, lineHeight: 38 },
  subtitle: { ...type.body, color: colors.inkSoft },
  newScanButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.lg, height: 50, justifyContent: 'center', width: 50 },
  summaryCard: { gap: spacing.lg },
  summaryTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  summaryKicker: { color: colors.active, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  totalRow: { alignItems: 'baseline', flexDirection: 'row', marginTop: spacing.xs },
  totalValue: { color: colors.ink, fontSize: 32, fontWeight: '600', letterSpacing: -0.8, lineHeight: 42 },
  totalUnit: { color: colors.primary, fontSize: 17, fontWeight: '700', marginLeft: spacing.xs },
  scanIcon: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.md, height: 48, justifyContent: 'center', width: 48 },
  summaryGrid: { borderTopColor: colors.line, borderTopWidth: 1, flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.md },
  summaryStat: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: radius.md, flex: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 58, padding: spacing.sm },
  summaryValue: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  summaryLabel: { color: colors.muted, fontSize: 10, fontWeight: '600', marginTop: 2 },
  filterRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  filterButton: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderColor: colors.line, borderRadius: 999, borderWidth: 1, minHeight: 40, paddingHorizontal: spacing.md, justifyContent: 'center' },
  filterButtonSelected: { backgroundColor: colors.activeSoft, borderColor: colors.active },
  filterText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  filterTextSelected: { color: colors.active },
  refreshButton: { alignItems: 'center', backgroundColor: colors.activeSoft, borderRadius: radius.md, height: 40, justifyContent: 'center', marginLeft: 'auto', width: 40 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 20 },
  loadingRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', minHeight: 110 },
  loadingText: { ...type.meta },
  emptyCard: { alignItems: 'flex-start', gap: spacing.sm },
  emptyIcon: { alignItems: 'center', backgroundColor: colors.activeSoft, borderRadius: radius.md, height: 48, justifyContent: 'center', width: 48 },
  emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: '700' },
  emptyBody: { ...type.body, marginBottom: spacing.xs },
  listSection: { gap: spacing.md },
  listHeading: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  listEyebrow: { color: colors.active, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  listTitle: { ...type.section },
  listCount: { color: colors.muted, fontSize: 12, fontWeight: '600', marginLeft: 'auto' },
  cardList: { gap: spacing.md },
  historyCard: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.xl, borderWidth: 1, overflow: 'hidden', padding: spacing.lg },
  cardTop: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  cardCopy: { alignItems: 'flex-start', flex: 1, gap: 3, minWidth: 0 },
  statusBadge: { borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 5 },
  statusText: { fontSize: 10, fontWeight: '700' },
  savedBadge: { backgroundColor: colors.completedSoft },
  savedText: { color: colors.completed },
  reviewBadge: { backgroundColor: colors.activeSoft },
  reviewText: { color: colors.active },
  failedBadge: { backgroundColor: colors.dangerSoft },
  failedText: { color: colors.danger },
  processingBadge: { backgroundColor: colors.warningSoft },
  processingText: { color: colors.warning },
  cardName: { color: colors.ink, fontSize: 17, fontWeight: '700', marginTop: 2 },
  cardBrand: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  metaRow: { alignItems: 'center', borderTopColor: colors.line, borderTopWidth: 1, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md, paddingTop: spacing.md },
  dateText: { color: colors.inkSoft, fontSize: 11, fontWeight: '700' },
  metaText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  reviewSignal: { alignItems: 'center', flexDirection: 'row', gap: 3 },
  reviewSignalText: { color: colors.warning, fontSize: 11, fontWeight: '700' },
  warningSignal: { alignItems: 'center', flexDirection: 'row', gap: 3 },
  warningSignalText: { color: colors.danger, fontSize: 11, fontWeight: '700' },
  cardAction: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: radius.md, flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', marginTop: spacing.md, minHeight: 42, paddingHorizontal: spacing.md },
  cardActionText: { color: colors.active, fontSize: 12, fontWeight: '700' },
  pressed: { opacity: 0.74 },
});
