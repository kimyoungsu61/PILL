import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { capsulePaths, capsuleSecondary } from '../branding/brandMotion';
import { colors } from '../theme';

type Props = { size?: number; progress?: Animated.Value };

export default function BrandMark({ size = 112, progress }: Props) {
  const scale = size / 112;
  const translate = (from: number, to: number) => progress
    ? progress.interpolate({ inputRange: [0, 1], outputRange: [from * scale, to * scale] })
    : to * scale;
  return (
    <View style={{ width: size, height: size }} accessible={false}>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [
        { translateX: translate(11, 1.2) }, { translateY: translate(-11, -1.2) },
      ] }]}>
        <Svg width={size} height={size} viewBox="0 0 112 112">
          <Path d={capsulePaths.upper} fill={colors.primary} />
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [
        { translateX: translate(-11, -1.2) }, { translateY: translate(11, 1.2) },
      ] }]}>
        <Svg width={size} height={size} viewBox="0 0 112 112">
          <Path d={capsulePaths.lower} fill={capsuleSecondary} />
        </Svg>
      </Animated.View>
    </View>
  );
}
