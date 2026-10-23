import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { colors } from '../theme';
import PlantIllustration from './PlantIllustration';
import StampMark from './StampMark';
import { growthLabel, type GardenState } from './types';
import type { summarizeDoseRecords } from '../utils/doseRecord';

type Props = {
  summary: ReturnType<typeof summarizeDoseRecords>;
  loading: boolean;
  garden: GardenState | null;
  error: boolean;
  earned: boolean;
  onOpen: () => void;
  onRetry: () => void;
};

export default function GardenProgressCard({ summary, loading, garden, error, earned, onOpen, onRetry }: Props) {
  const { total, recorded, taken, skipped, unknown, unrecorded, recordPercent: percent, takenPercent } = summary;
  const pop = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value); }).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    if (!earned || reduceMotion) return;
    pop.setValue(0.88);
    const animation = Animated.spring(pop, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [earned, pop, reduceMotion]);
  const completedToday = Boolean(garden?.todayEarned && garden.cycleStamps === 0 && garden.completedPlants > 0);
  const stage = completedToday ? 7 : garden?.cycleStamps ?? 0;
  return <View style={styles.card}>
    <View style={styles.top}>
      <View style={styles.progressCopy}>
        <Text style={styles.caption}>오늘의 기록</Text>
        <Text style={styles.percent}>{loading && !total ? '—' : percent}<Text style={styles.percentUnit}>{loading && !total ? '' : '%'}</Text></Text>
        <Text style={styles.detail}>{loading && !total ? '복용 일정을 불러오고 있어요' : !total ? '오늘 예정된 복용이 없어요' : percent === 100 ? '오늘의 기록을 모두 남겼어요' : `${total}회 중 ${recorded}회 기록했어요`}</Text>
      </View>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel="나의 정원 보기" style={styles.plantButton}>
        <Animated.View style={{ transform: [{ scale: pop }] }}>
          <PlantIllustration stage={stage} variant={Math.max(0, (garden?.completedPlants ?? 0) - (completedToday ? 1 : 0)) % 3} pot={garden?.selectedPot} size={112} />
        </Animated.View>
      </Pressable>
    </View>
    <View accessibilityRole="progressbar" accessibilityLabel="오늘의 기록 완료율" accessibilityValue={{ min: 0, max: 100, now: percent }} style={styles.track}>
      <View style={[styles.fill, { width: `${percent}%` }, percent === 100 && styles.completeFill]} />
    </View>
    {total > 0 ? <View style={styles.recordSummary}>
      <Text style={styles.takenSummary}>복용률 {takenPercent}% <Text style={styles.summaryMuted}>· 먹었어요 {taken}/{total}회</Text></Text>
      <Text style={styles.summaryDetail}>못 먹었어요 {skipped}회 · 기억이 안 나요 {unknown}회 · 미기록 {unrecorded}회</Text>
    </View> : null}
    {garden ? <Pressable accessibilityRole="button" accessibilityLabel={`나의 정원, 스탬프 ${stage}개, 일곱 개까지 ${7 - stage}개 남음`} onPress={onOpen} style={styles.garden}>
      <View style={styles.gardenHeading}>
        <Text style={styles.gardenTitle}>나의 작은 정원</Text>
        <View style={styles.gardenLink}><Text style={styles.gardenLinkText}>{stage} / 7</Text><ChevronRight size={14} color={colors.muted} /></View>
      </View>
      <View style={styles.stamps}>
        {Array.from({ length: 7 }, (_, index) => <View key={index} style={[styles.stamp, index < stage && styles.stampFilled]}>
          {index < stage ? <StampMark kind={garden.selectedStamp} size={21} color={colors.completed} filled /> : <Text style={styles.stampNumber}>{index + 1}</Text>}
        </View>)}
      </View>
      <Text accessibilityLiveRegion="polite" style={[styles.gardenHint, earned && styles.earnedHint]}>{completedToday ? '일곱 날이 모여, 식물 하나가 완성됐어요.' : earned
        ? '오늘의 스탬프가 찍혔어요. 한 뼘 더 자랐네요.'
        : garden.todayEarned ? `오늘도 한 뼘. ${growthLabel(stage)}.`
        : stage ? `새 식물까지 ${7 - stage}개. 쉬어 가도 괜찮아요.`
        : garden.completedPlants ? '다음 식물도 천천히 함께 키워요.' : '하루의 기록이 작은 새싹을 키워요.'}</Text>
    </Pressable> : <Pressable accessibilityRole="button" onPress={error ? onRetry : onOpen} style={styles.unavailable}>
      <Text style={styles.detail}>{error ? '정원을 불러오지 못했어요 · 다시 시도' : '작은 정원을 준비하고 있어요'}</Text>
      <ChevronRight size={15} color={colors.muted} />
    </Pressable>}
    {garden && error ? <Pressable accessibilityRole="button" onPress={onRetry} style={styles.unavailable}><Text style={styles.detail}>정원 기록을 확인하지 못했어요 · 다시 시도</Text></Pressable> : null}
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 20, paddingBottom: 17, marginBottom: 24 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  progressCopy: { flex: 1, minWidth: 0 },
  caption: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  percent: { color: colors.ink, fontSize: 44, lineHeight: 55, fontWeight: '600', letterSpacing: -1.8, fontVariant: ['tabular-nums'] },
  percentUnit: { color: colors.inkSoft, fontSize: 22, fontWeight: '400', letterSpacing: -0.5 },
  detail: { color: colors.inkSoft, fontSize: 12, lineHeight: 19 },
  plantButton: { width: 112, height: 112, alignItems: 'center', justifyContent: 'center' },
  track: { height: 4, borderRadius: 3, backgroundColor: colors.line, overflow: 'hidden', marginTop: 12 },
  fill: { height: 4, borderRadius: 3, backgroundColor: colors.active },
  completeFill: { backgroundColor: colors.completed },
  recordSummary: { marginTop: 15, gap: 5 },
  takenSummary: { fontSize: 12, lineHeight: 19, fontWeight: '600', color: colors.inkSoft },
  summaryMuted: { fontWeight: '400', color: colors.muted },
  summaryDetail: { fontSize: 12, lineHeight: 20, color: colors.muted },
  garden: { paddingTop: 20 },
  gardenHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  gardenTitle: { fontSize: 12, fontWeight: '600', color: colors.inkSoft },
  gardenLink: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  gardenLinkText: { fontSize: 12, color: colors.muted, fontVariant: ['tabular-nums'] },
  stamps: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  stamp: { flex: 1, maxWidth: 38, aspectRatio: 1, borderRadius: 30, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  stampFilled: { backgroundColor: colors.completedSoft },
  stampNumber: { color: colors.faint, fontSize: 11, fontVariant: ['tabular-nums'] },
  gardenHint: { color: colors.muted, fontSize: 11, lineHeight: 18, marginTop: 12 },
  earnedHint: { color: colors.completed },
  unavailable: { paddingTop: 18, flexDirection: 'row', gap: 8, alignItems: 'center', minHeight: 50 },
});
