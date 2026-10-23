import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Check, LockKeyhole, RefreshCw } from 'lucide-react-native';
import { readGarden, saveGardenStyle } from '../garden/requests';
import { useAuth } from '../auth/AuthContext';
import RitualAction from '../components/RitualAction';
import RitualSurface from '../components/RitualSurface';
import PlantIllustration from '../garden/PlantIllustration';
import StampMark from '../garden/StampMark';
import type { GardenPot, GardenStamp, GardenState } from '../garden/types';
import { colors, radius, spacing, type } from '../theme';

const pots: { key: GardenPot; label: string; at: number }[] = [
  { key: 'clay', label: '토분', at: 0 },
  { key: 'cloud', label: '구름', at: 7 },
  { key: 'sage', label: '새잎', at: 14 },
  { key: 'ink', label: '밤', at: 21 },
];
const stamps: { key: GardenStamp; label: string; at: number }[] = [
  { key: 'leaf', label: '잎', at: 0 },
  { key: 'flower', label: '꽃', at: 7 },
  { key: 'sun', label: '햇살', at: 14 },
  { key: 'star', label: '별', at: 21 },
];
type Choice = { pot: GardenPot; stamp: GardenStamp };
type GardenError = { kind: 'load' } | { kind: 'save'; choice: Choice };

export default function GardenScreen() {
  const { token } = useAuth();
  const [snapshot, setSnapshot] = useState<{ owner: string; garden: GardenState } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Choice | null>(null);
  const [error, setError] = useState<GardenError | null>(null);
  const [savedMessage, setSavedMessage] = useState('');
  const tokenRef = useRef(token);
  const activeRef = useRef(false);
  const focusGeneration = useRef(0);
  const requestNumber = useRef(0);
  const saveInFlight = useRef(false);
  const saveOperation = useRef(0);
  const reloadAfterSave = useRef<() => Promise<void>>(async () => {});
  tokenRef.current = token;
  const garden = snapshot?.owner === token ? snapshot.garden : null;

  const loadGarden = useCallback(async () => {
    if (!token || !activeRef.current || saveInFlight.current) return;
    const generation = focusGeneration.current;
    const request = ++requestNumber.current;
    const current = () => activeRef.current
      && tokenRef.current === token
      && focusGeneration.current === generation
      && requestNumber.current === request;
    setLoading(true);
    setError(null);
    setSavedMessage('');
    try {
      const response = await readGarden(token);
      if (current()) setSnapshot({ owner: token, garden: response });
    } catch {
      if (current()) setError({ kind: 'load' });
    } finally {
      if (current()) setLoading(false);
    }
  }, [token]);
  reloadAfterSave.current = loadGarden;

  useFocusEffect(useCallback(() => {
    activeRef.current = true;
    focusGeneration.current += 1;
    // A native-stack screen can blur and refocus while its PUT is still running.
    // Keep that operation locked until it settles, then load its final server state.
    if (!saveInFlight.current) setSaving(null);
    if (!token) {
      setSnapshot(null);
      setLoading(false);
      setError(null);
      setSavedMessage('');
    } else {
      void loadGarden();
    }
    return () => {
      activeRef.current = false;
      focusGeneration.current += 1;
      requestNumber.current += 1;
    };
  }, [loadGarden, token]));

  async function saveStyle(choice: Choice) {
    if (!token || !garden || !activeRef.current || loading || saveInFlight.current) return;
    const pot = pots.find(item => item.key === choice.pot);
    const stamp = stamps.find(item => item.key === choice.stamp);
    if (!pot || !stamp || garden.totalStamps < pot.at || garden.totalStamps < stamp.at) return;
    if (garden.selectedPot === choice.pot && garden.selectedStamp === choice.stamp) return;
    const changingPot = garden.selectedPot !== choice.pot;
    const generation = focusGeneration.current;
    const request = ++requestNumber.current;
    const operation = ++saveOperation.current;
    const current = () => activeRef.current
      && tokenRef.current === token
      && focusGeneration.current === generation
      && requestNumber.current === request;
    saveInFlight.current = true;
    setSaving(choice);
    setError(null);
    setSavedMessage('');
    try {
      const response = await saveGardenStyle(token, choice);
      if (current()) {
        setSnapshot({ owner: token, garden: response });
        const applied = response.selectedPot === choice.pot && response.selectedStamp === choice.stamp;
        if (applied) setSavedMessage(changingPot ? '화분을 바꿨어요.' : '스탬프를 바꿨어요.');
        else setError({ kind: 'save', choice });
      }
    } catch {
      if (current()) setError({ kind: 'save', choice });
    } finally {
      if (saveOperation.current === operation) {
        saveInFlight.current = false;
        if (activeRef.current) {
          setSaving(null);
          if (!current()) void reloadAfterSave.current();
        }
      }
    }
  }

  if (!garden) {
    return (
      <View style={styles.emptyScreen}>
        {loading ? (
          <>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.body}>정원을 불러오고 있어요.</Text>
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>정원에 연결하지 못했어요</Text>
            <Text style={styles.body}>잠시 후 다시 시도해 주세요.</Text>
            <RitualAction label="다시 불러오기" onPress={() => void loadGarden()} tone="secondary" />
          </>
        )}
      </View>
    );
  }

  const count = garden.cycleStamps;
  const variant = (garden.completedPlants % 3) as 0 | 1 | 2;
  const collectionStart = Math.max(0, garden.completedPlants - 6);
  const collection = Array.from({ length: Math.min(garden.completedPlants, 6) }, (_, index) => collectionStart + index);
  const isBusy = loading || saving !== null;
  const growthTitle = count === 0
    ? garden.completedPlants > 0 ? '새로운 씨앗을 심었어요' : '작은 씨앗부터 시작해요'
    : count <= 2 ? '새잎이 고개를 내밀어요'
      : count <= 4 ? '조금씩 푸르러지고 있어요'
        : '이제 한 뼘 더 자라면 돼요';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.rail}>
        <View style={styles.intro}>
          <View style={styles.introHeading}>
            <Text style={styles.heading}>내가 챙긴 하루가{'\n'}차곡차곡 자라요</Text>
            <View style={styles.totalCount}>
              <Text style={styles.totalValue}>{garden.totalStamps}</Text>
              <Text style={styles.meta}>모은 스탬프</Text>
            </View>
          </View>
          <Text style={styles.body}>하루를 쉬어도, 자란 만큼 그대로예요.</Text>
        </View>

        {error?.kind === 'load' && (
          <View style={styles.loadError} accessibilityLiveRegion="polite">
            <Text style={[styles.body, styles.errorText]}>최근 기록을 불러오지 못했어요.</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="정원 다시 불러오기"
              disabled={isBusy}
              onPress={() => void loadGarden()}
              style={styles.reloadButton}
            >
              <RefreshCw size={18} color={colors.primary} />
              <Text style={styles.linkText}>다시 시도</Text>
            </Pressable>
          </View>
        )}

        <RitualSurface style={styles.growthCard}>
          <View style={styles.plantHeading}>
            <Text style={styles.eyebrow}>{garden.completedPlants + 1}번째 식물</Text>
            {loading && <ActivityIndicator size="small" color={colors.primary} accessibilityLabel="최근 기록 확인 중" />}
          </View>
          <View style={styles.plantIllustration}>
            <PlantIllustration stage={count} variant={variant} pot={garden.selectedPot} size={212} />
          </View>
          <Text style={styles.growthTitle}>{growthTitle}</Text>
          <Text style={styles.growthDescription}>스탬프 {7 - count}개를 더 모으면 식물이 완성돼요.</Text>
          <View style={styles.stampRow}>
            {Array.from({ length: 7 }, (_, index) => (
              <View
                key={index}
                accessible
                accessibilityLabel={`${index + 1}번째 스탬프, ${index < count ? '모았어요' : '아직 모으지 않았어요'}`}
                style={styles.stampSlot}
              >
                <View style={[styles.stampDisc, index < count && styles.stampDiscFilled]}>
                  {index < count ? <StampMark kind={garden.selectedStamp} filled size={23} /> : null}
                </View>
                <Text style={[styles.stampNumber, index < count && styles.stampNumberFilled]}>{index + 1}</Text>
              </View>
            ))}
          </View>
          <View style={styles.todayNote}>
            {garden.todayEarned && <Check size={15} color={colors.completed} strokeWidth={2.5} />}
            <Text style={[styles.todayText, garden.todayEarned && styles.todayEarned]}>
              {garden.todayEarned ? '오늘의 스탬프가 담겼어요' : '오늘의 상태를 모두 기록하면 스탬프 하나'}
            </Text>
          </View>
        </RitualSurface>

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>내 취향으로 꾸미기</Text>
            {saving && <ActivityIndicator size="small" color={colors.primary} accessibilityLabel="꾸미기 저장 중" />}
          </View>
          <Text style={styles.sectionDescription}>
            {garden.totalStamps < 21
              ? '스탬프 7개마다 새로운 화분과 도장을 받아요.'
              : '모든 화분과 도장을 모았어요. 마음에 드는 걸 골라보세요.'}
          </Text>
          <RitualSurface style={styles.styleCard}>
            <Text style={styles.choiceHeading}>화분</Text>
            <View style={styles.choiceRow}>
              {pots.map(item => {
                const unlocked = garden.totalStamps >= item.at;
                const selected = garden.selectedPot === item.key;
                return (
                  <Pressable
                    key={item.key}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.label} 화분${!unlocked ? `, 스탬프 ${item.at - garden.totalStamps}개 더 모으면 열려요` : ''}`}
                    accessibilityState={{ selected, disabled: !unlocked || isBusy }}
                    disabled={!unlocked || isBusy}
                    onPress={() => void saveStyle({ pot: item.key, stamp: garden.selectedStamp })}
                    style={styles.choice}
                  >
                    <View style={[styles.choicePreview, selected && styles.selectedPreview, !unlocked && styles.lockedPreview]}>
                      <PlantIllustration stage={0} variant={0} pot={item.key} size={65} />
                      {selected && <View style={styles.selectedCheck}><Check size={11} color={colors.white} strokeWidth={3} /></View>}
                    </View>
                    <Text style={[styles.choiceLabel, selected && styles.selectedLabel]}>{item.label}</Text>
                    <View style={styles.unlockNote}>
                      {!unlocked && <LockKeyhole size={10} color={colors.faint} />}
                      <Text style={styles.unlockText}>{unlocked ? selected ? '사용 중' : '선택하기' : `${item.at - garden.totalStamps}개 더`}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.divider} />
            <Text style={styles.choiceHeading}>스탬프</Text>
            <View style={styles.choiceRow}>
              {stamps.map(item => {
                const unlocked = garden.totalStamps >= item.at;
                const selected = garden.selectedStamp === item.key;
                return (
                  <Pressable
                    key={item.key}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.label} 스탬프${!unlocked ? `, 스탬프 ${item.at - garden.totalStamps}개 더 모으면 열려요` : ''}`}
                    accessibilityState={{ selected, disabled: !unlocked || isBusy }}
                    disabled={!unlocked || isBusy}
                    onPress={() => void saveStyle({ pot: garden.selectedPot, stamp: item.key })}
                    style={styles.choice}
                  >
                    <View style={[styles.choicePreview, selected && styles.selectedPreview, !unlocked && styles.lockedPreview]}>
                      <StampMark kind={item.key} filled size={34} color={selected ? colors.primary : colors.completed} />
                      {selected && <View style={styles.selectedCheck}><Check size={11} color={colors.white} strokeWidth={3} /></View>}
                    </View>
                    <Text style={[styles.choiceLabel, selected && styles.selectedLabel]}>{item.label}</Text>
                    <View style={styles.unlockNote}>
                      {!unlocked && <LockKeyhole size={10} color={colors.faint} />}
                      <Text style={styles.unlockText}>{unlocked ? selected ? '사용 중' : '선택하기' : `${item.at - garden.totalStamps}개 더`}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {error?.kind === 'save' ? (
              <View style={styles.saveError} accessibilityLiveRegion="polite">
                <Text style={[styles.body, styles.errorText]}>꾸미기를 저장하지 못했어요. 다시 시도해 주세요.</Text>
                <RitualAction
                  label="다시 저장"
                  tone="secondary"
                  loading={saving !== null}
                  disabled={loading}
                  onPress={() => void saveStyle(error.choice)}
                />
              </View>
            ) : (
              <Text accessibilityLiveRegion="polite" style={styles.savedMessage}>
                {saving ? '꾸미기를 저장하고 있어요.' : savedMessage}
              </Text>
            )}
          </RitualSurface>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>함께 키운 식물</Text>
            <Text style={styles.collectionCount}>{garden.completedPlants}개</Text>
          </View>
          {collection.length === 0 ? (
            <RitualSurface style={styles.collectionEmpty}>
              <Text style={styles.collectionEmptyTitle}>첫 식물이 머물 자리를 비워뒀어요</Text>
              <Text style={styles.body}>기록한 날 일곱 번을 모으면, 여기에 함께 남아요.</Text>
            </RitualSurface>
          ) : (
            <>
              <View style={styles.collectionGrid}>
                {collection.map(index => (
                  <RitualSurface key={index} style={styles.collectionItem}>
                    <PlantIllustration stage={7} variant={(index % 3) as 0 | 1 | 2} pot={garden.selectedPot} size={116} />
                    <Text style={styles.collectionName}>{index + 1}번째 식물</Text>
                    <Text style={styles.meta}>{(index + 1) * 7}일의 기록</Text>
                  </RitualSurface>
                ))}
              </View>
              {garden.completedPlants > 6 && <Text style={styles.collectionFootnote}>최근 함께 키운 식물 6개를 보여드려요.</Text>}
            </>
          )}
        </View>

        <View style={styles.explainer}>
          <Text style={styles.explainerTitle}>나의 속도로, 하루씩</Text>
          <Text style={styles.body}>
            먹었는지, 못 먹었는지, 기억이 안 나는지 하루의 상태를 모두 기록하면 스탬프를 하나 받아요. 어떤 답이든 식물은 똑같이 자라요. 일곱 개를 모으면 식물 하나가 완성돼요.
          </Text>
          <Text style={styles.explainerFootnote}>스탬프는 하루에 하나예요. 기록을 나중에 고치거나 지워도 받은 스탬프와 화분은 그대로 남아요.</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: 48 },
  rail: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: spacing.xxl },
  emptyScreen: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xxl },
  intro: { gap: spacing.sm },
  introHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.lg },
  heading: { ...type.hero, fontSize: 26, lineHeight: 35, flex: 1 },
  body: { ...type.body },
  meta: { ...type.meta },
  totalCount: { alignItems: 'flex-end', gap: 2 },
  totalValue: { fontSize: 27, lineHeight: 34, fontWeight: '700', fontVariant: ['tabular-nums'], color: colors.primary },
  loadError: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' },
  errorText: { color: colors.danger },
  reloadButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 6 },
  linkText: { ...type.actionLabel, color: colors.primary },
  growthCard: { padding: spacing.xl, paddingBottom: spacing.lg },
  plantHeading: { minHeight: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { ...type.meta, color: colors.inkSoft, fontWeight: '600' },
  plantIllustration: { alignItems: 'center', paddingTop: 6, paddingBottom: 4 },
  growthTitle: { ...type.section, textAlign: 'center', marginTop: spacing.sm, lineHeight: 25 },
  growthDescription: { ...type.meta, textAlign: 'center', marginTop: 6 },
  stampRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xxl, gap: 3 },
  stampSlot: { flex: 1, alignItems: 'center', gap: 6 },
  stampDisc: { width: 32, height: 32, borderRadius: 16, borderColor: colors.line, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stampDiscFilled: { backgroundColor: colors.completedSoft, borderColor: colors.completedSoft },
  stampNumber: { ...type.meta, color: colors.faint, fontSize: 10 },
  stampNumberFilled: { color: colors.completed },
  todayNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderTopColor: colors.line, borderTopWidth: 1, paddingTop: spacing.lg, marginTop: spacing.xl },
  todayText: { ...type.meta, textAlign: 'center', flexShrink: 1 },
  todayEarned: { color: colors.completed },
  section: { gap: spacing.md },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  sectionTitle: { ...type.section },
  sectionDescription: { ...type.meta, marginTop: -4 },
  styleCard: { padding: spacing.lg },
  choiceHeading: { ...type.body, fontWeight: '600', color: colors.inkSoft, marginBottom: spacing.md },
  choiceRow: { flexDirection: 'row', gap: spacing.sm },
  choice: { flex: 1, minWidth: 0, alignItems: 'center' },
  choicePreview: { width: '100%', height: 66, backgroundColor: colors.surfaceMuted, borderWidth: 1.5, borderColor: 'transparent', borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  selectedPreview: { backgroundColor: colors.activeSoft, borderColor: colors.primary },
  lockedPreview: { opacity: 0.42 },
  selectedCheck: { position: 'absolute', right: 4, top: 4, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  choiceLabel: { ...type.meta, fontSize: 12, color: colors.inkSoft, marginTop: spacing.sm },
  selectedLabel: { color: colors.primary, fontWeight: '700' },
  unlockNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, marginTop: 2 },
  unlockText: { ...type.meta, color: colors.faint, fontSize: 10 },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: spacing.xl },
  savedMessage: { ...type.meta, color: colors.completed, textAlign: 'center', marginTop: spacing.md, minHeight: 18 },
  saveError: { marginTop: spacing.lg, gap: spacing.sm },
  collectionCount: { ...type.meta, color: colors.inkSoft },
  collectionEmpty: { padding: spacing.xl, gap: spacing.sm },
  collectionEmptyTitle: { ...type.body, color: colors.inkSoft, fontWeight: '600' },
  collectionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  collectionItem: { width: '47.5%', alignItems: 'center', padding: spacing.md, paddingBottom: spacing.lg },
  collectionName: { ...type.body, fontWeight: '600', color: colors.inkSoft },
  collectionFootnote: { ...type.meta, textAlign: 'center' },
  explainer: { paddingHorizontal: 2, gap: spacing.sm, paddingBottom: spacing.md },
  explainerTitle: { ...type.body, fontWeight: '600', color: colors.inkSoft },
  explainerFootnote: { ...type.meta },
});
