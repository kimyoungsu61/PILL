import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as FileSystem from 'expo-file-system/legacy';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FolderOpen,
  ListChecks,
  LockKeyhole,
  Pill,
  RefreshCw,
} from 'lucide-react-native';
import { apiRequest } from '../api/client';
import type { ExportDataResponse } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import RitualAction from '../components/RitualAction';
import RitualSurface from '../components/RitualSurface';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { colors, radius, spacing, type } from '../theme';
import { contentRailWidth } from '../utils/responsiveLayout';
import {
  buildDoseHistoryCsv,
  buildSupplementCsv,
  exportFileStamp,
  exportRangeLabel,
} from './ExportDataScreen.helpers';

type Props = NativeStackScreenProps<RootStackParamList, 'ExportData'>;
type RangeDays = 7 | 30 | 90;

const ranges: Array<{ days: RangeDays; label: string }> = [
  { days: 7, label: '7일' },
  { days: 30, label: '30일' },
  { days: 90, label: '90일' },
];

export default function ExportDataScreen({}: Props) {
  const { token } = useAuth();
  const { width } = useWindowDimensions();
  const [days, setDays] = useState<RangeDays>(30);
  const [data, setData] = useState<ExportDataResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    if (!token) {
      return;
    }
    setError('');
    setSuccess('');
    setIsLoading(true);
    try {
      setData(await apiRequest<ExportDataResponse>(`/api/export?days=${days}`, {}, token));
    } catch (err) {
      setError(err instanceof Error ? err.message : '내보낼 데이터를 불러오지 못했어요.');
    } finally {
      setIsLoading(false);
    }
  }, [days, token]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  async function saveCsvFiles() {
    if (!data) {
      return;
    }
    if (Platform.OS !== 'android') {
      setError('현재 파일 저장은 Android 기기에서 지원해요.');
      return;
    }

    setError('');
    setSuccess('');
    setIsSaving(true);
    try {
      const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!permission.granted) {
        setError('폴더 선택이 취소됐어요. 저장할 때 원하는 폴더를 선택해 주세요.');
        return;
      }

      const stamp = exportFileStamp(data.generatedAt);
      const supplementFileName = `PILL_영양제목록_${stamp}`;
      const historyFileName = `PILL_복용기록_${days}일_${stamp}`;
      const supplementUri = await FileSystem.StorageAccessFramework.createFileAsync(
        permission.directoryUri,
        supplementFileName,
        'text/csv',
      );
      const historyUri = await FileSystem.StorageAccessFramework.createFileAsync(
        permission.directoryUri,
        historyFileName,
        'text/csv',
      );

      await Promise.all([
        FileSystem.StorageAccessFramework.writeAsStringAsync(
          supplementUri,
          `\uFEFF${buildSupplementCsv(data)}`,
          { encoding: FileSystem.EncodingType.UTF8 },
        ),
        FileSystem.StorageAccessFramework.writeAsStringAsync(
          historyUri,
          `\uFEFF${buildDoseHistoryCsv(data)}`,
          { encoding: FileSystem.EncodingType.UTF8 },
        ),
      ]);
      setSuccess(`CSV 파일 2개를 저장했어요.\n${supplementFileName}.csv\n${historyFileName}.csv`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV 파일을 저장하지 못했어요.');
    } finally {
      setIsSaving(false);
    }
  }

  const summary = data?.doseHistory.summary;

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <View style={[styles.rail, { maxWidth: contentRailWidth(width) }]}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>DATA EXPORT</Text>
            <Text style={styles.title}>내보내기</Text>
            <Text style={styles.subtitle}>
              보관함의 영양제와 기간별 복용 기록을 엑셀에서 열 수 있는 CSV 파일로 저장해요.
            </Text>
          </View>
          <View style={styles.headerIcon}>
            <Download color={colors.primaryText} size={23} strokeWidth={2.6} />
          </View>
        </View>

        <View accessibilityLabel="복용 기록 기간" style={styles.rangeRow}>
          {ranges.map((range) => {
            const selected = range.days === days;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={range.days}
                onPress={() => setDays(range.days)}
                style={({ pressed }) => [
                  styles.rangeButton,
                  selected && styles.rangeButtonSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.rangeText, selected && styles.rangeTextSelected]}>{range.label}</Text>
              </Pressable>
            );
          })}
          <Pressable
            accessibilityLabel="내보내기 데이터 새로고침"
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
              <Text style={styles.summaryKicker}>EXPORT PREVIEW</Text>
              <Text style={styles.summaryTitle}>파일에 담길 데이터</Text>
            </View>
            <View style={styles.fileIcon}>
              <FileSpreadsheet color={colors.primaryText} size={23} strokeWidth={2.5} />
            </View>
          </View>
          <View style={styles.statsGrid}>
            <SummaryStat label="영양제" value={data?.supplements.length ?? 0} />
            <SummaryStat label="복용 일정" value={summary?.total ?? 0} />
            <SummaryStat label="완료율" suffix="%" value={summary?.completionRate ?? 0} />
          </View>
          <Text style={styles.rangeLabel}>
            {data ? exportRangeLabel(data.doseHistory.from, data.doseHistory.to) : `최근 ${days}일`}
          </Text>
        </RitualSurface>

        {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
        {success ? (
          <RitualSurface style={styles.successCard}>
            <View style={styles.successHeading}>
              <CheckCircle2 color={colors.completed} size={22} strokeWidth={2.6} />
              <Text style={styles.successTitle}>저장 완료</Text>
            </View>
            <Text style={styles.successText}>{success}</Text>
          </RitualSurface>
        ) : null}

        {isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.active} />
            <Text style={styles.loadingText}>내보낼 데이터를 준비하고 있어요.</Text>
          </View>
        ) : null}

        {!isLoading && data ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionKicker}>FILES</Text>
              <Text style={styles.sectionTitle}>저장되는 파일</Text>
              <View style={styles.fileList}>
                <ExportFileCard
                  body={`보관함의 영양제 ${data.supplements.length}개, 복용 시간, 성분과 주의 문구`}
                  icon={<Pill color={colors.active} size={22} strokeWidth={2.5} />}
                  title="영양제 목록.csv"
                />
                <ExportFileCard
                  body={`${days}일 동안 완료·건너뜀·미복용을 포함한 ${summary?.total ?? 0}개 일정`}
                  icon={<ListChecks color={colors.completed} size={22} strokeWidth={2.5} />}
                  title="복용 기록.csv"
                />
              </View>
            </View>

            <RitualSurface style={styles.privacyCard}>
              <View style={styles.privacyHeading}>
                <LockKeyhole color={colors.warning} size={20} strokeWidth={2.6} />
                <Text style={styles.privacyTitle}>개인정보를 확인해 주세요</Text>
              </View>
              <Text style={styles.privacyBody}>
                파일에는 영양제명과 복용 기록이 포함됩니다. 공용 기기나 공유 폴더 대신 본인이 관리하는 폴더를 선택해 주세요.
              </Text>
              <Text style={styles.accountText}>내보내는 계정 · {data.email}</Text>
            </RitualSurface>

            <RitualAction
              disabled={isSaving}
              fullWidth
              icon={isSaving
                ? <ActivityIndicator color={colors.primaryText} size="small" />
                : <FolderOpen color={colors.primaryText} size={20} strokeWidth={2.5} />}
              label={isSaving ? '파일 저장 중' : '저장할 폴더 선택'}
              onPress={() => void saveCsvFiles()}
            />
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

function SummaryStat({ label, suffix = '개', value }: { label: string; suffix?: string; value: number }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statValueRow}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statSuffix}>{suffix}</Text>
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ExportFileCard({ body, icon, title }: { body: string; icon: React.ReactNode; title: string }) {
  return (
    <RitualSurface style={styles.fileCard}>
      <View style={styles.fileCardIcon}>{icon}</View>
      <View style={styles.fileCardCopy}>
        <Text style={styles.fileCardTitle}>{title}</Text>
        <Text style={styles.fileCardBody}>{body}</Text>
      </View>
    </RitualSurface>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  content: { padding: spacing.xl, paddingBottom: 112 },
  rail: { alignSelf: 'center', gap: spacing.xl, width: '100%' },
  header: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md },
  headerCopy: { flex: 1, gap: spacing.xs },
  kicker: { color: colors.active, fontSize: 11, fontWeight: '900', letterSpacing: 2.2 },
  title: { ...type.hero, fontSize: 30, lineHeight: 38 },
  subtitle: { ...type.body, color: colors.inkSoft },
  headerIcon: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.lg, height: 50, justifyContent: 'center', width: 50 },
  rangeRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  rangeButton: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderColor: colors.line, borderRadius: 999, borderWidth: 1, minHeight: 42, minWidth: 70, paddingHorizontal: spacing.md, justifyContent: 'center' },
  rangeButtonSelected: { backgroundColor: colors.activeSoft, borderColor: colors.active },
  rangeText: { color: colors.muted, fontSize: 13, fontWeight: '900' },
  rangeTextSelected: { color: colors.active },
  refreshButton: { alignItems: 'center', backgroundColor: colors.activeSoft, borderRadius: radius.md, height: 42, justifyContent: 'center', marginLeft: 'auto', width: 42 },
  summaryCard: { gap: spacing.lg },
  summaryHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  summaryKicker: { color: colors.active, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  summaryTitle: { color: colors.ink, fontSize: 17, fontWeight: '900', marginTop: spacing.xs },
  fileIcon: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.md, height: 46, justifyContent: 'center', width: 46 },
  statsGrid: { borderTopColor: colors.line, borderTopWidth: 1, flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.md },
  stat: { backgroundColor: colors.surfaceMuted, borderRadius: radius.md, flex: 1, padding: spacing.md },
  statValueRow: { alignItems: 'baseline', flexDirection: 'row' },
  statValue: { color: colors.ink, fontSize: 22, fontWeight: '900' },
  statSuffix: { color: colors.muted, fontSize: 11, fontWeight: '900', marginLeft: 2 },
  statLabel: { color: colors.muted, fontSize: 11, fontWeight: '800', marginTop: spacing.xs },
  rangeLabel: { color: colors.active, fontSize: 12, fontWeight: '900' },
  error: { color: colors.danger, fontSize: 13, lineHeight: 20 },
  successCard: { backgroundColor: colors.completedSoft, borderColor: colors.completed, gap: spacing.sm },
  successHeading: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  successTitle: { color: colors.completed, fontSize: 16, fontWeight: '900' },
  successText: { color: colors.inkSoft, fontSize: 12, lineHeight: 19 },
  loadingRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', minHeight: 110 },
  loadingText: { ...type.meta },
  section: { gap: spacing.sm },
  sectionKicker: { color: colors.active, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  sectionTitle: { ...type.section },
  fileList: { gap: spacing.md, marginTop: spacing.xs },
  fileCard: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  fileCardIcon: { alignItems: 'center', backgroundColor: colors.activeSoft, borderRadius: radius.md, height: 48, justifyContent: 'center', width: 48 },
  fileCardCopy: { flex: 1, gap: 3 },
  fileCardTitle: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  fileCardBody: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  privacyCard: { backgroundColor: colors.warningSoft, borderColor: colors.warning, gap: spacing.sm },
  privacyHeading: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  privacyTitle: { color: colors.warning, fontSize: 15, fontWeight: '900' },
  privacyBody: { ...type.body, color: colors.inkSoft },
  accountText: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  pressed: { opacity: 0.74 },
});
