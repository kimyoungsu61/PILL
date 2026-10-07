import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Camera, Clock3, Image as ImageIcon, Plus, Save, X } from 'lucide-react-native';
import { apiRequest } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import RitualAction from '../components/RitualAction';
import RitualSurface from '../components/RitualSurface';
import TimePickerField from '../components/TimePickerField';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { scheduleSupplementReminders } from '../notifications/doseReminderNotifications';
import { colors, radius, spacing, type } from '../theme';
import { contentRailWidth } from '../utils/responsiveLayout';
import { manualSupplementInitialValues, normalizeManualDoseTimes } from './ManualSupplementScreen.helpers';

type Props = NativeStackScreenProps<RootStackParamList, 'ManualSupplement'>;

export default function ManualSupplementScreen({ navigation, route }: Props) {
  const { token } = useAuth();
  const { width } = useWindowDimensions();
  const initialValues = manualSupplementInitialValues(route.params);
  const [brandName, setBrandName] = useState(initialValues.brandName);
  const [productName, setProductName] = useState(initialValues.productName);
  const [suggestedUseKo, setSuggestedUseKo] = useState(initialValues.suggestedUseKo);
  const [doseTimes, setDoseTimes] = useState(initialValues.doseTimes);
  const [imageUri, setImageUri] = useState(initialValues.imageUri);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  function updateDoseTime(index: number, value: string) {
    setDoseTimes((current) => current.map((time, timeIndex) => timeIndex === index ? value : time));
  }

  function addDoseTime() {
    setDoseTimes((current) => {
      if (current.length >= 3) {
        return current;
      }
      return [...current, ['09:00', '13:00', '19:00'][current.length] ?? '19:00'];
    });
  }

  function removeDoseTime(index: number) {
    setDoseTimes((current) => {
      if (current.length <= 1) {
        return current;
      }
      return current.filter((_, timeIndex) => timeIndex !== index);
    });
  }

  async function pickImageFromCamera() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('카메라 권한이 필요합니다.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ quality: 0.82 });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
      setError('');
    }
  }

  async function pickImageFromLibrary() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('앨범 접근 권한이 필요합니다.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.82 });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
      setError('');
    }
  }

  async function save() {
    if (!token) {
      setError('로그인이 필요합니다.');
      return;
    }
    if (!productName.trim()) {
      setError('제품명을 입력해 주세요.');
      return;
    }

    const normalizedTimes = normalizeManualDoseTimes(doseTimes);
    if (normalizedTimes.some((time) => !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))) {
      setError('알림 시간은 09:00 형식으로 입력해 주세요.');
      return;
    }

    setError('');
    setIsSaving(true);
    try {
      const supplementId = await apiRequest<number>('/api/supplements/manual', {
        method: 'POST',
        body: JSON.stringify({
          brandName,
          productName,
          suggestedUseKo,
          doseTimes: normalizedTimes,
          imageUri,
        }),
      }, token);
      try {
        await scheduleSupplementReminders({
          supplementId,
          productName,
          times: normalizedTimes,
        });
      } catch {
        // Registration should still succeed even if local notification scheduling fails.
      }
      navigation.reset({
        index: 1,
        routes: [
          { name: 'MainTabs', params: { screen: 'Supplements' } },
          { name: 'SupplementDetail', params: { supplementId } },
        ],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '영양제를 등록하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.rail, { maxWidth: contentRailWidth(width) }]}>
          <View style={styles.header}>
            <Text style={styles.kicker}>MANUAL ENTRY</Text>
            <Text style={styles.title}>직접 등록</Text>
            <Text style={styles.subtitle}>제품 정보와 복용 시간을 짧은 단계로 정리해 나의 보관함에 추가하세요.</Text>
          </View>

          <RitualSurface style={styles.surface}>
            <SurfaceHeading kicker="01 · PRODUCT PHOTO" title="제품 사진" />
            <View style={styles.imageRow}>
              {imageUri ? (
                <Image accessibilityLabel="등록할 영양제 사진" source={{ uri: imageUri }} style={styles.previewImage} />
              ) : (
                <View style={styles.emptyPreview}>
                  <ImageIcon size={28} color={colors.faint} strokeWidth={2.4} />
                </View>
              )}
              <View style={styles.imageCopy}>
                <Text style={styles.imageBody}>사진은 보관함과 오늘의 복용 카드에서 제품을 구분하는 데 사용됩니다.</Text>
                <View style={styles.imageActions}>
                  <Pressable accessibilityLabel="제품 사진 촬영" accessibilityRole="button" onPress={pickImageFromCamera} style={({ pressed }) => [styles.imageActionButton, pressed && styles.pressed]}>
                    <Camera size={16} color={colors.active} strokeWidth={2.5} />
                    <Text style={styles.imageActionText}>촬영</Text>
                  </Pressable>
                  <Pressable accessibilityLabel="앨범에서 제품 사진 선택" accessibilityRole="button" onPress={pickImageFromLibrary} style={({ pressed }) => [styles.imageActionButton, pressed && styles.pressed]}>
                    <ImageIcon size={16} color={colors.active} strokeWidth={2.5} />
                    <Text style={styles.imageActionText}>앨범</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </RitualSurface>

          <RitualSurface style={styles.surface}>
            <SurfaceHeading kicker="02 · IDENTITY" title="제품 정보" />
            <Text style={styles.label}>브랜드</Text>
            <TextInput accessibilityLabel="브랜드" onChangeText={setBrandName} placeholder="예: 종근당" placeholderTextColor={colors.faint} style={styles.input} value={brandName} />
            <Text style={styles.label}>제품명</Text>
            <TextInput accessibilityLabel="제품명" onChangeText={setProductName} placeholder="제품명을 입력하세요" placeholderTextColor={colors.faint} style={styles.input} value={productName} />
            <Text style={styles.label}>복용 안내</Text>
            <TextInput accessibilityLabel="복용 안내" multiline onChangeText={setSuggestedUseKo} placeholder="예: 하루 1캡슐, 식후 복용" placeholderTextColor={colors.faint} style={styles.textArea} value={suggestedUseKo} />
          </RitualSurface>

          <RitualSurface style={styles.surface}>
            <View style={styles.sectionHeader}>
              <SurfaceHeading kicker="03 · SCHEDULE" title="알림 시간" />
              <Text style={styles.meta}>최대 3번</Text>
            </View>
            {doseTimes.map((time, index) => (
              <View key={`manual-dose-time-${index}`} style={styles.timeRow}>
                <View style={styles.timeIcon}>
                  <Clock3 size={17} color={colors.active} strokeWidth={2.4} />
                </View>
                <TimePickerField value={time} onChange={(value) => updateDoseTime(index, value)} />
                <Pressable
                  accessibilityLabel={`${index + 1}번째 알림 삭제`}
                  accessibilityRole="button"
                  disabled={doseTimes.length <= 1}
                  onPress={() => removeDoseTime(index)}
                  style={({ pressed }) => [styles.iconButton, doseTimes.length <= 1 && styles.disabledIconButton, pressed && styles.pressed]}
                >
                  <X size={16} color={doseTimes.length <= 1 ? colors.faint : colors.danger} strokeWidth={2.5} />
                </Pressable>
              </View>
            ))}
            <RitualAction
              disabled={doseTimes.length >= 3}
              fullWidth
              icon={<Plus color={doseTimes.length >= 3 ? colors.faint : colors.ink} size={17} strokeWidth={2.5} />}
              label="알림 추가"
              onPress={addDoseTime}
              tone="secondary"
            />
          </RitualSurface>

          {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}

          <RitualAction
            fullWidth
            icon={<Save color={colors.primaryText} size={18} strokeWidth={2.5} />}
            label="보관함에 등록"
            loading={isSaving}
            onPress={() => void save()}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SurfaceHeading({ kicker, title }: { kicker: string; title: string }) {
  return (
    <View style={styles.surfaceHeading}>
      <Text style={styles.surfaceKicker}>{kicker}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: 112,
  },
  rail: {
    alignSelf: 'center',
    gap: spacing.lg,
    width: '100%',
  },
  header: {
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  kicker: {
    color: colors.active,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2.2,
  },
  title: {
    ...type.hero,
    fontSize: 30,
    lineHeight: 38,
  },
  subtitle: {
    ...type.body,
    color: colors.inkSoft,
  },
  surface: {
    gap: spacing.md,
  },
  surfaceHeading: {
    flex: 1,
    gap: spacing.xs,
  },
  surfaceKicker: {
    color: colors.active,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  sectionTitle: {
    ...type.section,
  },
  imageRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  previewImage: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    height: 82,
    width: 82,
  },
  emptyPreview: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    height: 82,
    justifyContent: 'center',
    width: 82,
  },
  imageCopy: {
    flex: 1,
    gap: spacing.sm,
    minWidth: 0,
  },
  imageBody: {
    ...type.body,
  },
  imageActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  imageActionButton: {
    alignItems: 'center',
    backgroundColor: colors.activeSoft,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  imageActionText: {
    color: colors.active,
    fontSize: 13,
    fontWeight: '900',
  },
  label: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: '900',
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  textArea: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 98,
    padding: spacing.md,
    textAlignVertical: 'top',
  },
  sectionHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  meta: {
    ...type.meta,
    paddingTop: spacing.xs,
  },
  timeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  timeIcon: {
    alignItems: 'center',
    backgroundColor: colors.activeSoft,
    borderRadius: radius.md,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  disabledIconButton: {
    backgroundColor: colors.surfaceMuted,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.78,
  },
});
