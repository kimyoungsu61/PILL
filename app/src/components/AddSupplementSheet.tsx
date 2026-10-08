import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera, ChevronRight, PenLine, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onScan: () => void;
  onManual: () => void;
};

export default function AddSupplementSheet({ visible, onClose, onScan, onManual }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable accessibilityLabel="추가 메뉴 닫기" onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) + 18 }]}>
          <View style={styles.handle} />
          <View style={styles.heading}>
            <View>
              <Text style={styles.title}>영양제 추가</Text>
              <Text style={styles.subtitle}>라벨을 찍으면 제품 정보를 정리해 드려요.</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={onClose} style={styles.close}>
              <X size={20} color={colors.ink} />
            </Pressable>
          </View>
          <Pressable accessibilityRole="button" onPress={onScan} style={({ pressed }) => [styles.option, styles.primaryOption, pressed && styles.pressed]}>
            <View style={[styles.optionIcon, styles.primaryIcon]}><Camera size={23} color={colors.white} strokeWidth={2.3} /></View>
            <View style={styles.optionCopy}>
              <Text style={[styles.optionTitle, styles.primaryTitle]}>제품 촬영하기</Text>
              <Text style={[styles.optionBody, styles.primaryBody]}>앞면 또는 뒷면 사진으로 시작해요</Text>
            </View>
            <ChevronRight size={20} color={colors.white} />
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onManual} style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
            <View style={styles.optionIcon}><PenLine size={23} color={colors.active} strokeWidth={2.3} /></View>
            <View style={styles.optionCopy}>
              <Text style={styles.optionTitle}>직접 입력하기</Text>
              <Text style={styles.optionBody}>제품명과 복용 시간을 직접 정해요</Text>
            </View>
            <ChevronRight size={20} color={colors.faint} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(17,30,69,0.48)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 22, paddingTop: 10, gap: 10 },
  handle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 4, backgroundColor: colors.line, marginBottom: 10 },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
  title: { color: colors.ink, fontSize: 25, fontWeight: '700', letterSpacing: -0.6 },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 6 },
  close: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.surfaceMuted },
  option: { minHeight: 82, borderRadius: 18, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 13 },
  primaryOption: { backgroundColor: colors.active, borderColor: colors.active },
  optionIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: colors.activeSoft, alignItems: 'center', justifyContent: 'center' },
  primaryIcon: { backgroundColor: 'rgba(255,255,255,0.18)' },
  optionCopy: { flex: 1, minWidth: 0, gap: 4 },
  optionTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  optionBody: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  primaryTitle: { color: colors.white },
  primaryBody: { color: '#E0E7FF' },
  pressed: { opacity: 0.68 },
});
