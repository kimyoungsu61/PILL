import { StyleSheet, Text } from 'react-native';
import { colors, radius, spacing } from '../theme';

export default function FieldReviewBadge({ show }: { show: boolean }) {
  if (!show) {
    return null;
  }

  return (
    <Text accessibilityLabel="정확한지 확인이 필요한 정보입니다" accessibilityRole="text" style={styles.badge}>
      확인 필요
    </Text>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
