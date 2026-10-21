import Svg, { Circle, G, Path } from 'react-native-svg';
import { colors } from '../theme';

type Props = {
  kind?: 'leaf' | 'flower' | 'sun' | 'star';
  filled?: boolean;
  size?: number;
  color?: string;
};

/** Compact collected marks; the surrounding button supplies its label. */
export default function StampMark({ kind = 'leaf', filled = false, size = 24, color = colors.completed }: Props) {
  const fill = filled ? color : 'none';
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      <G stroke={color} strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round">
        {kind === 'leaf' && (
          <G>
            <Path d="M9 23C4 12 13 6 26 6C26 20 20 26 9 23Z" fill={fill} fillOpacity={0.14} />
            <Path d="M6 27L22 11 M12 21L12 15 M16 17L22 17" fill="none" />
          </G>
        )}
        {kind === 'flower' && (
          <G>
            <Path d="M16 10C10 1 5 8 10 13C-1 14 4 23 11 20C11 31 21 29 21 21C30 27 33 17 24 14C32 7 22 2 19 11C18 10 17 10 16 10Z" fill={fill} fillOpacity={0.14} />
            <Circle cx={17} cy={16} r={3.2} fill={filled ? color : 'none'} strokeWidth={1.4} />
          </G>
        )}
        {kind === 'sun' && (
          <G>
            <Circle cx={16} cy={16} r={6.1} fill={fill} fillOpacity={0.14} />
            <Path d="M16 3V5 M16 27V29 M3 16H5 M27 16H29 M6.8 6.8L8.3 8.3 M23.7 23.7L25.2 25.2 M6.8 25.2L8.3 23.7 M23.7 8.3L25.2 6.8" fill="none" />
          </G>
        )}
        {kind === 'star' && (
          <Path d="M16 4C18 12 20 14 28 16C20 18 18 20 16 28C14 20 12 18 4 16C12 14 14 12 16 4Z" fill={fill} fillOpacity={0.14} />
        )}
      </G>
    </Svg>
  );
}
