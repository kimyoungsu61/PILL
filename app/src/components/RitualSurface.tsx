import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { colors, radius, shadow, spacing } from '../theme';

type RitualSurfaceProps = Omit<ViewProps, 'children' | 'style'> &
  PropsWithChildren<{
    variant?: 'default' | 'active' | 'warning';
    padded?: boolean;
    style?: StyleProp<ViewStyle>;
  }>;

export default function RitualSurface({
  children,
  padded = true,
  style,
  variant = 'default',
  ...viewProps
}: RitualSurfaceProps) {
  return (
    <View
      {...viewProps}
      style={[
        styles.surface,
        variant === 'active' && styles.active,
        variant === 'warning' && styles.warning,
        padded && styles.padded,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    ...shadow.card,
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.xl,
    borderWidth: 0,
  },
  active: {
    backgroundColor: colors.surface,
    borderColor: colors.activeSoft,
  },
  warning: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warningSoft,
  },
  padded: {
    padding: spacing.lg,
  },
});
