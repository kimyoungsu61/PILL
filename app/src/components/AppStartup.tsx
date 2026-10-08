import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { brandMotion } from '../branding/brandMotion';
import { colors } from '../theme';
import BrandMark from './BrandMark';

export default function AppStartup({ children }: { children: ReactNode }) {
  const { isLoading } = useAuth();
  const [visible, setVisible] = useState(true);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [introComplete, setIntroComplete] = useState(false);
  const [showLoadingHint, setShowLoadingHint] = useState(false);
  const introFinished = useRef(false);
  const progress = useRef(new Animated.Value(0)).current;
  const markOpacity = useRef(new Animated.Value(0)).current;
  const wordOpacity = useRef(new Animated.Value(0)).current;
  const wordOffset = useRef(new Animated.Value(6)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const nativeDriver = Platform.OS !== 'web';

  useEffect(() => {
    let mounted = true;
    const update = (value: boolean) => { if (mounted) setReduceMotion(value); };
    void AccessibilityInfo.isReduceMotionEnabled().then(update).catch(() => update(true));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', update);
    return () => { mounted = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    if (reduceMotion === null || introFinished.current) return undefined;
    if (reduceMotion) {
      progress.setValue(1);
      markOpacity.setValue(1);
      wordOpacity.setValue(1);
      wordOffset.setValue(0);
      introFinished.current = true;
      setIntroComplete(true);
      return undefined;
    }
    const easing = Easing.out(Easing.cubic);
    const animation = Animated.parallel([
      Animated.timing(progress, { toValue: 1, delay: brandMotion.joinDelay, duration: brandMotion.joinDuration, useNativeDriver: nativeDriver, easing }),
      Animated.timing(markOpacity, { toValue: 1, duration: brandMotion.markFadeDuration, useNativeDriver: nativeDriver, easing }),
      Animated.timing(wordOpacity, { toValue: 1, delay: brandMotion.wordDelay, duration: brandMotion.wordFadeDuration, useNativeDriver: nativeDriver, easing }),
      Animated.timing(wordOffset, { toValue: 0, delay: brandMotion.wordDelay, duration: brandMotion.wordMoveDuration, useNativeDriver: nativeDriver, easing }),
      Animated.delay(brandMotion.minimumDuration),
    ]);
    animation.start(({ finished }) => {
      if (!finished) return;
      introFinished.current = true;
      setIntroComplete(true);
    });
    return () => animation.stop();
  }, [reduceMotion, markOpacity, nativeDriver, progress, wordOffset, wordOpacity]);

  useEffect(() => {
    if (!visible || isLoading || !introComplete) return undefined;
    if (reduceMotion) {
      setVisible(false);
      return undefined;
    }
    const fade = Animated.timing(overlayOpacity, {
      toValue: 0, duration: brandMotion.exitDuration, useNativeDriver: nativeDriver,
    });
    fade.start(({ finished }) => { if (finished) setVisible(false); });
    return () => fade.stop();
  }, [introComplete, isLoading, nativeDriver, overlayOpacity, reduceMotion, visible]);

  useEffect(() => {
    if (!visible) return undefined;
    const timer = setTimeout(() => setShowLoadingHint(true), brandMotion.slowConnectionHintDelay);
    return () => clearTimeout(timer);
  }, [visible]);

  return (
    <View style={styles.root}>
      <View style={styles.root} pointerEvents={visible ? 'none' : 'auto'}
        aria-hidden={visible} accessibilityElementsHidden={visible}
        importantForAccessibility={visible ? 'no-hide-descendants' : 'auto'}>
        {children}
      </View>
      {visible ? (
        <Animated.View testID="pill-startup" accessibilityRole="image"
          accessibilityLabel="PILL 시작 화면" style={[styles.overlay, { opacity: overlayOpacity }]}>
          <View style={styles.lockup}>
            <Animated.View style={{ opacity: markOpacity }}><BrandMark progress={progress} /></Animated.View>
            <Animated.Text style={[styles.wordmark, { opacity: wordOpacity, transform: [{ translateY: wordOffset }] }]}>PILL</Animated.Text>
          </View>
          {showLoadingHint && isLoading ? <Text style={styles.loadingHint}>PILL을 여는 중이에요</Text> : null}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  lockup: { alignItems: 'center', marginBottom: 36 },
  wordmark: { color: colors.ink, fontSize: 38, lineHeight: 57, fontWeight: '600', letterSpacing: 2.2, marginTop: 18, width: 180, textAlign: 'center' },
  loadingHint: { position: 'absolute', bottom: 48, color: colors.muted, fontSize: 13, lineHeight: 20 },
});
