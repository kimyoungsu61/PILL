import { StyleSheet, Text, View } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { colors, radius, spacing, type } from '../theme';

type Props = {
  title?: string;
  message?: string;
};

const SAFETY_NOTICE = '스캔한 라벨과 성분을 바탕으로 제공하는 참고 정보입니다. 질병의 진단이나 치료 효과를 판단하지 않으며, 건강 상태와 복용 중인 약에 따라 전문가 상담이 필요할 수 있습니다.';

export default function WarningCard({ title = '주의 정보', message }: Props) {
  const visibleTitle = message ? title : '안전 안내';
  const accessibilityText = `${visibleTitle}. ${message ? `${message}. ` : ''}${SAFETY_NOTICE}`;

  return (
    <View accessibilityLabel={accessibilityText} accessibilityRole="alert" style={styles.card}>
      <View style={styles.header}>
        <View style={styles.icon}>
          <AlertTriangle size={17} color={colors.warning} strokeWidth={2.4} />
        </View>
        <Text style={styles.title}>{visibleTitle}</Text>
      </View>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <Text style={styles.notice}>{SAFETY_NOTICE}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.warningSoft,
    borderColor: '#F4E2C6',
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  icon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 999,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  title: {
    color: colors.warning,
    fontSize: 15,
    fontWeight: '700',
  },
  message: {
    ...type.body,
    color: colors.inkSoft,
  },
  notice: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
});
