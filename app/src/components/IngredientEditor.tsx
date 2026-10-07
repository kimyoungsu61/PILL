import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Plus, Trash2, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ScanIngredient } from '../api/types';
import { contentRailWidth } from '../utils/responsiveLayout';
import { createIngredientDraft, editIngredientField, finishIngredientDraft, MAX_INGREDIENTS, newIngredientDraft } from '../screens/ingredientEditing';

type Props = {
  ingredients: ScanIngredient[];
  servingBasisKo: string;
  width: number;
  onClose: () => void;
  onApply: (ingredients: ScanIngredient[], servingBasisKo: string) => void;
};
const ink = '#17234D';
const cobalt = '#385BCE';

export default function IngredientEditor({ ingredients, servingBasisKo, width, onClose, onApply }: Props) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(() => createIngredientDraft(ingredients));
  const [basis, setBasis] = useState(servingBasisKo);
  const [error, setError] = useState('');
  const [invalidIndex, setInvalidIndex] = useState<number>();
  const nextKey = useRef(ingredients.length);
  const scrollRef = useRef<ScrollView>(null);

  function update(key: number, field: 'name' | 'amount' | 'unit', value: string) {
    setDraft(current => current.map(item => item.key === key ? editIngredientField(item, field, value) : item));
    setError(''); setInvalidIndex(undefined);
  }

  function apply() {
    const result = finishIngredientDraft(draft, basis);
    if (!result.ok) { setError(result.message); setInvalidIndex(result.invalidIndex); return; }
    onApply(result.ingredients, result.servingBasisKo);
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen" visible>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
        <View style={[styles.rail, { maxWidth: contentRailWidth(width), paddingTop: Math.max(insets.top, 12) }]}>
          <View style={styles.header}>
            <View style={styles.heading}>
              <Text style={styles.title}>성분 및 함량 수정</Text>
              <Text style={styles.subtitle}>제품 라벨에 표시된 정보로 수정해 주세요.</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="성분 수정 취소" onPress={onClose} style={styles.close}><X color={ink} size={20} /></Pressable>
          </View>
          <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.basisCard}>
              <Text style={styles.label}>함량 기준</Text>
              <TextInput accessibilityLabel="함량 기준" maxLength={255} onChangeText={setBasis} placeholder="예: 1정당, 2캡슐당, 1포당" placeholderTextColor="#8993A9" style={styles.input} value={basis} />
              <Text style={styles.help}>제품 성분표에 표시된 기준량을 입력해 주세요.</Text>
            </View>
            <View style={styles.listHeading}><Text style={styles.sectionTitle}>성분 목록</Text><Text style={styles.count}>{draft.length}개</Text></View>
            {draft.map((item, index) => (
              <View key={item.key} style={[styles.ingredient, invalidIndex === index && styles.invalid]}>
                <View style={styles.row}>
                  <Text style={styles.number}>성분 {index + 1}</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel={`${index + 1}번째 성분 삭제`} onPress={() => { setDraft(current => current.filter(row => row.key !== item.key)); setError(''); setInvalidIndex(undefined); }} style={styles.delete}><Trash2 color="#64708C" size={18} /></Pressable>
                </View>
                <Text style={styles.label}>성분명</Text>
                <TextInput accessibilityLabel={`${index + 1}번째 성분명`} maxLength={255} onChangeText={value => update(item.key, 'name', value)} placeholder="성분명" placeholderTextColor="#8993A9" style={styles.input} value={item.name} />
                <View style={styles.amountRow}>
                  <View style={styles.amountField}><Text style={styles.label}>함량</Text><TextInput accessibilityLabel={`${index + 1}번째 함량`} maxLength={80} onChangeText={value => update(item.key, 'amount', value)} placeholder="예: 500" placeholderTextColor="#8993A9" style={styles.input} value={item.amount} /></View>
                  <View style={styles.unitField}><Text style={styles.label}>단위</Text><TextInput accessibilityLabel={`${index + 1}번째 단위`} autoCapitalize="none" autoCorrect={false} maxLength={40} onChangeText={value => update(item.key, 'unit', value)} placeholder="예: mg" placeholderTextColor="#8993A9" style={styles.input} value={item.unit} /></View>
                </View>
              </View>
            ))}
            {!draft.length ? <Text style={styles.empty}>등록할 성분을 추가해 주세요.</Text> : null}
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: draft.length >= MAX_INGREDIENTS }} disabled={draft.length >= MAX_INGREDIENTS} onPress={() => { const key = nextKey.current++; setDraft(current => [...current, newIngredientDraft(key)]); setError(''); setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100); }} style={[styles.add, draft.length >= MAX_INGREDIENTS && styles.disabled]}><Plus color={cobalt} size={18} /><Text style={styles.addText}>성분 추가</Text></Pressable>
          </ScrollView>
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
            <View style={styles.actions}>
              <Pressable accessibilityRole="button" onPress={onClose} style={styles.cancel}><Text style={styles.cancelText}>취소</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={apply} style={styles.apply}><Text style={styles.applyText}>수정 내용 적용</Text></Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F7FC' },
  rail: { alignSelf: 'center', flex: 1, width: '100%' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, paddingBottom: 16 },
  heading: { flex: 1, gap: 6 }, title: { color: ink, fontSize: 21, lineHeight: 28, fontWeight: '600' },
  subtitle: { color: '#64708C', fontSize: 12, lineHeight: 18 }, close: { height: 44, width: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF0FF' },
  content: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 },
  basisCard: { gap: 8, padding: 16, backgroundColor: '#FFFFFF', borderColor: '#E2E7F1', borderWidth: 1, borderRadius: 16 },
  label: { color: ink, fontSize: 12, fontWeight: '700', marginBottom: 4 },
  input: { borderColor: '#D9E0EF', borderWidth: 1, borderRadius: 10, minHeight: 46, paddingHorizontal: 12, fontSize: 14, color: ink, backgroundColor: '#FFFFFF' },
  help: { color: '#64708C', fontSize: 12, lineHeight: 18 },
  listHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }, sectionTitle: { color: ink, fontSize: 16, fontWeight: '600' }, count: { color: '#64708C', fontSize: 12 },
  ingredient: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E7F1', padding: 16, gap: 7 },
  invalid: { borderColor: '#B24242' }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, number: { color: '#64708C', fontSize: 12, fontWeight: '700' },
  delete: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  amountRow: { flexDirection: 'row', gap: 10, paddingTop: 6 }, amountField: { flex: 1 }, unitField: { flex: 1 },
  empty: { color: '#64708C', fontSize: 13, paddingVertical: 20, textAlign: 'center' },
  add: { minHeight: 48, borderWidth: 1, borderColor: '#C9D5FA', borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#EAF0FF' }, addText: { color: cobalt, fontSize: 14, fontWeight: '700' }, disabled: { opacity: 0.45 },
  footer: { backgroundColor: '#FFFFFF', borderTopWidth: 1, borderColor: '#E2E7F1', paddingHorizontal: 20, paddingTop: 12, gap: 10 }, actions: { flexDirection: 'row', gap: 10 },
  cancel: { minHeight: 50, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#F0F3F9' }, cancelText: { color: ink, fontSize: 14, fontWeight: '700' },
  apply: { minHeight: 50, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: cobalt }, applyText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  error: { color: '#B24242', fontSize: 12, lineHeight: 18 },
});
