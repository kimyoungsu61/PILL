import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check, X } from 'lucide-react-native';
import RitualAction from '../components/RitualAction';
import { colors } from '../theme';
import PlantGrowthAnimation from './PlantGrowthAnimation';
import StampMark from './StampMark';
import { growthCelebrationCopy, type GardenGrowth } from './growthCelebration';

export default function GardenCelebration({ growth, onClose, onOpen }: {
  growth: GardenGrowth; onClose: () => void; onOpen: () => void;
}) {
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [revealed, setRevealed] = useState(false);
  const stampPop = useRef(new Animated.Value(0)).current;
  const copy = growthCelebrationCopy(growth.stage);
  const complete = growth.stage === 7;
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduceMotion(value); }).catch(() => { if (active) setReduceMotion(true); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    if (!revealed) return;
    if (reduceMotion) { stampPop.setValue(1); return; }
    const animation = Animated.spring(stampPop, { toValue: 1, friction: 7, tension: 100, useNativeDriver: Platform.OS !== 'web', isInteraction: false });
    animation.start();
    return () => animation.stop();
  }, [revealed, reduceMotion, stampPop]);
  return <Modal visible transparent animationType="none" onRequestClose={onClose}>
    <View style={styles.backdrop}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} bounces={false}>
        <View style={styles.card} accessibilityViewIsModal role="dialog" accessibilityLabel="오늘의 정원 성장">
          <Pressable accessibilityRole="button" accessibilityLabel="성장 안내 닫기" onPress={onClose} style={styles.close}><X size={20} color={colors.muted} /></Pressable>
          <View style={styles.badge}><Check size={14} color={colors.completed} strokeWidth={2.4} /><Text style={styles.badgeText}>오늘의 기록 완료</Text></View>
          <Text style={styles.eyebrow}>하루를 차곡차곡 남겼어요</Text>
          <PlantGrowthAnimation growth={growth} reduceMotion={reduceMotion} onReveal={() => setRevealed(true)} />
          <View style={styles.copy} accessibilityLiveRegion="polite">
            <Text style={styles.title}>{revealed ? copy.title : '작은 변화가 자라고 있어요'}</Text>
            <Text style={styles.detail}>{copy.detail}</Text>
          </View>
          <View style={styles.stamps} accessibilityLabel={`오늘의 스탬프를 받았어요. 스탬프 ${growth.stage}개, 식물 완성까지 ${7 - growth.stage}개 남았어요.`}>
            {Array.from({ length: 7 }, (_, index) => {
              const fresh = index === growth.stage - 1;
              const filled = index < growth.stage - 1 || fresh && revealed;
              return <View key={index} style={[styles.stamp, filled && styles.filledStamp, fresh && styles.newStamp]}>
                {filled ? <Animated.View style={fresh ? { opacity: stampPop, transform: [{ scale: stampPop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] } : undefined}>
                  <StampMark kind={growth.garden.selectedStamp} color={colors.completed} size={20} filled />
                </Animated.View> : <Text style={styles.number}>{index + 1}</Text>}
              </View>;
            })}
          </View>
          <Text style={styles.stampNote}>{complete ? '일곱 날의 기록, 식물에 꽃이 피었어요' : `오늘의 스탬프 +1  ·  ${growth.stage} / 7`}</Text>
          <View style={styles.actions}>
            <RitualAction fullWidth label={complete ? growth.garden.completedPlants <= 3 ? '새 식물과 선물 보러 가기' : '내 정원 보러 가기' : '좋아요'} onPress={complete ? onOpen : onClose} />
            <RitualAction fullWidth tone="quiet" label={complete ? '오늘의 복용으로' : '내 정원 보기'} onPress={complete ? onClose : onOpen} />
          </View>
        </View>
      </ScrollView>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(23,35,45,0.3)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 24 },
  scroll: { width: '100%', maxWidth: 380, maxHeight: '100%', flexGrow: 0 },
  scrollContent: { alignItems: 'center' },
  card: { width: '100%', borderRadius: 24, paddingHorizontal: 24, paddingTop: 30, paddingBottom: 12, alignItems: 'center', backgroundColor: colors.surface },
  close: { position: 'absolute', right: 4, top: 4, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  badge: { flexDirection: 'row', gap: 5, alignItems: 'center', backgroundColor: colors.completedSoft, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '600', color: colors.completed },
  eyebrow: { fontSize: 14, color: colors.inkSoft, marginTop: 14 },
  copy: { alignItems: 'center', width: '100%' },
  title: { fontSize: 21, lineHeight: 30, fontWeight: '600', letterSpacing: -0.6, color: colors.ink, textAlign: 'center' },
  detail: { fontSize: 13, lineHeight: 22, color: colors.muted, textAlign: 'center', marginTop: 9 },
  stamps: { flexDirection: 'row', width: '100%', maxWidth: 284, justifyContent: 'space-between', gap: 5, marginTop: 22 },
  stamp: { flex: 1, maxWidth: 32, aspectRatio: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: 'transparent' },
  filledStamp: { backgroundColor: colors.completedSoft },
  newStamp: { borderColor: '#9DC8B2' },
  number: { color: colors.faint, fontSize: 11 },
  stampNote: { fontSize: 11, lineHeight: 18, color: colors.completed, marginTop: 10 },
  actions: { width: '100%', marginTop: 22, gap: 2 },
});
