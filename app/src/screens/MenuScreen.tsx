import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Alert, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import {
  Bell,
  ChevronRight,
  CircleHelp,
  FileClock,
  History,
  LogOut,
  ScanSearch,
  Share2,
  ShieldCheck,
} from 'lucide-react-native';
import { useAuth } from '../auth/AuthContext';
import RitualAction from '../components/RitualAction';
import RitualSurface from '../components/RitualSurface';
import { colors, radius, spacing, type } from '../theme';
import { contentRailWidth } from '../utils/responsiveLayout';
import type { RootStackParamList } from '../navigation/AppNavigator';

type MenuRowProps = {
  icon: ReactNode;
  title: string;
  body: string;
  onPress: () => void;
  tone?: 'default' | 'danger';
};

type MenuInfo = {
  title: string;
  body: string;
  items: string[];
};

const menuInfo: Record<string, MenuInfo> = {
  notifications: {
    title: '알림 설정',
    body: '저장된 복용 시간에 맞춰 기기 알림을 예약합니다.',
    items: ['영양제 상세 화면에서 알림 시간을 바꿀 수 있어요.', '하루 여러 번 복용하면 시간마다 알림이 저장됩니다.', '기기 설정에 따라 알림 권한을 허용해야 합니다.'],
  },
  history: {
    title: '복용 기록',
    body: '복용 완료, 건너뛰기, 기록 취소 내역을 날짜별로 모아봅니다.',
    items: ['오늘과 제품 상세 화면의 기록이 기준입니다.', '기록을 수정하면 즉시 최신 상태를 반영합니다.', '향후 기간별 기록 보기로 확장할 예정입니다.'],
  },
  scans: {
    title: '스캔 기록',
    body: '라벨 촬영과 분석 결과를 다시 확인하는 공간입니다.',
    items: ['저장하지 않은 분석 결과는 임시 정보일 수 있어요.', '같은 제품을 다시 스캔해 비교할 수 있습니다.', '현재는 저장된 영양제 중심으로 표시합니다.'],
  },
  export: {
    title: '내보내기',
    body: '영양제 목록과 복용 기록을 파일로 정리하는 기능입니다.',
    items: ['병원 방문 전 복용 중인 제품을 정리할 수 있어요.', 'CSV 또는 PDF 형식으로 확장할 예정입니다.', '공유 전 개인 정보 포함 여부를 확인해 주세요.'],
  },
  safety: {
    title: '주의 성분',
    body: '알레르기와 주의 문구를 확인하고 관리하는 기능입니다.',
    items: ['스캔 결과의 주의 문구는 별도로 강조됩니다.', '인식 결과는 원본 라벨과 함께 확인해 주세요.', '의학적 진단이 아닌 참고 정보입니다.'],
  },
  about: {
    title: '앱 정보',
    body: 'PILL은 영양제 정보와 매일의 복용 기록을 관리하는 앱입니다.',
    items: ['AI 인식 결과는 원본 라벨과 대조해 주세요.', '복용 안내는 참고용이며 치료 효과를 판단하지 않습니다.', '스캔, 저장, 복용 체크 기능을 우선 제공합니다.'],
  },
};

export default function MenuScreen() {
  const { email, logout } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { width } = useWindowDimensions();
  const [activeInfo, setActiveInfo] = useState<MenuInfo | null>(null);

  const [showMore, setShowMore] = useState(false);

  function confirmLogout() {
    if (Platform.OS === 'web') {
      if (window.confirm('로그아웃할까요?')) void logout();
      return;
    }
    Alert.alert('로그아웃할까요?', '현재 기기에서 로그인 정보가 삭제됩니다.', [
      { text: '취소', style: 'cancel' },
      { text: '로그아웃', style: 'destructive', onPress: () => void logout() },
    ]);
  }

  async function openInstallGuide() {
    if (Platform.OS === 'web') {
      window.location.assign('/install.html');
      return;
    }
    try {
      await Linking.openURL('https://pill-web-production.up.railway.app/install.html');
    } catch {
      Alert.alert('설치 안내를 열 수 없어요', '네트워크 연결을 확인하고 다시 시도해 주세요.');
    }
  }

  function openAccountManagement() {
    setActiveInfo({
      title: '계정 관리',
      body: email ?? '현재 로그인된 PILL 계정',
      items: [
        '이 이메일은 PILL 로그인과 복용 기록 동기화 기준입니다.',
        '영양제 보관함과 복용 기록은 같은 계정에서 이어집니다.',
        '복용 알림은 기기별로 설정할 수 있습니다.',
        '이 기기에서 로그아웃하려면 메뉴 하단의 로그아웃을 이용해 주세요.',
      ],
    });
  }

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
        <View style={[styles.rail, { maxWidth: contentRailWidth(width) }]}>
          <View style={styles.header}>
            <Text style={styles.title}>설정</Text>
            <Text style={styles.subtitle}>알림과 복용 기록을 관리해요.</Text>
          </View>

          <RitualSurface padded={false} style={styles.profileCard}>
            <Pressable accessibilityRole="button" accessibilityLabel="계정 정보" onPress={openAccountManagement} style={styles.profileMain}>
              <View style={styles.avatar}><Text style={styles.profileInitial}>P</Text></View>
              <View style={styles.profileText}>
                <Text style={styles.profileName}>내 계정</Text>
                <Text numberOfLines={1} style={styles.email}>{email ?? '로그인됨'}</Text>
              </View>
              <ChevronRight size={19} color={colors.faint} />
            </Pressable>
          </RitualSurface>

          <MenuSection title="알림과 복용">
            <MenuRow
              icon={<Bell size={21} color={colors.active} strokeWidth={1.8} />}
              title="알림 설정"
              body="복용 시간에 맞춰 알림 받기"
              onPress={() => navigation.navigate('NotificationSettings')}
            />
            <MenuRow
              icon={<History size={21} color={colors.active} strokeWidth={1.8} />}
              title="복용 기록"
              body="날짜별 복용 내역 확인"
              onPress={() => navigation.navigate('DoseHistory')}
            />
          </MenuSection>

          <MenuSection title="설치와 공유">
            <MenuRow
              icon={<Share2 size={21} color={colors.active} strokeWidth={1.8} />}
              title="앱 설치 · 친구에게 공유"
              body="홈 화면 설치 안내와 공유 링크·QR"
              onPress={() => void openInstallGuide()}
            />
          </MenuSection>

          <Pressable accessibilityRole="button" accessibilityState={{ expanded: showMore }} onPress={() => setShowMore(!showMore)} style={styles.moreButton}>
            <Text style={styles.moreButtonText}>{showMore ? '기타 기능 접기 −' : '기타 기능 보기 +'}</Text>
          </Pressable>
          {showMore ? <>
          <MenuSection title="보관함 데이터">
            <MenuRow
              icon={<ScanSearch size={21} color={colors.inkSoft} strokeWidth={1.8} />}
              title="스캔 기록"
              body="이전 라벨 분석과 저장 여부 확인"
              onPress={() => navigation.navigate('ScanHistory')}
            />
            <MenuRow
              icon={<FileClock size={21} color={colors.inkSoft} strokeWidth={1.8} />}
              title="내보내기"
              body="복용 기록과 영양제 목록을 파일로 정리"
              onPress={() => navigation.navigate('ExportData')}
            />
          </MenuSection>

          <MenuSection title="안전과 안내">
            <MenuRow
              icon={<ShieldCheck size={21} color={colors.completed} strokeWidth={1.8} />}
              title="주의 성분"
              body="알레르기와 주의 문구를 확인"
              onPress={() => setActiveInfo(menuInfo.safety)}
            />
            <MenuRow
              icon={<CircleHelp size={21} color={colors.completed} strokeWidth={1.8} />}
              title="앱 정보"
              body="서비스와 데이터 안내"
              onPress={() => setActiveInfo(menuInfo.about)}
            />
          </MenuSection>

          </> : null}

          <View accessibilityLabel="로그아웃" accessibilityRole="summary" style={styles.logoutSection}>
            <RitualAction
              fullWidth
              icon={<LogOut size={19} color={colors.danger} strokeWidth={1.8} />}
              label="로그아웃"
              onPress={confirmLogout}
              tone="danger"
            />
          </View>
        </View>
      </ScrollView>

      <Modal animationType="fade" transparent visible={Boolean(activeInfo)} onRequestClose={() => setActiveInfo(null)}>
        <View style={styles.modalOverlay}>
          <RitualSurface accessibilityViewIsModal style={styles.modalCard}>
            <Text style={styles.modalTitle}>{activeInfo?.title}</Text>
            <Text style={styles.modalBody}>{activeInfo?.body}</Text>
            <View style={styles.modalList}>
              {activeInfo?.items.map((item) => (
                <View key={item} style={styles.modalItem}>
                  <View style={styles.modalDot} />
                  <Text style={styles.modalItemText}>{item}</Text>
                </View>
              ))}
            </View>
            <RitualAction fullWidth label="확인" onPress={() => setActiveInfo(null)} />
          </RitualSurface>
        </View>
      </Modal>
    </>
  );
}

function MenuSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View accessibilityLabel={title} accessibilityRole="summary" style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <RitualSurface padded={false} style={styles.sectionCard}>{children}</RitualSurface>
    </View>
  );
}

function MenuRow({ icon, title, body, onPress, tone = 'default' }: MenuRowProps) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={[styles.rowIcon, tone === 'danger' && styles.dangerIcon]}>{icon}</View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, tone === 'danger' && styles.dangerText]}>{title}</Text>
        <Text style={styles.rowBody}>{body}</Text>
      </View>
      <ChevronRight size={19} color={colors.faint} strokeWidth={1.8} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    padding: spacing.xl,
    paddingTop: 24,
    paddingBottom: 40,
  },
  rail: {
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    marginBottom: spacing.xl,
  },
  kicker: {
    color: colors.active,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.8,
    marginBottom: spacing.sm,
  },
  title: {
    ...type.hero,
    fontSize: 30,
    lineHeight: 38,
  },
  subtitle: {
    ...type.body,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  profileCard: {
    marginBottom: spacing.xl,
    overflow: 'hidden',
  },
  profileMain: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  profileInitial: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: '700',
  },
  profileText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  profileLabel: {
    color: colors.active,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  profileName: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '700',
  },
  email: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  accountStatusGrid: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    padding: spacing.md,
  },
  accountStatus: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    flexBasis: '46%',
    flexDirection: 'row',
    flexGrow: 1,
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  accountStatusIcon: {
    alignItems: 'center',
    backgroundColor: colors.activeSoft,
    borderRadius: 999,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  accountStatusText: {
    color: colors.inkSoft,
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  accountManageRow: {
    alignItems: 'center',
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 50,
    paddingHorizontal: spacing.lg,
  },
  accountManageText: {
    color: colors.active,
    fontSize: 13,
    fontWeight: '700',
  },
  section: {
    marginBottom: 28,
  },
  sectionEyebrow: {
    color: colors.active,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.6,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    ...type.section,
    marginBottom: spacing.sm,
  },
  sectionCard: {
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 78,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowIcon: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: radius.md,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  dangerIcon: {
    backgroundColor: colors.dangerSoft,
  },
  rowText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  rowTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '500',
  },
  dangerText: {
    color: colors.danger,
  },
  rowBody: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  moreButton: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: radius.lg,
    justifyContent: 'center',
    minHeight: 48,
    marginBottom: spacing.lg,
  },
  moreButtonText: { color: colors.active, fontSize: 13, fontWeight: '600' },
  logoutSection: {
    backgroundColor: colors.background,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  logoutEyebrow: {
    color: colors.danger,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  logoutTitle: {
    ...type.section,
  },
  logoutBody: {
    ...type.body,
    marginBottom: spacing.xs,
  },
  modalOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    gap: spacing.md,
    maxWidth: 560,
    width: '100%',
  },
  modalTitle: {
    ...type.title,
  },
  modalBody: {
    ...type.body,
    color: colors.inkSoft,
  },
  modalList: {
    gap: spacing.sm,
  },
  modalItem: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalDot: {
    backgroundColor: colors.active,
    borderRadius: 999,
    height: 6,
    marginTop: 7,
    width: 6,
  },
  modalItemText: {
    color: colors.inkSoft,
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.75,
  },
});
