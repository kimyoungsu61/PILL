import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CheckCircle2, ChevronDown, Clock3, History, Plus, Save, Trash2, X, XCircle } from 'lucide-react-native';
import { apiRequest } from '../api/client';
import type { DoseStatus, ProductInformation, SupplementDetailResponse } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import RitualAction from '../components/RitualAction';
import RitualSurface from '../components/RitualSurface';
import SupplementThumb from '../components/SupplementThumb';
import TimePickerField from '../components/TimePickerField';
import ProductGuideCard from '../components/ProductGuideCard';
import WarningCard from '../components/WarningCard';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { cancelSupplementReminders, scheduleSupplementReminders } from '../notifications/doseReminderNotifications';
import { colors, radius, spacing, type } from '../theme';
import { clearTodayDetailDoseLog } from '../utils/supplementDetailDisplay';
import { contentRailWidth, supportsSupportingColumn } from '../utils/responsiveLayout';

type Props = NativeStackScreenProps<RootStackParamList, 'SupplementDetail'>;

function todayKey() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function doseStatusText(status: DoseStatus) {
  return status === 'TAKEN' ? '복용 완료' : '건너뜀';
}

function parseDoseTimes(value?: string) {
  const times = (value ?? '09:00').split(',')
    .map((time) => time.trim())
    .filter(Boolean);
  return times.length ? Array.from(new Set(times)) : ['09:00'];
}

function normalizeEditableDoseTimes(times: string[]) {
  return Array.from(new Set(times.map((time) => time.trim()).filter(Boolean)));
}

function isClockTime(value: string) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function defaultDoseTime(index: number) {
  return ['09:00', '13:00', '19:00'][index] ?? '19:00';
}

export default function SupplementDetailScreen({ navigation, route }: Props) {
  const { token } = useAuth();
  const { width } = useWindowDimensions();
  const isCompactIdentity = width < 380;
  const [detail, setDetail] = useState<SupplementDetailResponse | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const deleteInFlight = useRef(false);
  const [editableDoseTimes, setEditableDoseTimes] = useState<string[]>(['09:00']);
  const [isSavingDoseTimes, setIsSavingDoseTimes] = useState(false);
  const [showTimeEditor, setShowTimeEditor] = useState(false);
  const hasSupportingColumn = supportsSupportingColumn(width);
  const [isLoadingGuide, setIsLoadingGuide] = useState(false);
  const [guideError, setGuideError] = useState('');

  const loadDetail = useCallback(async () => {
    if (!token) {
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      const response = await apiRequest<SupplementDetailResponse>(`/api/supplements/${route.params.supplementId}`, {}, token);
      setDetail(response);
      setEditableDoseTimes(parseDoseTimes(response.confirmedDoseTime));
    } catch (err) {
      setError(err instanceof Error ? err.message : '상세 정보를 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [route.params.supplementId, token]);

  useFocusEffect(useCallback(() => {
    void loadDetail();
  }, [loadDetail]));

  const doseTimes = parseDoseTimes(detail?.confirmedDoseTime);
  const todaySummary = useMemo(() => {
    const statuses = doseTimes.map((doseTime) => detail?.doseLogs.find((log) => (
      log.doseDate === todayKey() && (log.doseTime || doseTimes[0]) === doseTime
    ))?.status);
    return {
      total: doseTimes.length,
      done: statuses.filter(Boolean).length,
    };
  }, [detail?.doseLogs, doseTimes]);

  function todayStatusFor(doseTime: string) {
    return detail?.doseLogs.find((log) => (
      log.doseDate === todayKey() && (log.doseTime || doseTimes[0]) === doseTime
    ))?.status;
  }

  async function loadGuide() {
    if (!token || !detail || isLoadingGuide) return;
    setIsLoadingGuide(true);
    setGuideError('');
    try {
      const information = await apiRequest<ProductInformation>(`/api/supplements/${detail.id}/guide`, { method: 'POST' }, token, 120_000);
      setDetail(current => current ? { ...current, productInformation: information } : current);
    } catch (err) {
      setGuideError(err instanceof Error ? err.message : '제품 안내를 불러오지 못했어요. 다시 시도해 주세요.');
    } finally { setIsLoadingGuide(false); }
  }

  async function postDose(status: DoseStatus, doseTime: string) {
    if (!token) {
      setError('로그인이 필요합니다.');
      return;
    }

    setIsPosting(true);
    setError('');
    try {
      await apiRequest<void>(`/api/supplements/${route.params.supplementId}/dose-logs`, {
        method: 'POST',
        body: JSON.stringify({ status, memo: '', doseTime }),
      }, token);
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : '복용 체크를 저장하지 못했습니다.');
    } finally {
      setIsPosting(false);
    }
  }

  async function clearDose(doseTime: string) {
    if (!token || !detail) {
      setError('로그인이 필요합니다.');
      return;
    }

    const previousDetail = detail;
    setDetail(clearTodayDetailDoseLog(detail, doseTime));
    setIsPosting(true);
    setError('');
    try {
      await apiRequest<void>(`/api/supplements/${route.params.supplementId}/dose-logs?doseTime=${encodeURIComponent(doseTime)}`, {
        method: 'DELETE',
      }, token);
      await loadDetail();
    } catch (err) {
      setDetail(previousDetail);
      setError(err instanceof Error ? err.message : '복용 기록을 취소하지 못했습니다.');
    } finally {
      setIsPosting(false);
    }
  }

  function logDose(doseTime: string, status: DoseStatus) {
    const todayStatus = todayStatusFor(doseTime);
    if (todayStatus === status) {
      return;
    }

    if (todayStatus) {
      Alert.alert(
        '복용 기록을 수정할까요?',
        `오늘 기록이 이미 ${doseStatusText(todayStatus)} 상태입니다. ${doseStatusText(status)} 상태로 바꿀까요?`,
        [
          { text: '취소', style: 'cancel' },
          { text: '수정', style: 'default', onPress: () => void postDose(status, doseTime) },
        ],
      );
      return;
    }

    void postDose(status, doseTime);
  }

  function updateEditableDoseTime(index: number, value: string) {
    setEditableDoseTimes((current) => current.map((time, timeIndex) => timeIndex === index ? value : time));
  }

  function addEditableDoseTime() {
    setEditableDoseTimes((current) => {
      if (current.length >= 3) {
        return current;
      }
      return [...current, defaultDoseTime(current.length)];
    });
  }

  function removeEditableDoseTime(index: number) {
    setEditableDoseTimes((current) => {
      if (current.length <= 1) {
        return current;
      }
      return current.filter((_, timeIndex) => timeIndex !== index);
    });
  }

  async function saveDoseTimes() {
    if (!token || !detail) {
      setError('로그인이 필요합니다.');
      return;
    }

    const times = normalizeEditableDoseTimes(editableDoseTimes);
    if (!times.length || times.length > 3 || times.some((time) => !isClockTime(time))) {
      setError('알림 시간은 09:00 형식으로 1개에서 3개까지 입력해 주세요.');
      return;
    }

    setIsSavingDoseTimes(true);
    setError('');
    try {
      await apiRequest<void>(`/api/supplements/${route.params.supplementId}/dose-times`, {
        method: 'PATCH',
        body: JSON.stringify({ doseTimes: times }),
      }, token);
      setEditableDoseTimes(times);
      await scheduleSupplementReminders({
        supplementId: detail.id,
        productName: detail.productName,
        displayNameKo: detail.displayNameKo,
        times,
      });
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : '알림 시간을 저장하지 못했습니다.');
    } finally {
      setIsSavingDoseTimes(false);
    }
  }

  async function deleteSupplement() {
    if (deleteInFlight.current) return;
    if (!token) {
      setDeleteError('로그인이 필요합니다.');
      return;
    }

    deleteInFlight.current = true;
    setIsDeleting(true);
    setDeleteError('');
    setError('');
    try {
      await apiRequest<void>(`/api/supplements/${route.params.supplementId}`, {
        method: 'DELETE',
      }, token);
      // The server deletion has succeeded. Local notification cleanup must not
      // leave the user on a detail screen for a product that no longer exists.
      if (Platform.OS !== 'web') {
        try {
          await cancelSupplementReminders(route.params.supplementId);
        } catch {
          Alert.alert('영양제는 삭제됐어요', '기기에 남아 있는 복용 알림은 정리하지 못했어요. 기기에서 알림을 확인해 주세요.');
        }
      }
      setShowDeleteConfirmation(false);
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs', params: { screen: 'Supplements' } }],
      });
    } catch (err) {
      setDeleteError(err instanceof TypeError ? '연결이 불안정해 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.'
        : err instanceof Error ? err.message : '삭제하지 못했어요. 연결을 확인하고 다시 시도해 주세요.');
    } finally {
      deleteInFlight.current = false;
      setIsDeleting(false);
    }
  }

  function confirmDelete() {
    if (!detail || deleteInFlight.current) return;
    setDeleteError('');
    setShowDeleteConfirmation(true);
  }

  function closeDeleteConfirmation() {
    if (deleteInFlight.current) return;
    setShowDeleteConfirmation(false);
    setDeleteError('');
  }

  if (isLoading && !detail) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.active} />
      </View>
    );
  }

  const displayName = detail?.displayNameKo || detail?.productName;

  return (
    <>
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <View style={[styles.rail, { maxWidth: contentRailWidth(width) }]}>
        {detail ? (
          <>
            <RitualSurface style={styles.identitySurface} variant="active">
              <View style={styles.identityTop}>
                <SupplementThumb imageUri={detail.imageUri} name={displayName} size={isCompactIdentity ? 56 : 72} />
                <View style={styles.identityCopy}>
                  <Text style={styles.brand}>{detail.brandName || '브랜드 정보 없음'}</Text>
                  {!isCompactIdentity ? <Text style={styles.title}>{displayName || '제품명 미상'}</Text> : null}
                  {detail.productName && detail.productName !== displayName ? (
                    <Text style={styles.originalName}>{detail.productName}</Text>
                  ) : null}
                </View>
              </View>
              {isCompactIdentity ? <Text style={styles.title}>{displayName || '제품명 미상'}</Text> : null}
              <View style={styles.identitySchedule}>
                <Clock3 size={18} color={colors.active} strokeWidth={2.4} />
                <View style={styles.identityScheduleCopy}>
                  <Text style={styles.identityScheduleLabel}>현재 복용 일정</Text>
                  <Text style={styles.identityScheduleValue}>{doseTimes.join(' · ')}</Text>
                </View>
              </View>
            </RitualSurface>

            {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}

            <View style={[styles.detailLayout, hasSupportingColumn && styles.detailLayoutWide]}>
              <View style={[styles.factsColumn, hasSupportingColumn && styles.factsColumnWide]}>
                <ProductFacts detail={detail} guide={<ProductGuideCard information={detail.productInformation} loading={isLoadingGuide} error={guideError} onLoad={() => void loadGuide()} showReferenceLabel />} />
              </View>
              <View style={[styles.primaryColumn, hasSupportingColumn && styles.primaryColumnWide]}>
                <RitualSurface style={styles.todaySurface}>
                  <View style={styles.todayHeading}>
                    <View>
                      <Text style={styles.surfaceTitle}>오늘의 복용</Text>
                    </View>
                    <Text style={styles.todayCount}>{todaySummary.done}/{todaySummary.total}</Text>
                  </View>


                {showTimeEditor ? <RitualSurface style={styles.routineSurface}>
                  <Pressable accessibilityRole="button" accessibilityLabel="알림 시간 편집 닫기" onPress={() => setShowTimeEditor(false)} style={styles.editorHeader}>
                    <View><Text style={styles.surfaceTitle}>알림 시간 편집</Text></View>
                    <ChevronDown size={20} color={colors.active} style={{ transform: [{ rotate: '180deg' }] }} />
                  </Pressable>
                  {editableDoseTimes.map((time, index) => (
                    <View key={`editable-dose-time-${index}`} style={styles.editTimeRow}>
                      <View style={styles.editTimeIcon}>
                        <Clock3 size={17} color={colors.active} strokeWidth={2.4} />
                      </View>
                      <TimePickerField value={time} onChange={(value) => updateEditableDoseTime(index, value)} />
                      <Pressable
                        accessibilityLabel={`${index + 1}번째 알림 삭제`}
                        accessibilityRole="button"
                        disabled={editableDoseTimes.length <= 1}
                        onPress={() => removeEditableDoseTime(index)}
                        style={({ pressed }) => [styles.iconButton, editableDoseTimes.length <= 1 && styles.disabledIconButton, pressed && styles.pressed]}
                      >
                        <X size={16} color={editableDoseTimes.length <= 1 ? colors.faint : colors.danger} strokeWidth={2.5} />
                      </Pressable>
                    </View>
                  ))}
                  <View style={styles.editorActions}>
                    <View style={styles.editorActionCell}>
                      <RitualAction
                        disabled={editableDoseTimes.length >= 3}
                        fullWidth
                        icon={<Plus color={editableDoseTimes.length >= 3 ? colors.faint : colors.ink} size={16} strokeWidth={2.5} />}
                        label="시간 추가"
                        onPress={addEditableDoseTime}
                        tone="secondary"
                      />
                    </View>
                    <View style={styles.editorActionCell}>
                      <RitualAction
                        fullWidth
                        icon={<Save color={colors.primaryText} size={16} strokeWidth={2.5} />}
                        label="시간 저장"
                        loading={isSavingDoseTimes}
                        onPress={() => void saveDoseTimes()}
                      />
                    </View>
                  </View>
                </RitualSurface> : null}

                <View style={styles.doseList}>
                  {doseTimes.map((doseTime) => {
                    const status = todayStatusFor(doseTime);
                    return (
                      <View key={doseTime} style={styles.doseSurface}>
                        <View style={styles.doseHeading}>
                          <View style={styles.doseTime}>
                            <Clock3 size={17} color={colors.active} strokeWidth={2.4} />
                            <Text style={styles.doseTimeText}>{doseTime}</Text>
                          </View>
                          <Text style={[styles.doseStatus, status === 'TAKEN' && styles.completedStatus]}>
                            {status ? doseStatusText(status) : '기록 대기'}
                          </Text>
                        </View>
                        <View style={styles.doseActions}>
                          <View style={styles.doseActionCell}>
                            <RitualAction
                              disabled={isPosting || status === 'TAKEN'}
                              fullWidth
                              icon={<CheckCircle2 color={colors.primaryText} size={18} strokeWidth={2.5} />}
                              label={status === 'TAKEN' ? '완료됨' : '복용 완료'}
                              onPress={() => logDose(doseTime, 'TAKEN')}
                            />
                          </View>
                          <View style={styles.doseActionCell}>
                            <RitualAction
                              disabled={isPosting || status === 'SKIPPED'}
                              fullWidth
                              icon={<XCircle color={colors.ink} size={18} strokeWidth={2.5} />}
                              label={status === 'SKIPPED' ? '건너뜀' : '건너뛰기'}
                              onPress={() => logDose(doseTime, 'SKIPPED')}
                              tone="secondary"
                            />
                          </View>
                        </View>
                        {status ? (
                          <Pressable
                            accessibilityRole="button"
                            disabled={isPosting}
                            onPress={() => void clearDose(doseTime)}
                            style={({ pressed }) => [styles.clearButton, isPosting && styles.disabledButton, pressed && styles.pressed]}
                          >
                            <Text style={styles.clearButtonText}>이 시간의 기록 취소</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
                {!showTimeEditor ? <Pressable accessibilityRole="button" onPress={() => setShowTimeEditor(true)} style={styles.editScheduleButton}>
                  <Clock3 size={18} color={colors.active} />
                  <Text style={styles.editScheduleText}>복용 시간 편집</Text>
                  <ChevronDown size={18} color={colors.active} />
                </Pressable> : null}
                </RitualSurface>
              </View>


            </View>

            <RitualSurface style={styles.dangerSurface}>
              <Text style={styles.surfaceTitle}>보관함에서 삭제</Text>
              <Text style={styles.surfaceBody}>제품과 복용 기록, 설정한 알림이 삭제됩니다. 삭제한 내용은 되돌릴 수 없어요.</Text>
              <RitualAction
                fullWidth
                icon={<Trash2 color={colors.danger} size={18} strokeWidth={2.5} />}
                label="영양제 삭제"
                loading={isDeleting}
                onPress={confirmDelete}
                tone="danger"
              />
            </RitualSurface>
          </>
        ) : null}
        {!detail && error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
      </View>
    </ScrollView>
    <Modal animationType={Platform.OS === 'web' ? 'none' : 'fade'} transparent visible={showDeleteConfirmation} onRequestClose={closeDeleteConfirmation}>
      <View style={styles.deleteOverlay}>
        <View accessibilityViewIsModal role="alertdialog" accessibilityLabel="영양제 삭제 확인" style={styles.deleteDialog}>
          <ScrollView contentContainerStyle={styles.deleteDialogContent}>
            <View style={styles.deleteDialogIcon}><Trash2 size={24} color={colors.danger} /></View>
            <Text style={styles.deleteDialogTitle}>영양제를 삭제할까요?</Text>
            <Text style={styles.deleteProductName}>{detail?.displayNameKo || detail?.productName || '이 영양제'}</Text>
            <Text style={styles.deleteDialogBody}>제품과 복용 기록, 설정한 알림이 삭제됩니다. 삭제한 내용은 되돌릴 수 없어요.</Text>
            {deleteError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{deleteError}</Text> : null}
            <View style={styles.deleteDialogActions}>
              <RitualAction fullWidth label="취소" tone="secondary" disabled={isDeleting} onPress={closeDeleteConfirmation} />
              <RitualAction fullWidth label={isDeleting ? '삭제 중…' : '삭제하기'} tone="danger" loading={isDeleting} onPress={() => void deleteSupplement()} />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
    </>
  );
}

function ProductFacts({ detail, guide }: { detail: SupplementDetailResponse; guide: React.ReactNode }) {
  const [showAllIngredients, setShowAllIngredients] = useState(false);
  const [showOriginalUse, setShowOriginalUse] = useState(false);
  return (
    <>
      <RitualSurface style={styles.factSurface}>
        <Text style={styles.surfaceTitle}>섭취 방법</Text>
        <Text style={styles.guidanceText}>
          {detail.suggestedUseKo || '등록된 섭취 방법이 없습니다. 제품 라벨을 확인해 주세요.'}
        </Text>
        {detail.suggestedUseOriginal ? <Pressable accessibilityRole="button" onPress={() => setShowOriginalUse(value => !value)} style={styles.inlineDisclosure}>
          <Text style={styles.inlineDisclosureText}>{showOriginalUse ? '라벨 원문 접기' : '라벨 원문 보기'}</Text>
          <ChevronDown size={16} color={colors.active} style={showOriginalUse ? { transform: [{ rotate: '180deg' }] } : undefined} />
        </Pressable> : null}
        {detail.suggestedUseOriginal && showOriginalUse ? (
          <View style={styles.originalGuidance}>
            <Text style={styles.factLabel}>라벨 원문</Text>
            <Text style={styles.surfaceBody}>{detail.suggestedUseOriginal}</Text>
          </View>
        ) : null}
      </RitualSurface>

      {guide}

      <RitualSurface style={styles.factSurface}>
        <Text style={styles.surfaceTitle}>성분 및 함량</Text>
        <Text style={styles.ingredientCount}>{detail.servingBasisKo ? `함량 기준 · ${detail.servingBasisKo}` : '함량 기준 미입력'}</Text>
        {detail.ingredients.length ? (showAllIngredients ? detail.ingredients : detail.ingredients.slice(0, 4)).map((ingredient, index) => {
          return (
            <View key={`${ingredient.name}-${index}`} style={[styles.ingredient, index > 0 && styles.factDivider]}>
              <View style={styles.ingredientTop}>
                <Text style={styles.ingredientName}>{ingredient.name || '성분명 미상'}</Text>
              </View>
              <Text style={styles.ingredientAmount}>
                {ingredient.amount?.trim() ? [ingredient.amount, ingredient.unit].filter(Boolean).join(' ') : '함량 정보 없음'}
              </Text>
            </View>
          );
        }) : <Text style={styles.emptyText}>인식된 성분이 없습니다.</Text>}
        {detail.ingredients.length > 4 ? <Pressable accessibilityRole="button" onPress={() => setShowAllIngredients(value => !value)} style={styles.inlineDisclosure}>
          <Text style={styles.inlineDisclosureText}>{showAllIngredients ? '성분 접기' : `나머지 ${detail.ingredients.length - 4}개 성분 보기`}</Text>
          <ChevronDown size={16} color={colors.active} style={showAllIngredients ? { transform: [{ rotate: '180deg' }] } : undefined} />
        </Pressable> : null}
      </RitualSurface>

      <WarningCard message={detail.warningSummary} />

      <RitualSurface style={styles.factSurface}>
        <View style={styles.factTitleRow}>
          <View>
            <Text style={styles.surfaceTitle}>최근 기록</Text>
          </View>
          <History color={colors.faint} size={18} strokeWidth={2.4} />
        </View>
        {detail.doseLogs.length ? detail.doseLogs.map((log, index) => (
          <View
            key={`${log.doseDate}-${log.doseTime ?? 'default'}-${log.checkedAt}`}
            style={[styles.logRow, index > 0 && styles.factDivider]}
          >
            <Text style={styles.logDate}>{[log.doseDate, log.doseTime].filter(Boolean).join(' · ')}</Text>
            <Text style={[styles.logStatus, log.status === 'TAKEN' && styles.completedStatus]}>
              {log.status === 'TAKEN' ? '완료' : '건너뜀'}
            </Text>
          </View>
        )) : <Text style={styles.emptyText}>아직 복용 기록이 없습니다.</Text>}
      </RitualSurface>
    </>
  );
}

const styles = StyleSheet.create({
  deleteOverlay: { flex: 1, backgroundColor: 'rgba(23,35,77,0.42)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  deleteDialog: { backgroundColor: colors.surface, borderRadius: radius.xxl, maxWidth: 420, maxHeight: '85%', width: '100%', overflow: 'hidden' },
  deleteDialogContent: { padding: 24, gap: 14 },
  deleteDialogIcon: { backgroundColor: colors.dangerSoft, borderRadius: 16, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  deleteDialogTitle: { color: colors.ink, fontSize: 21, lineHeight: 29, fontWeight: '600' },
  deleteProductName: { color: colors.inkSoft, fontSize: 15, lineHeight: 23, fontWeight: '700' },
  deleteDialogBody: { color: colors.muted, fontSize: 14, lineHeight: 23 },
  deleteDialogActions: { gap: 10, marginTop: 6 },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: 80,
  },
  rail: {
    alignSelf: 'center',
    gap: spacing.lg,
    width: '100%',
  },
  center: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
  },
  identitySurface: {
    backgroundColor: colors.surface,
    borderColor: colors.surface,
    gap: spacing.lg,
  },
  identityTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
  },
  brand: {
    color: colors.muted, fontSize: 12, fontWeight: '500', lineHeight: 18, marginBottom: 4,
  },
  title: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 31,
  },
  originalName: {
    ...type.meta,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  identitySchedule: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.surfaceMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  identityScheduleCopy: {
    flex: 1,
    gap: 2,
  },
  identityScheduleLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  identityScheduleValue: {
    color: colors.inkSoft,
    fontSize: 15,
    fontWeight: '700',
  },
  detailLayout: {
    gap: spacing.lg,
  },
  detailLayoutWide: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  primaryColumn: {
    flex: 1,
    gap: spacing.lg,
    minWidth: 0,
  },
  factsColumn: {
    gap: spacing.lg,
  },
  factsColumnWide: {
    flex: 1, minWidth: 0,
  },
  primaryColumnWide: {
    width: 340, flex: 0,
  },
  todaySurface: {
    gap: spacing.sm,
  },
  todayHeading: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  todayCount: {
    color: colors.primary,
    fontSize: 23,
    fontWeight: '700',
  },
  surfaceKicker: {
    color: colors.active,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.6,
    marginBottom: spacing.xs,
  },
  surfaceTitle: {
    ...type.section,
  },
  surfaceBody: {
    ...type.body,
  },
  routineSurface: {
    gap: spacing.md,
  },
  editScheduleButton: {
    minHeight: 50,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  editScheduleText: {
    color: colors.active,
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  editorHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inlineDisclosure: {
    minHeight: 43,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  inlineDisclosureText: {
    color: colors.active,
    fontSize: 12,
    fontWeight: '600',
  },
  ingredientCount: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  meta: {
    ...type.meta,
  },
  editTimeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  editTimeIcon: {
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
  editorActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  editorActionCell: {
    flex: 1,
    minWidth: 0,
  },
  doseList: {
    gap: spacing.md,
  },
  doseSurface: {
    gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: 18,
  },
  doseHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  doseTime: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  doseTimeText: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '700',
  },
  doseStatus: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  completedStatus: {
    color: colors.completed,
  },
  doseActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  doseActionCell: {
    flex: 1,
    minWidth: 0,
  },
  clearButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 42,
  },
  clearButtonText: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.48,
  },
  factSurface: {
    gap: spacing.md,
  },
  guidanceText: {
    ...type.body,
    color: colors.inkSoft,
  },
  originalGuidance: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    gap: spacing.xs,
    paddingTop: spacing.md,
  },
  factLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  ingredient: {
    gap: spacing.xs,
  },
  factDivider: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    paddingTop: spacing.md,
  },
  ingredientTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  ingredientName: {
    color: colors.ink, flex: 1, fontSize: 15, fontWeight: '500', minWidth: 120, lineHeight: 23,
  },
  ingredientAmount: {
    color: colors.inkSoft, fontSize: 14, fontWeight: '500', fontVariant: ['tabular-nums'],
  },
  confidenceText: {
    color: colors.active,
    fontSize: 11,
    fontWeight: '700',
  },
  originalIngredient: {
    ...type.meta,
  },
  emptyText: {
    ...type.meta,
  },
  factTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  logRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  logDate: {
    color: colors.inkSoft, flex: 1, fontSize: 13, fontWeight: '400', lineHeight: 21,
  },
  logStatus: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  dangerSurface: {
    gap: 12, backgroundColor: 'transparent', paddingHorizontal: 4,
  },
  dangerKicker: {
    color: colors.danger,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
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
