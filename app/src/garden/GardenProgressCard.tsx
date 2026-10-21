import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, X } from 'lucide-react-native';
import { colors } from '../theme';
import PlantIllustration from './PlantIllustration';
import StampMark from './StampMark';
import { completionPercent, growthLabel, type GardenState } from './types';

type Props = {
  done: number;
  total: number;
  loading: boolean;
  garden: GardenState | null;
  error: boolean;
  earned: boolean;
  onOpen: () => void;
  onRetry: () => void;
};

export default function GardenProgressCard({ done, total, loading, garden, error, earned, onOpen, onRetry }: Props) {
  const percent = completionPercent(done, total);
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
        <Text style={styles.detail}>{loading && !total ? '복용 일정을 불러오고 있어요' : !total ? '오늘 예정된 복용이 없어요' : percent === 100 ? '오늘도 잘 챙겼어요' : `${total}회 중 ${done}회 챙겼어요`}</Text>
      </View>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel="나의 정원 보기" style={styles.plantButton}>
        <Animated.View style={{ transform: [{ scale: pop }] }}>
          <PlantIllustration stage={stage} variant={Math.max(0, (garden?.completedPlants ?? 0) - (completedToday ? 1 : 0)) % 3} pot={garden?.selectedPot} size={112} />
        </Animated.View>
      </Pressable>
    </View>
    <View accessibilityRole="progressbar" accessibilityLabel="오늘의 복용 완료율" accessibilityValue={{ min: 0, max: 100, now: percent }} style={styles.track}>
      <View style={[styles.fill, { width: `${percent}%` }, percent === 100 && styles.completeFill]} />
    </View>
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
        : garden.completedPlants ? '다음 식물도 천천히 함께 키워요.' : '하루를 챙기면, 작은 새싹이 자라요.'}</Text>
    </Pressable> : <Pressable accessibilityRole="button" onPress={error ? onRetry : onOpen} style={styles.unavailable}>
      <Text style={styles.detail}>{error ? '정원을 불러오지 못했어요 · 다시 시도' : '작은 정원을 준비하고 있어요'}</Text>
      <ChevronRight size={15} color={colors.muted} />
    </Pressable>}
    {garden && error ? <Pressable accessibilityRole="button" onPress={onRetry} style={styles.unavailable}><Text style={styles.detail}>정원 기록을 확인하지 못했어요 · 다시 시도</Text></Pressable> : null}
  </View>;
}

export function GardenCelebration({ garden, onClose, onOpen }: { garden: GardenState | null; onClose: () => void; onOpen: () => void }) {
  return <Modal visible={garden !== null} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.backdrop}>
      <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} bounces={false}>
      <View style={styles.celebration} accessibilityViewIsModal>
        <Pressable accessibilityRole="button" accessibilityLabel="식물 완성 안내 닫기" style={styles.close} onPress={onClose}><X size={20} color={colors.muted} /></Pressable>
        <Text style={styles.celebrationCaption}>일곱 번의 꾸준함</Text>
        <PlantIllustration stage={7} variant={Math.max(0, (garden?.completedPlants ?? 1) - 1) % 3} pot={garden?.selectedPot} size={206} />
        <Text style={styles.celebrationTitle}>우리 식물이 다 자랐어요</Text>
        <Text style={styles.celebrationDetail}>잘 챙긴 일곱 날이 모여{'\n'}정원에 식물 하나가 더해졌어요.</Text>
        <Pressable accessibilityRole="button" onPress={onOpen} style={styles.primary}><Text style={styles.primaryLabel}>{(garden?.completedPlants ?? 0) <= 3 ? '새 식물과 선물 보러 가기' : '내 정원 보러 가기'}</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.secondary}><Text style={styles.secondaryLabel}>오늘의 복용으로</Text></Pressable>
      </View>
      </ScrollView>
    </View>
  </Modal>;
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
  backdrop: { flex: 1, backgroundColor: 'rgba(23,35,45,0.32)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalScroll: { width: '100%', maxWidth: 400, maxHeight: '100%', flexGrow: 0 },
  modalContent: { alignItems: 'center' },
  celebration: { width: '100%', maxWidth: 400, backgroundColor: colors.surface, borderRadius: 24, padding: 24, paddingTop: 34, alignItems: 'center' },
  close: { position: 'absolute', right: 6, top: 6, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  celebrationCaption: { color: colors.completed, fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  celebrationTitle: { fontSize: 21, lineHeight: 30, fontWeight: '600', color: colors.ink, textAlign: 'center', letterSpacing: -0.5 },
  celebrationDetail: { fontSize: 13, lineHeight: 22, color: colors.muted, textAlign: 'center', marginTop: 10, marginBottom: 24 },
  primary: { minHeight: 50, width: '100%', borderRadius: 12, backgroundColor: colors.active, alignItems: 'center', justifyContent: 'center' },
  primaryLabel: { fontSize: 14, color: colors.white, fontWeight: '600' },
  secondary: { minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  secondaryLabel: { fontSize: 13, color: colors.muted },
});
