import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { BookOpen, ChevronDown, ExternalLink } from 'lucide-react-native';
import type { ProductInformation } from '../api/types';

type Props = {
  information?: ProductInformation;
  loading?: boolean;
  error?: string;
  onLoad?: () => void;
  showReferenceLabel?: boolean;
};

export default function ProductGuideCard({ information, loading, error, onLoad, showReferenceLabel }: Props) {
  const [showSources, setShowSources] = useState(false);
  const [showExtra, setShowExtra] = useState(false);
  const [sourceError, setSourceError] = useState('');
  const guide = information?.guidance;
  const sources = (guide?.sources ?? []).filter((source, index, all) => source.url.toLowerCase().startsWith('https://')
    && all.findIndex(item => item.title === source.title && item.url === source.url) === index);
  const hasGuide = sources.length > 0 && Boolean(guide?.overviewKo || guide?.routineTipKo || guide?.cautionKo);
  const reference = showReferenceLabel && information?.labelMatched ? information.referenceLabel : undefined;
  const hasExtra = Boolean(information?.otherIngredients?.length || information?.storageKo
    || reference?.servingBasisKo || reference?.suggestedUseKo);
  if (!hasGuide && !hasExtra && !onLoad) return null;
  async function openSource(url: string) {
    setSourceError('');
    try { await Linking.openURL(url); } catch { setSourceError('참고 자료를 열지 못했어요. 다시 시도해 주세요.'); }
  }
  return <View style={styles.card}>
    <View style={styles.heading}><View style={styles.icon}><BookOpen size={20} color="#385BCE" /></View>
      <Text style={styles.title}>알아두면 좋은 섭취 안내</Text></View>
    {hasGuide ? <>
      {guide?.overviewKo ? <Text style={styles.body}>{guide.overviewKo}</Text> : null}
      {guide?.routineTipKo ? <View style={styles.routine}><Text style={styles.label}>생활 속 복용 팁</Text><Text style={styles.body}>{guide.routineTipKo}</Text></View> : null}
      {guide?.cautionKo ? <View style={styles.caution}><Text style={styles.cautionLabel}>함께 확인해 주세요</Text><Text style={styles.cautionBody}>{guide.cautionKo}</Text></View> : null}
    </> : onLoad ? <>
      <Text style={styles.secondary}>제품과 성분을 이해하기 쉽게 설명하고, 일상에서 활용할 수 있는 복용 팁을 알려드려요.</Text>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: Boolean(loading) }} disabled={loading} onPress={onLoad} style={styles.load}>
        {loading ? <ActivityIndicator color="#385BCE" /> : null}<Text style={styles.loadText}>{loading ? '제품 안내를 준비하고 있어요' : '섭취 안내 확인'}</Text>
      </Pressable>
    </> : null}
    {hasExtra ? <>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: showExtra }} onPress={() => setShowExtra(value => !value)} style={styles.disclosure}>
        <Text style={styles.link}>제품의 추가 정보</Text><ChevronDown size={16} color="#64708C" /></Pressable>
      {showExtra ? <View style={styles.extra}>
        {reference ? <>
          <Text style={styles.label}>찾은 제품의 라벨 안내</Text>
          <Text style={styles.secondary}>갖고 있는 제품과 같은 규격인지 라벨을 확인해 주세요.</Text>
          {reference.servingBasisKo ? <Text style={styles.body}>{reference.servingBasisKo}</Text> : null}
          {reference.ingredients?.map((item, index) => <Text key={index} style={styles.body}>{item.name} · {[item.amount, item.unit].filter(Boolean).join(' ')}</Text>)}
          {reference.suggestedUseKo ? <Text style={styles.body}>{reference.suggestedUseKo}</Text> : null}
        </> : null}
        {information?.otherIngredients?.length ? <><Text style={styles.label}>기타 원료</Text><Text style={styles.secondary}>정제·캡슐 제조에 사용되는 원료로, 함량이 따로 표시되지 않을 수 있어요.</Text><Text style={styles.body}>{information.otherIngredients.join(', ')}</Text></> : null}
        {information?.storageKo ? <><Text style={styles.label}>보관 방법</Text><Text style={styles.body}>{information.storageKo}</Text></> : null}
      </View> : null}
    </> : null}
    {hasGuide ? <>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: showSources }} onPress={() => setShowSources(value => !value)} style={styles.disclosure}>
        <Text style={styles.link}>안내의 참고 자료</Text><ChevronDown size={16} color="#64708C" /></Pressable>
      {showSources ? sources.map(source => <Pressable key={source.url} accessibilityRole="link" onPress={() => void openSource(source.url)} style={styles.source}>
        <Text style={styles.sourceText}>{source.title}</Text><ExternalLink size={15} color="#385BCE" /></Pressable>) : null}
    </> : null}
    {error || sourceError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error || sourceError}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderColor: '#E2E7F1', borderWidth: 1, borderRadius: 22, padding: 20, gap: 16 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { backgroundColor: '#EAF0FF', width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#17234D', fontSize: 17, lineHeight: 24, fontWeight: '800', flex: 1 },
  body: { color: '#283650', fontSize: 15, lineHeight: 26 },
  label: { color: '#253F9A', fontSize: 13, lineHeight: 20, fontWeight: '800' },
  routine: { backgroundColor: '#F1F5FF', borderRadius: 14, padding: 15, gap: 7 },
  caution: { borderTopColor: '#E2E7F1', borderTopWidth: 1, paddingTop: 14, gap: 7 },
  cautionLabel: { color: '#826128', fontSize: 13, lineHeight: 20, fontWeight: '800' },
  cautionBody: { color: '#6D5C40', fontSize: 14, lineHeight: 24 },
  secondary: { color: '#64708C', fontSize: 13, lineHeight: 22 },
  load: { backgroundColor: '#EAF0FF', borderRadius: 12, minHeight: 48, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, paddingHorizontal: 12 },
  loadText: { color: '#385BCE', fontSize: 14, fontWeight: '800' },
  disclosure: { minHeight: 44, alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  link: { color: '#64708C', fontSize: 13, fontWeight: '700' },
  extra: { backgroundColor: '#F7F9FC', padding: 14, borderRadius: 12, gap: 9 },
  source: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  sourceText: { color: '#385BCE', fontSize: 13, lineHeight: 20, flex: 1 },
  error: { color: '#A63242', fontSize: 13, lineHeight: 22 },
});
