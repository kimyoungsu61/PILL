import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronRight, Clock3, Plus, Search } from 'lucide-react-native';
import { apiRequest } from '../api/client';
import type { HomeResponse } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import AddSupplementSheet from '../components/AddSupplementSheet';
import SupplementThumb from '../components/SupplementThumb';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme';
import { contentRailWidth } from '../utils/responsiveLayout';
import { filterSupplementsForSearch } from './SupplementsScreen.helpers';

type RootNavigation = NativeStackNavigationProp<RootStackParamList>;

export default function SupplementsScreen() {
  const navigation = useNavigation<RootNavigation>();
  const { token } = useAuth();
  const { width } = useWindowDimensions();
  const [home, setHome] = useState<HomeResponse>({ supplements: [], todayDoses: [] });
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const filteredSupplements = filterSupplementsForSearch(home.supplements, query);

  const loadHome = useCallback(async () => {
    if (!token) return;
    setError('');
    setIsLoading(true);
    try {
      setHome(await apiRequest<HomeResponse>('/api/home', {}, token));
    } catch (err) {
      setError(err instanceof Error ? err.message : '영양제 목록을 불러오지 못했어요.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { void loadHome(); }, [loadHome]));

  function openAdd(destination: 'ImageInput' | 'ManualSupplement') {
    setShowAdd(false);
    navigation.navigate(destination);
  }

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} style={styles.screen}
        refreshControl={<RefreshControl refreshing={isLoading} tintColor={colors.active} onRefresh={() => void loadHome()} />}>
        <View style={[styles.rail, { maxWidth: contentRailWidth(width) }]}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>내 영양제 & 루틴</Text>
              <Text style={styles.subtitle}>제품과 복용 시간을 한눈에 확인해요.</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="영양제 추가" onPress={() => setShowAdd(true)} style={styles.addIcon}>
              <Plus color={colors.white} size={23} strokeWidth={2.6} />
            </Pressable>
          </View>

          <View style={styles.searchBar}>
            <Search size={19} color={colors.muted} strokeWidth={2.2} />
            <TextInput accessibilityLabel="내 영양제 검색" onChangeText={setQuery}
              placeholder="내 제품명, 브랜드, 성분 검색" placeholderTextColor={colors.faint}
              style={styles.searchInput} value={query} />
          </View>

          <View style={styles.listHeading}>
            <Text style={styles.listTitle}>등록된 제품</Text>
            <Text style={styles.listCount}>{filteredSupplements.length}개</Text>
          </View>

          {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
          {isLoading && !home.supplements.length ? <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.active} />
            <Text style={styles.loadingText}>영양제를 불러오는 중</Text>
          </View> : null}

          {filteredSupplements.length ? <View style={styles.cabinetList}>
            {filteredSupplements.map((supplement, index) => {
              const displayName = supplement.displayNameKo || supplement.productName || '제품명 미상';
              const schedule = home.todayDoses.filter(dose => dose.supplementId === supplement.id);
              const times = Array.from(new Set(schedule.map(dose => dose.confirmedTime).filter(Boolean)));
              const completed = schedule.filter(dose => dose.status === 'TAKEN').length;
              const statusText = schedule.length ? `오늘 ${completed}/${schedule.length} 완료` : '시간 미설정';
              return (
                <Pressable key={supplement.id} accessibilityRole="button"
                  accessibilityLabel={`${displayName}, ${statusText}, 상세 보기`}
                  onPress={() => navigation.navigate('SupplementDetail', { supplementId: supplement.id })}
                  style={({ pressed }) => [styles.card, index > 0 && styles.cardDivider, pressed && styles.pressed]}>
                  <View style={styles.productRow}>
                    <SupplementThumb imageUri={supplement.imageUri} name={displayName} size={64} />
                    <View style={styles.productCopy}>
                      <Text numberOfLines={1} style={styles.brand}>{supplement.brandName || '브랜드 정보 없음'}</Text>
                      <Text numberOfLines={2} style={styles.productName}>{displayName}</Text>
                    </View>
                    <ChevronRight size={19} color={colors.faint} />
                  </View>
                  <View style={styles.cardFooter}>
                    <View style={styles.scheduleRow}>
                      <Clock3 color={colors.active} size={15} strokeWidth={2.2} />
                      <Text numberOfLines={1} style={styles.scheduleText}>{times.length ? times.join(' · ') : '복용 시간 미설정'}</Text>
                    </View>
                    <Text style={[styles.status, schedule.length > 0 && completed === schedule.length && styles.statusDone]}>{statusText}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View> : !isLoading ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}><Search size={22} color={colors.active} /></View>
              <Text style={styles.emptyTitle}>{query.trim() ? '검색 결과가 없어요' : '아직 등록한 영양제가 없어요'}</Text>
              <Text style={styles.emptyBody}>{query.trim() ? '다른 이름이나 브랜드로 검색해 보세요.' : '라벨을 찍거나 직접 입력해 첫 루틴을 시작해 보세요.'}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
      <AddSupplementSheet visible={showAdd} onClose={() => setShowAdd(false)}
        onScan={() => openAdd('ImageInput')} onManual={() => openAdd('ManualSupplement')} />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 50 },
  rail: { width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 22 },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { color: colors.ink, fontSize: 26, lineHeight: 34, fontWeight: '900', letterSpacing: -0.6 },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 6 },
  addIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.active },
  searchBar: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, marginBottom: 26 },
  searchInput: { flex: 1, minWidth: 0, color: colors.ink, fontSize: 14, padding: 0 },
  listHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  listTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  listCount: { color: colors.active, fontSize: 13, fontWeight: '800' },
  cabinetList: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 22, overflow: 'hidden' },
  card: { paddingHorizontal: 16, paddingVertical: 18, gap: 14 },
  cardDivider: { borderTopColor: colors.line, borderTopWidth: 1 },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  productCopy: { flex: 1, minWidth: 0, gap: 4 },
  brand: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  productName: { color: colors.ink, fontSize: 17, lineHeight: 23, fontWeight: '900' },
  cardFooter: { borderTopColor: colors.line, borderTopWidth: 1, paddingTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  scheduleRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  scheduleText: { color: colors.inkSoft, fontSize: 12, fontWeight: '700', flex: 1 },
  status: { backgroundColor: colors.activeSoft, color: colors.active, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: '800', overflow: 'hidden' },
  statusDone: { backgroundColor: colors.completedSoft, color: colors.completed },
  empty: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 20, padding: 22, alignItems: 'flex-start', gap: 9 },
  emptyIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.activeSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  emptyBody: { color: colors.muted, fontSize: 13, lineHeight: 20, marginBottom: 8 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  loadingText: { color: colors.muted, fontSize: 12 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 20, marginBottom: 14 },
  pressed: { opacity: 0.7 },
});
