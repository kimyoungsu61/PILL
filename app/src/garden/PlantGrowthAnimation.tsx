import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { Sparkle } from 'lucide-react-native';
import PlantIllustration from './PlantIllustration';
import type { GardenGrowth } from './growthCelebration';
import { colors } from '../theme';

const sparks = [
  { left: 37, top: 84, size: 13, x: -9, y: -14 },
  { left: 185, top: 50, size: 19, x: 10, y: -15 },
  { left: 173, top: 146, size: 10, x: 13, y: -5 },
  { left: 69, top: 37, size: 9, x: -5, y: -13 },
];

/** A single, quiet growth beat: stir, soft light, then the next illustration. */
export default function PlantGrowthAnimation({ growth, reduceMotion, onReveal }: {
  growth: GardenGrowth;
  reduceMotion: boolean | null;
  onReveal: () => void;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const revealed = useRef(false);
  const revealCallback = useRef(onReveal);
  revealCallback.current = onReveal;
  useEffect(() => {
    if (reduceMotion === null) return;
    if (reduceMotion || revealed.current) {
      progress.setValue(1);
      revealed.current = true;
      revealCallback.current();
      return;
    }
    progress.setValue(0);
    const listener = progress.addListener(({ value }) => {
      if (value >= 0.55 && !revealed.current) {
        revealed.current = true;
        revealCallback.current();
      }
    });
    const animation = Animated.timing(progress, {
      toValue: 1, duration: 2100, easing: Easing.linear,
      useNativeDriver: Platform.OS !== 'web', isInteraction: false,
    });
    animation.start();
    return () => { animation.stop(); progress.removeListener(listener); };
  }, [progress, reduceMotion]);

  const at = (inputRange: number[], outputRange: number[]) => progress.interpolate({ inputRange, outputRange, extrapolate: 'clamp' });
  const showFinal = reduceMotion === true;
  return <View style={styles.scene} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {!showFinal && <>
      <Animated.View style={[styles.halo, { opacity: at([0, 0.24, 0.43, 0.65, 1], [0, 0, 0.8, 0.45, 0]), transform: [{ scale: at([0, 0.25, 0.6, 1], [0.6, 0.6, 1, 1.12]) }] }]} />
      <Animated.View style={[styles.ring, { opacity: at([0, 0.3, 0.5, 0.85, 1], [0, 0, 0.35, 0, 0]), transform: [{ scale: at([0, 0.3, 0.85, 1], [0.55, 0.55, 1.14, 1.14]) }] }]} />
    </>}
    <Animated.View style={[styles.plant, { transform: [
      { rotate: showFinal ? '0deg' : progress.interpolate({ inputRange: [0, 0.08, 0.17, 0.26, 0.34, 0.43, 1], outputRange: ['0deg', '-2.5deg', '2.5deg', '-1.7deg', '1deg', '0deg', '0deg'] }) },
      { translateY: showFinal ? 0 : at([0, 0.3, 0.44, 0.61, 0.8, 1], [0, 1, 0, -7, 1, 0]) },
      { scale: showFinal ? 1 : at([0, 0.3, 0.43, 0.59, 0.78, 1], [1, 0.97, 0.99, 1.045, 0.995, 1]) },
    ] }]}>
      {!showFinal && <Animated.View style={[styles.layer, { opacity: at([0, 0.4, 0.54, 1], [1, 1, 0, 0]) }]}>
        <PlantIllustration stage={growth.stage - 1} variant={growth.variant} pot={growth.garden.selectedPot} size={236} />
      </Animated.View>}
      <Animated.View style={[styles.layer, { opacity: showFinal ? 1 : at([0, 0.4, 0.55, 1], [0, 0, 1, 1]) }]}>
        <PlantIllustration stage={growth.stage} variant={growth.variant} pot={growth.garden.selectedPot} size={236} />
      </Animated.View>
    </Animated.View>
    {!showFinal && sparks.map((spark, index) => <Animated.View key={index} style={[styles.spark, {
      left: spark.left, top: spark.top,
      opacity: at([0, 0.39 + index * 0.025, 0.54 + index * 0.025, 0.9, 1], [0, 0, 0.85, 0, 0]),
      transform: [
        { translateX: at([0, 0.42, 1], [0, 0, spark.x]) },
        { translateY: at([0, 0.42, 1], [0, 0, spark.y]) },
        { scale: at([0, 0.4, 0.58, 1], [0.4, 0.4, 1, 0.65]) },
      ],
    }]}><Sparkle size={spark.size} color={index % 2 ? '#B69A61' : '#779D83'} fill={index % 2 ? '#F5ECD5' : colors.completedSoft} strokeWidth={1.2} /></Animated.View>)}
  </View>;
}

const styles = StyleSheet.create({
  scene: { width: 244, height: 244, alignItems: 'center', justifyContent: 'center', marginTop: 2, marginBottom: 2 },
  halo: { position: 'absolute', width: 192, height: 192, top: 20, borderRadius: 96, backgroundColor: '#EAF5E9' },
  ring: { position: 'absolute', width: 198, height: 198, top: 17, borderRadius: 99, borderWidth: 1, borderColor: '#B9D8B8' },
  plant: { width: 236, height: 236 },
  layer: { position: 'absolute', top: 0, left: 0 },
  spark: { position: 'absolute' },
});
