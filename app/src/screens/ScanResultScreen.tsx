import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AlertCircle, Bell, ChevronDown, ChevronRight, Clock3, ExternalLink, List, Pencil, Plus, RotateCcw, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiRequest } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import TimePickerField from '../components/TimePickerField';
import IngredientEditor from '../components/IngredientEditor';
import ProductGuideCard from '../components/ProductGuideCard';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { scheduleSupplementReminders } from '../notifications/doseReminderNotifications';
import { contentRailWidth } from '../utils/responsiveLayout';
import { cleanScanText, doseCountSummaryText, doseTimeSummaryText, ingredientAmountText } from './ScanResultScreen.helpers';
import { scanResultPresentation } from './scanResultPresentation';

type Props = NativeStackScreenProps<RootStackParamList, 'ScanResult'>;

const palette = {
  canvas: '#F5F7FC', surface: '#FFFFFF', ink: '#17234D', muted: '#64708C', faint: '#8993A9',
  cobalt: '#385BCE', cobaltDeep: '#253F9A', cobaltSoft: '#EAF0FF', line: '#E2E7F1',
  amber: '#9A631A', amberSoft: '#FFF4E5', white: '#FFFFFF',
};

export default function ScanResultScreen({ navigation, route }: Props) {
  const { token } = useAuth();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { result, imageUri } = route.params;
  const presentation = useMemo(() => scanResultPresentation(result), [result]);
  const [brandName, setBrandName] = useState(presentation.brandName);
  const [productName, setProductName] = useState(presentation.productName);
  const [suggestedUseKo, setSuggestedUseKo] = useState(cleanScanText(presentation.suggestedUseKo));
  const suggestedUseOriginal = cleanScanText(presentation.suggestedUseOriginal);
  const [warningsKo, setWarningsKo] = useState(cleanScanText(presentation.warningsKo));

  const originalLabelText = cleanScanText(presentation.originalLabelText);
  const [ingredients, setIngredients] = useState(presentation.ingredients);
  const [servingBasisKo, setServingBasisKo] = useState(presentation.servingBasisKo);
  const [showIngredientEditor, setShowIngredientEditor] = useState(false);
  const [saveMissing, setSaveMissing] = useState<string[]>([]);
  const [doseTimes, setDoseTimes] = useState(() => initialDoseTimes(
    result.recommendedDoseTime, presentation.suggestedUseKo, presentation.suggestedUseOriginal,
  ));
  const [showEdit, setShowEdit] = useState(false);
  const [showTimes, setShowTimes] = useState(false);
  const [showSources, setShowSources] = useState(false);

  const [showIngredients, setShowIngredients] = useState(false);
  const [showFullWarnings, setShowFullWarnings] = useState(false);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const previewIngredients = ingredients.slice(0, 4);
  const hasMoreIngredients = ingredients.length > previewIngredients.length;

  function updateDoseTime(index: number, value: string) {
    setDoseTimes((current) => current.map((time, i) => i === index ? value : time));
  }

  function addDoseTime() {
    setDoseTimes((current) => current.length >= 3 ? current : [
      ...current, defaultDoseTime(current.length, current.length + 1),
    ]);
  }

  function removeDoseTime(index: number) {
    setDoseTimes((current) => current.length <= 1 ? current : current.filter((_, i) => i !== index));
  }

  function openManualRegistration() {
    navigation.navigate('ManualSupplement', { brandName, productName, suggestedUseKo, doseTimes, imageUri });
  }

  function requestSave() {
    if (!productName.trim()) {
      setShowEdit(true);
      setError('제품명을 입력한 뒤 저장해 주세요.');
      return;
    }
    const missing = [
      !suggestedUseKo.trim() ? '섭취 방법' : '',
      ingredients.length && !servingBasisKo.trim() ? '함량 기준' : '',
      !ingredients.length ? '성분 정보' : '',
    ].filter(Boolean);
    if (missing.length) {
      setSaveMissing(missing);
      return;
    }
    void save();
  }

  async function save() {
    if (!token) {
      setError('로그인이 필요합니다.');
      return;
    }
    const normalizedTimes = doseTimes.map((time) => time.trim()).filter(Boolean);
    setError('');
    setIsSaving(true);
    try {
      const supplementId = await apiRequest<number>(`/api/scans/${result.scanId}/confirmed`, {
        method: 'PUT',
        body: JSON.stringify({
          brandName, productName, suggestedUseKo, suggestedUseOriginal,
          summaryKo: [brandName, productName].filter(Boolean).join(' '),
          originalLabelText, warningSummary: warningsKo,
          confirmedDoseTime: normalizedTimes.join(','), ingredients, imageUri, servingBasisKo,
        }),
      }, token);

      if (Platform.OS !== 'web') try {
        const notificationResult = await scheduleSupplementReminders({
          supplementId, productName, times: normalizedTimes,
        });
        if (notificationResult.permissionStatus !== 'granted') {
          Alert.alert('알림 권한이 꺼져 있어요', '영양제는 저장됐지만 복용 알림은 예약하지 못했습니다. 기기 설정에서 알림 권한을 켜주세요.');
        }
      } catch {
        Alert.alert('알림 예약 실패', '영양제는 저장됐지만 이 기기의 복용 알림 예약에 실패했습니다.');
      }

      navigation.reset({
        index: 1,
        routes: [{ name: 'MainTabs' }, { name: 'SupplementDetail', params: { supplementId } }],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  }

  async function openSource(url: string) {
    if (!/^https:\/\//i.test(url)) return;
    try { await Linking.openURL(url); } catch { setError('출처를 열지 못했어요. 다시 시도해 주세요.'); }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.rail, { maxWidth: contentRailWidth(width) }]}>
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={styles.heroBadge}><Text style={styles.heroBadgeText}>제품 정보</Text></View>
              <Pressable accessibilityRole="button" accessibilityLabel="제품 정보 수정" accessibilityState={{ expanded: showEdit }} onPress={() => setShowEdit((value) => !value)} style={styles.heroEdit}>
                <Pencil size={14} color={palette.white} />
                <Text style={styles.heroEditText}>정보 수정</Text>
              </Pressable>
            </View>
            <View style={styles.heroMain}>
              {imageUri
                ? <Image accessibilityLabel="촬영한 제품 사진" source={{ uri: imageUri }} style={styles.productImage} />
                : <View style={styles.imagePlaceholder}><Text style={styles.imagePlaceholderText}>PILL</Text></View>}
              <View style={styles.heroCopy}>
                <Text style={styles.heroBrand}>{brandName || '회사·브랜드 정보 미입력'}</Text>
                <Text style={styles.heroName}>{productName || '제품명을 확인해 주세요'}</Text>

              </View>
            </View>
          </View>

          <View style={styles.evidenceBar}>
            <View style={styles.evidenceDot} />
            <Text style={styles.evidenceText}>저장 전 제품 라벨과 성분·함량을 확인해 주세요.</Text>
          </View>

          {showEdit ? <View style={styles.card}>
            <Text style={styles.cardTitle}>제품 정보 수정</Text>
            <Text style={styles.inputLabel}>회사·브랜드</Text>
            <TextInput accessibilityLabel="회사·브랜드" maxLength={255} onChangeText={setBrandName} placeholder="회사 또는 브랜드명" placeholderTextColor={palette.faint} style={styles.input} value={brandName} />
            <Text style={styles.inputLabel}>제품명</Text>
            <TextInput accessibilityLabel="제품명" maxLength={255} onChangeText={setProductName} placeholder="제품명" placeholderTextColor={palette.faint} style={styles.input} value={productName} />
            <Text style={styles.inputLabel}>섭취 방법</Text>
            <TextInput accessibilityLabel="섭취 방법" maxLength={10000} multiline onChangeText={setSuggestedUseKo} placeholder="복용 안내를 입력하세요" placeholderTextColor={palette.faint} style={styles.textArea} value={suggestedUseKo} />
            <Text style={styles.inputLabel}>주의사항</Text>
            <TextInput accessibilityLabel="주의사항" maxLength={10000} multiline onChangeText={setWarningsKo} placeholder="주의사항을 입력하세요" placeholderTextColor={palette.faint} style={styles.textArea} value={warningsKo} />
          </View> : null}

          <View style={styles.card}>
            <View style={styles.cardHeading}>
              <View style={styles.iconTile}><Clock3 size={19} color={palette.cobalt} strokeWidth={2.3} /></View>
              <View style={styles.headingCopy}>
                <Text style={styles.cardTitle}>섭취 방법</Text>
              </View>
            </View>
            <Text style={styles.doseText}>{suggestedUseKo || '제품 라벨의 섭취 방법을 입력해 주세요.'}</Text>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: showTimes }} onPress={() => setShowTimes((value) => !value)} style={styles.reminderRow}>
              <Bell size={18} color={palette.cobalt} strokeWidth={2.3} />
              <View style={styles.reminderCopy}>
                <Text style={styles.reminderLabel}>복용 알림 · {doseCountSummaryText(doseTimes)}</Text>
                <Text style={styles.reminderTime}>{doseTimeSummaryText(doseTimes)}</Text>
              </View>
              <ChevronDown size={18} color={palette.cobalt} />
            </Pressable>
            {showTimes ? <View style={styles.timeEditor}>
              <Text style={styles.secondaryText}>원하는 시간으로 바꿀 수 있어요.</Text>
              {doseTimes.map((time, index) => <View key={`time-${index}`} style={styles.timeRow}>
                <View style={styles.timeField}><TimePickerField label={`${index + 1}번째 알림`} onChange={(value) => updateDoseTime(index, value)} value={time} /></View>
                <Pressable accessibilityLabel={`${index + 1}번째 알림 삭제`} accessibilityRole="button" accessibilityState={{ disabled: doseTimes.length <= 1 }} disabled={doseTimes.length <= 1} onPress={() => removeDoseTime(index)} style={styles.removeTime}>
                  <X size={17} color={doseTimes.length <= 1 ? palette.faint : palette.muted} />
                </Pressable>
              </View>)}
              {doseTimes.length < 3 ? <Pressable accessibilityRole="button" onPress={addDoseTime} style={styles.addTime}>
                <Plus size={16} color={palette.cobalt} /><Text style={styles.addTimeText}>알림 시간 추가</Text>
              </Pressable> : null}
            </View> : null}
          </View>

          <ProductGuideCard information={presentation.productInformation} />

          <View style={styles.card}>
            <View style={styles.cardHeading}>
              <View style={styles.iconTile}><List size={19} color={palette.cobalt} strokeWidth={2.3} /></View>
              <View style={styles.headingCopy}>
                <Text style={styles.cardTitle}>성분 및 함량</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="성분 및 함량 수정" onPress={() => setShowIngredientEditor(true)} style={styles.editIngredients}><Pencil size={14} color={palette.cobalt} /><Text style={styles.countText}>수정</Text></Pressable>
            </View>
            <Text style={styles.basisText}>{servingBasisKo ? `함량 기준 · ${servingBasisKo}` : '함량 기준을 입력해 주세요'}</Text>
            {ingredients.length ? previewIngredients.map((ingredient, index) => <View key={`${ingredient.name}-${index}`} style={[styles.ingredientRow, index === previewIngredients.length - 1 && styles.lastRow]}>
              <Text style={styles.ingredientName}>{ingredient.name || '성분명 미상'}</Text>
              <Text style={styles.ingredientAmount}>{ingredientAmountText(ingredient)}</Text>
            </View>) : <Text style={styles.emptyText}>성분 정보가 없습니다. 수정에서 성분을 추가할 수 있습니다.</Text>}
            {hasMoreIngredients ? <Pressable accessibilityRole="button" accessibilityLabel={`전체 성분 ${ingredients.length}개 보기`} onPress={() => setShowIngredients(true)} style={styles.allIngredientsButton}>
              <Text style={styles.allIngredientsText}>전체 성분 {ingredients.length}개 보기</Text>
              <ChevronRight size={17} color={palette.cobalt} />
            </Pressable> : null}

          </View>

          {warningsKo ? <View style={styles.cautionCard}>
            <View style={styles.cautionHeading}><AlertCircle size={20} color={palette.amber} /><Text style={styles.cautionTitle}>섭취 시 주의사항</Text></View>
            <Text numberOfLines={warningsKo.length > 180 && !showFullWarnings ? 3 : undefined} style={styles.cautionText}>{warningsKo}</Text>
            {warningsKo.length > 180 ? <Pressable accessibilityRole="button" accessibilityState={{ expanded: showFullWarnings }} onPress={() => setShowFullWarnings((value) => !value)}>
              <Text style={styles.cautionMore}>{showFullWarnings ? '접기' : '주의사항 전체 보기'}</Text>
            </Pressable> : null}
          </View> : null}

          {!presentation.hasWebDetails ? <Pressable accessibilityRole="button" onPress={() => navigation.navigate('ImageInput')} style={styles.morePhoto}>
            <RotateCcw size={18} color={palette.cobalt} /><Text style={styles.morePhotoText}>다른 사진 추가하고 다시 분석</Text><ChevronRight size={17} color={palette.cobalt} />
          </Pressable> : null}

          {presentation.sources.length ? <Pressable accessibilityRole="button" accessibilityState={{ expanded: showSources }} onPress={() => setShowSources((value) => !value)} style={styles.disclosure}>
            <Text style={styles.disclosureText}>참고 자료</Text>
            <ChevronDown size={17} color={palette.muted} />
          </Pressable> : null}
          {showSources ? <View style={styles.detailCard}>

            {presentation.sources.length ? presentation.sources.map((source) => <Pressable key={source.url} accessibilityRole="link" onPress={() => void openSource(source.url)} style={styles.sourceRow}>
              <Text numberOfLines={1} style={styles.sourceText}>{source.title}</Text><ExternalLink size={15} color={palette.cobalt} />
            </Pressable>) : <Text style={styles.secondaryText}>표시할 출처가 없어요.</Text>}
          </View> : null}


          <Pressable accessibilityRole="button" onPress={openManualRegistration} style={styles.manualLink}>
            <Text style={styles.manualLinkText}>찾은 제품이 다른가요? 직접 입력하기</Text><ChevronRight size={16} color={palette.cobalt} />
          </Pressable>
          {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 6 }]}>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: isSaving }} disabled={isSaving} onPress={requestSave} style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}>
          {isSaving ? <ActivityIndicator color={palette.white} /> : <Text style={styles.saveText}>내 영양제로 저장하기</Text>}
          {!isSaving ? <ChevronRight size={20} color={palette.white} /> : null}
        </Pressable>
      </View>
      {showIngredientEditor ? <IngredientEditor ingredients={ingredients} servingBasisKo={servingBasisKo} width={width} onClose={() => setShowIngredientEditor(false)} onApply={(items, basis) => { setIngredients(items); setServingBasisKo(basis); setShowIngredientEditor(false); }} /> : null}
      <Modal animationType="fade" transparent visible={saveMissing.length > 0} onRequestClose={() => setSaveMissing([])}>
        <View style={styles.confirmOverlay}><View style={styles.confirmCard}>
          <Text style={styles.cardTitle}>미입력 정보 확인</Text>
          <Text style={styles.secondaryText}>{saveMissing.join(' · ')} 정보가 없습니다. 미입력 상태로 저장하시겠습니까?</Text>
          <Pressable accessibilityRole="button" onPress={() => setSaveMissing([])} style={styles.allIngredientsButton}><Text style={styles.allIngredientsText}>정보 확인하기</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => { setSaveMissing([]); void save(); }} style={styles.saveButton}><Text style={styles.saveText}>미입력 상태로 저장</Text></Pressable>
        </View></View>
      </Modal>
      <Modal animationType="slide" onRequestClose={() => setShowIngredients(false)} visible={showIngredients}>
        <View style={[styles.modalScreen, { paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={[styles.modalRail, { maxWidth: contentRailWidth(width) }]}>
            <View style={styles.modalHeader}>
              <View>

                <Text style={styles.modalTitle}>전체 성분 {ingredients.length}개</Text>
              </View>
              <Pressable accessibilityLabel="전체 성분 닫기" accessibilityRole="button" onPress={() => setShowIngredients(false)} style={styles.modalClose}>
                <X size={20} color={palette.ink} />
              </Pressable>
            </View>
            {servingBasisKo ? <Text style={styles.modalBasis}>함량 기준 · {servingBasisKo}</Text> : null}
            <ScrollView contentContainerStyle={styles.modalList} style={styles.modalScroll}>
              {ingredients.map((ingredient, index) => <View key={`${ingredient.name}-${index}`} style={styles.modalIngredientRow}>
                <Text style={styles.ingredientName}>{ingredient.name || '성분명 미상'}</Text>
                <Text style={styles.ingredientAmount}>{ingredientAmountText(ingredient)}</Text>
              </View>)}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function initialDoseTimes(recommendedTime?: string, ...contexts: Array<string | undefined>) {
  const times = Array.from(new Set(recommendedTime?.match(/(?:[01]\d|2[0-3]):[0-5]\d/g) ?? []));
  if (!times.length) times.push('09:00');
  const context = contexts.join(' ').toLowerCase();
  const count = /하루\s*3\s*번|1일\s*3\s*회|three times|3 times|thrice/.test(context) ? 3
    : /하루\s*(2|두)\s*번|1일\s*2\s*회|twice|two times|2 times/.test(context) ? 2 : 1;
  while (times.length < count && times.length < 3) {
    const next = defaultDoseTime(times.length, count);
    if (times.includes(next)) break;
    times.push(next);
  }
  return times;
}

function defaultDoseTime(index: number, count: number) {
  return count >= 3 ? ['09:00', '13:00', '19:00'][index] ?? '19:00'
    : ['09:00', '19:00'][index] ?? '19:00';
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.canvas },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28 },
  rail: { alignSelf: 'center', width: '100%', gap: 14 },
  hero: { backgroundColor: palette.cobaltDeep, borderRadius: 22, padding: 18, gap: 12 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroBadge: { backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5 },
  heroBadgeText: { color: palette.white, fontSize: 11, fontWeight: '800' },
  heroEdit: { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 4 },
  heroEditText: { color: palette.white, fontSize: 12, fontWeight: '700' },
  heroMain: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  productImage: { width: 74, height: 86, borderRadius: 12, backgroundColor: '#E8EAF2' },
  imagePlaceholder: { width: 74, height: 86, borderRadius: 12, backgroundColor: '#CED9FF', alignItems: 'center', justifyContent: 'center' },
  imagePlaceholderText: { color: palette.cobaltDeep, fontWeight: '900' },
  heroCopy: { flex: 1, gap: 5 },
  heroBrand: { color: '#C4D2FF', fontSize: 12, fontWeight: '800' },
  heroName: { color: palette.white, fontSize: 19, lineHeight: 24, fontWeight: '900' },
  heroHint: { color: '#D5DEFB', fontSize: 11, lineHeight: 16, marginTop: 2 },
  evidenceBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 3 },
  evidenceDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.cobalt },
  evidenceText: { flex: 1, color: palette.muted, fontSize: 12, lineHeight: 18 },
  card: { backgroundColor: palette.surface, borderColor: palette.line, borderWidth: 1, borderRadius: 20, padding: 16, gap: 10 },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 3 },
  iconTile: { width: 38, height: 38, borderRadius: 12, backgroundColor: palette.cobaltSoft, alignItems: 'center', justifyContent: 'center' },
  headingCopy: { flex: 1, gap: 1 },
  cardTitle: { color: palette.ink, fontSize: 17, fontWeight: '900' },
  doseText: { color: palette.ink, fontSize: 16, lineHeight: 24, fontWeight: '700' },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 13, backgroundColor: palette.cobaltSoft, padding: 13 },
  reminderCopy: { flex: 1, gap: 2 },
  reminderLabel: { color: palette.muted, fontSize: 11, fontWeight: '700' },
  reminderTime: { color: palette.cobaltDeep, fontSize: 15, fontWeight: '900' },
  timeEditor: { gap: 10, paddingTop: 3 },
  secondaryText: { color: palette.muted, fontSize: 12, lineHeight: 18 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeField: { flex: 1 },
  removeTime: { width: 42, height: 42, borderRadius: 12, backgroundColor: palette.canvas, alignItems: 'center', justifyContent: 'center' },
  addTime: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7 },
  addTimeText: { color: palette.cobalt, fontSize: 13, fontWeight: '800' },
  editIngredients: { minHeight: 44, paddingHorizontal: 6, flexDirection: 'row', alignItems: 'center', gap: 5 },
  confirmOverlay: { flex: 1, backgroundColor: 'rgba(23,35,77,0.35)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  confirmCard: { width: '100%', maxWidth: 440, backgroundColor: palette.white, borderRadius: 18, padding: 20, gap: 14 },
  countText: { color: palette.cobalt, fontSize: 12, fontWeight: '800' },
  basisText: { color: palette.muted, fontSize: 12 },
  ingredientRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderBottomColor: palette.line, borderBottomWidth: 1, paddingVertical: 9 },
  lastRow: { borderBottomWidth: 0, paddingBottom: 0 },
  ingredientName: { color: palette.ink, fontSize: 14, lineHeight: 20, fontWeight: '700', flex: 1 },
  ingredientAmount: { color: palette.cobaltDeep, fontSize: 14, fontWeight: '900', textAlign: 'right' },
  allIngredientsButton: { alignItems: 'center', backgroundColor: palette.cobaltSoft, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', minHeight: 44, paddingHorizontal: 13, marginTop: 3 },
  allIngredientsText: { color: palette.cobalt, fontSize: 13, fontWeight: '800' },
  emptyText: { color: palette.muted, fontSize: 13, lineHeight: 19 },
  cautionCard: { backgroundColor: palette.amberSoft, borderColor: '#F4E2C6', borderWidth: 1, borderRadius: 18, padding: 17, gap: 8 },
  cautionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cautionTitle: { color: palette.amber, fontSize: 14, fontWeight: '900' },
  cautionText: { color: '#745128', fontSize: 13, lineHeight: 20 },
  cautionMore: { color: palette.amber, fontSize: 12, fontWeight: '800', paddingVertical: 4 },
  morePhoto: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: palette.cobaltSoft, borderRadius: 15, padding: 15 },
  morePhotoText: { flex: 1, color: palette.cobaltDeep, fontSize: 13, fontWeight: '800' },
  disclosure: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 3 },
  disclosureText: { color: palette.muted, fontSize: 13, fontWeight: '700' },
  detailCard: { backgroundColor: palette.surface, borderColor: palette.line, borderWidth: 1, borderRadius: 16, padding: 16, gap: 9 },
  detailIntro: { color: palette.muted, fontSize: 12, lineHeight: 18, marginBottom: 3 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderTopColor: palette.line, borderTopWidth: 1 },
  sourceText: { flex: 1, color: palette.cobalt, fontSize: 13 },
  manualLink: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 2, paddingVertical: 12 },
  manualLinkText: { color: palette.cobalt, fontSize: 13, fontWeight: '800' },
  inputLabel: { color: palette.ink, fontSize: 12, fontWeight: '800' },
  input: { borderColor: palette.line, borderWidth: 1, borderRadius: 11, minHeight: 45, paddingHorizontal: 12, color: palette.ink, fontSize: 14 },
  textArea: { borderColor: palette.line, borderWidth: 1, borderRadius: 11, minHeight: 68, padding: 12, color: palette.ink, fontSize: 14, textAlignVertical: 'top' },
  error: { color: '#B24242', fontSize: 13, lineHeight: 19 },
  footer: { backgroundColor: palette.white, borderTopColor: palette.line, borderTopWidth: 1, paddingHorizontal: 20, paddingTop: 10 },
  saveButton: { minHeight: 54, borderRadius: 15, backgroundColor: palette.cobalt, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveText: { color: palette.white, fontSize: 15, fontWeight: '900' },
  modalScreen: { backgroundColor: palette.canvas, flex: 1, paddingHorizontal: 20 },
  modalRail: { alignSelf: 'center', flex: 1, width: '100%', gap: 13 },
  modalHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10 },
  modalKicker: { color: palette.cobalt, fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 5 },
  modalTitle: { color: palette.ink, fontSize: 23, fontWeight: '900' },
  modalClose: { alignItems: 'center', backgroundColor: palette.cobaltSoft, borderRadius: 12, height: 42, justifyContent: 'center', width: 42 },
  modalBasis: { color: palette.muted, fontSize: 12 },
  modalScroll: { backgroundColor: palette.surface, borderColor: palette.line, borderRadius: 18, borderWidth: 1, flex: 1 },
  modalList: { paddingHorizontal: 16, paddingVertical: 6 },
  modalIngredientRow: { alignItems: 'flex-start', borderBottomColor: palette.line, borderBottomWidth: 1, flexDirection: 'row', gap: 12, paddingVertical: 15 },
  pressed: { opacity: 0.78 },
});
