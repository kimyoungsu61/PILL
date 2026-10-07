import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Camera, Check, CheckCircle2, Image as ImageIcon, Keyboard, ScanLine, Sparkles } from 'lucide-react-native';
import { ApiTimeoutError, apiFetch, readableErrorMessage } from '../api/client';
import type { ScanResult } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import RitualAction from '../components/RitualAction';
import RitualSurface from '../components/RitualSurface';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { colors, radius, shadow, spacing, type } from '../theme';
import { contentRailWidth, supportsSupportingColumn } from '../utils/responsiveLayout';
import {
  deferredCameraSide,
  requestBackCameraAfterPrompt,
  scanFailureKind,
  type ScanFailureKind,
  type ScanSide,
} from './ImageInputScreen.helpers';

type Props = NativeStackScreenProps<RootStackParamList, 'ImageInput'>;

type ScanFailure = {
  kind: ScanFailureKind;
  message: string;
};

class ImagePreparationError extends Error {
  constructor() {
    super('촬영한 사진을 열지 못했어요. 앞면을 다시 촬영해 주세요.');
    this.name = 'ImagePreparationError';
  }
}

const scanCopy = {
  front: {
    fileName: 'supplement-front.jpg',
    title: '영양제 촬영하기',
  },
  back: {
    fileName: 'supplement-back.jpg',
    title: '뒷면 촬영하기',
  },
} satisfies Record<ScanSide, { title: string; fileName: string }>;

const SCAN_ANALYSIS_TIMEOUT_MS = 150_000;

export default function ImageInputScreen({ navigation }: Props) {
  const { token } = useAuth();
  const { width } = useWindowDimensions();
  const [frontAsset, setFrontAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [backAsset, setBackAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [failure, setFailure] = useState<ScanFailure | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showBackPrompt, setShowBackPrompt] = useState(false);
  const [pendingCameraSide, setPendingCameraSide] = useState<ScanSide | null>(null);

  const canAnalyze = Boolean(frontAsset && !isUploading);
  const useWideLayout = supportsSupportingColumn(width);

  useEffect(() => {
    const side = deferredCameraSide({ isBackPromptVisible: showBackPrompt, pendingCameraSide });
    if (!side) {
      return undefined;
    }

    const cameraTimer = setTimeout(() => {
      setPendingCameraSide(null);
      void pickFromCamera(side);
    }, 250);

    return () => clearTimeout(cameraTimer);
  }, [showBackPrompt, pendingCameraSide]);

  function setAsset(side: ScanSide, asset: ImagePicker.ImagePickerAsset) {
    if (side === 'front') {
      setFrontAsset(asset);
      setShowBackPrompt(true);
    } else {
      setBackAsset(asset);
    }
    setFailure(null);
  }

  async function pickFromCamera(side: ScanSide) {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setFailure({ kind: 'capture', message: '카메라 권한이 필요해요. 설정에서 카메라를 허용한 뒤 다시 촬영해 주세요.' });
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled) {
      setAsset(side, result.assets[0]);
    }
  }

  async function pickFromLibrary(side: ScanSide) {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setFailure({ kind: 'capture', message: '사진 보관함 권한이 필요해요. 권한을 허용한 뒤 이미지를 선택해 주세요.' });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    if (!result.canceled) {
      setAsset(side, result.assets[0]);
    }
  }

  async function upload() {
    if (!token) {
      setFailure({ kind: 'connection', message: '로그인이 필요해요. 다시 로그인한 뒤 시도해 주세요.' });
      return;
    }
    if (!frontAsset) {
      setFailure({ kind: 'capture', message: '영양제 앞면 사진을 먼저 촬영해 주세요.' });
      return;
    }

    setFailure(null);
    setIsUploading(true);
    try {
      const body = new FormData();
      body.append('frontImage', imagePart(frontAsset), frontAsset.fileName ?? scanCopy.front.fileName);
      if (backAsset) {
        body.append('backImage', imagePart(backAsset), backAsset.fileName ?? scanCopy.back.fileName);
      }

      const response = await apiFetch('/api/scans', {
        method: 'POST',
        body,
      }, token, SCAN_ANALYSIS_TIMEOUT_MS);
      if (!response.ok) {
        const message = await response.text();
        throw {
          kind: scanFailureKind(response.status, message),
          message: readableErrorMessage(message, `분석 요청에 실패했어요. (${response.status})`),
        } satisfies ScanFailure;
      }

      const result = await response.json() as ScanResult;
      navigation.navigate('ScanResult', { result, imageUri: frontAsset.uri });
    } catch (err) {
      if (isScanFailure(err)) {
        setFailure(err);
      } else if (err instanceof ApiTimeoutError) {
        setFailure({
          kind: 'analysis',
          message: 'AI 분석이 예상보다 오래 걸려 요청을 종료했어요. 사진은 그대로 유지되니 다시 시도해 주세요.',
        });
      } else if (err instanceof ImagePreparationError) {
        setFailure({ kind: 'image', message: err.message });
      } else {
        setFailure({
          kind: 'connection',
          message: err instanceof Error ? err.message : '서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.',
        });
      }
    } finally {
      setIsUploading(false);
    }
  }

  async function confirmBackCapture() {
    const nextState = requestBackCameraAfterPrompt();
    setPendingCameraSide(nextState.pendingCameraSide);
    setShowBackPrompt(nextState.isBackPromptVisible);
  }

  async function skipBackCapture() {
    setShowBackPrompt(false);
    await upload();
  }

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
        <View style={[styles.rail, { maxWidth: contentRailWidth(width) }]}>
          <View style={styles.header}>
            <Text style={styles.kicker}>LABEL SCAN</Text>
            <Text style={styles.title}>라벨을 차례로 담아주세요</Text>
            <Text style={styles.subtitle}>앞면 한 장으로 제품 정보를 검색합니다. 뒷면을 추가하면 라벨 내용을 직접 읽습니다.</Text>
          </View>

          <View accessibilityLabel="스캔 진행 단계" style={styles.stepTrack}>
            <CaptureStep active={!frontAsset} completed={Boolean(frontAsset)} number="01" title="앞면" />
            <View style={styles.stepConnector} />
            <CaptureStep active={Boolean(frontAsset && !backAsset)} completed={Boolean(backAsset)} number="02" title="뒷면 · 선택" />
            <View style={styles.stepConnector} />
            <CaptureStep active={Boolean(frontAsset)} completed={false} number="03" title="AI 분석" />
          </View>

          <View style={[styles.captureWorkspace, useWideLayout && styles.captureWorkspaceWide]}>
            <RitualSurface padded={false} style={styles.cameraPanel}>
              {frontAsset ? (
                <>
                  <Image accessibilityLabel="선택한 영양제 앞면 사진" source={{ uri: frontAsset.uri }} style={styles.previewImage} />
                  <View style={styles.previewStatus}>
                    <CheckCircle2 color={colors.completed} size={17} strokeWidth={2.5} />
                    <Text style={styles.previewStatusText}>앞면 이미지 준비 완료</Text>
                  </View>
                </>
              ) : (
                <View style={styles.cameraEmpty}>
                  <View style={styles.cameraIcon}>
                    <ScanLine size={42} color={colors.active} strokeWidth={2.1} />
                  </View>
                  <Text style={styles.cameraTitle}>제품 앞면을 먼저 담아요</Text>
                  <Text style={styles.cameraBody}>제품명과 브랜드가 프레임 안에 선명하게 보이도록 촬영해 주세요.</Text>
                </View>
              )}
            </RitualSurface>

            <RitualSurface style={styles.guidanceCard} variant={frontAsset ? 'default' : 'active'}>
              <View style={styles.guidanceHeader}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>01</Text>
                </View>
                <View style={styles.guidanceCopy}>
                  <Text style={styles.guidanceEyebrow}>필수 이미지</Text>
                  <Text style={styles.guidanceTitle}>앞면 촬영</Text>
                </View>
              </View>
              <Text style={styles.guidanceBody}>카메라 권한을 요청한 뒤 기기의 기본 촬영 화면이 열립니다.</Text>
              <RitualAction
                disabled={isUploading}
                fullWidth
                icon={<Camera color={colors.primaryText} size={18} strokeWidth={2.5} />}
                label={frontAsset ? '앞면 다시 촬영' : '카메라로 앞면 촬영'}
                onPress={() => void pickFromCamera('front')}
              />
              <RitualAction
                disabled={isUploading}
                fullWidth
                icon={<ImageIcon color={colors.ink} size={18} strokeWidth={2.5} />}
                label="앨범에서 앞면 선택"
                onPress={() => void pickFromLibrary('front')}
                tone="secondary"
              />
            </RitualSurface>
          </View>

          {frontAsset ? (
            <RitualSurface style={styles.optionalCard}>
              <View style={styles.optionalHeader}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>02</Text>
                </View>
                <View style={styles.optionalCopy}>
                  <Text style={styles.optionalTitle}>뒷면 추가 <Text style={styles.optionalMeta}>선택</Text></Text>
                  <Text style={styles.optionalBody}>복용법, 성분표, 주의사항이 보이면 AI가 검토할 근거가 더 많아집니다.</Text>
                </View>
                {backAsset ? (
                  <View style={styles.completePill}>
                    <Check color={colors.completed} size={14} strokeWidth={2.8} />
                    <Text style={styles.completePillText}>준비 완료</Text>
                  </View>
                ) : null}
              </View>
              {backAsset ? <Image accessibilityLabel="선택한 영양제 뒷면 사진" source={{ uri: backAsset.uri }} style={styles.backPreview} /> : null}
              <View style={styles.optionalActions}>
                <RitualAction
                  disabled={isUploading}
                  fullWidth
                  icon={<Camera color={colors.ink} size={17} strokeWidth={2.4} />}
                  label={backAsset ? '뒷면 다시 촬영' : '뒷면 촬영'}
                  onPress={() => void pickFromCamera('back')}
                  tone="secondary"
                />
                <RitualAction
                  disabled={isUploading}
                  fullWidth
                  icon={<ImageIcon color={colors.ink} size={17} strokeWidth={2.4} />}
                  label="뒷면 앨범 선택"
                  onPress={() => void pickFromLibrary('back')}
                  tone="secondary"
                />
              </View>
            </RitualSurface>
          ) : null}

          {failure ? (
            <RitualSurface accessibilityLiveRegion="polite" style={styles.errorCard} variant="warning">
              <Text style={styles.errorTitle}>{failureTitle(failure.kind)}</Text>
              <Text style={styles.error}>{failure.message}</Text>
              <RitualAction
                fullWidth
                icon={<Keyboard color={colors.ink} size={18} strokeWidth={2.5} />}
                label={failureRetryLabel(failure.kind)}
                onPress={() => {
                  if (failure.kind === 'capture' || failure.kind === 'image') {
                    void pickFromCamera('front');
                    return;
                  }
                  void upload();
                }}
                tone="secondary"
              />
              {failure.kind === 'capture' || failure.kind === 'analysis' ? (
                <>
                  <Text style={styles.fallbackHint}>
                    {failure.kind === 'capture'
                      ? '카메라를 사용할 수 없을 때만 직접 입력으로 이어갈 수 있어요.'
                      : '사진은 업로드됐지만 라벨을 인식하지 못한 경우에만 직접 입력으로 이어갈 수 있어요.'}
                  </Text>
                  <RitualAction
                    fullWidth
                    icon={<Keyboard color={colors.ink} size={18} strokeWidth={2.5} />}
                    label="직접 등록으로 계속"
                    onPress={() => navigation.navigate('ManualSupplement', { imageUri: frontAsset?.uri })}
                    tone="secondary"
                  />
                </>
              ) : null}
            </RitualSurface>
          ) : null}

          <RitualSurface style={styles.uploadCard} variant={frontAsset ? 'active' : 'default'}>
            <View style={styles.uploadHeader}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>03</Text>
              </View>
              <View style={styles.uploadCopy}>
                <Text style={styles.uploadTitle}>{isUploading ? '사진 인식 및 제품 정보 검색 중' : 'AI 라벨 분석'}</Text>
                <Text style={styles.uploadBody}>
                  {isUploading ? '이 화면을 그대로 두세요. 결과가 준비되면 자동으로 검토 화면으로 이동합니다.' : frontAsset ? '앞면 이미지가 준비됐어요. 제품 정보를 찾아 출처와 함께 보여드릴게요.' : '앞면 이미지를 준비하면 분석을 시작할 수 있어요.'}
                </Text>
              </View>
            </View>
            <RitualAction
              disabled={!canAnalyze}
              fullWidth
              icon={<Sparkles color={colors.primaryText} size={19} strokeWidth={2.5} />}
              label={isUploading ? 'AI 분석 중' : 'AI 분석 시작'}
              loading={isUploading}
              onPress={() => void upload()}
            />
          </RitualSurface>
        </View>
      </ScrollView>

      <Modal animationType="fade" transparent visible={showBackPrompt} onRequestClose={() => setShowBackPrompt(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <Camera size={23} color={colors.black} strokeWidth={2.3} />
            </View>
            <Text style={styles.modalTitle}>뒷면도 촬영할까요?</Text>
            <Text style={styles.modalBody}>복용법과 성분표까지 보이면 알림 시간과 복용 안내가 더 정확해져요.</Text>
            <View style={styles.modalActions}>
              <Pressable accessibilityLabel="앞면만 분석" accessibilityRole="button" onPress={skipBackCapture} style={({ pressed }) => [styles.modalGhostButton, pressed && styles.pressed]}>
                <Text style={styles.modalGhostText}>앞면만 분석</Text>
              </Pressable>
              <Pressable accessibilityLabel="뒷면 촬영하기" accessibilityRole="button" onPress={confirmBackCapture} style={({ pressed }) => [styles.modalPrimaryButton, pressed && styles.pressed]}>
                <Text style={styles.modalPrimaryText}>촬영하기</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function CaptureStep({ active, completed, number, title }: { active: boolean; completed: boolean; number: string; title: string }) {
  return (
    <View style={styles.captureStep}>
      <View style={[styles.captureStepMarker, active && styles.captureStepMarkerActive, completed && styles.captureStepMarkerCompleted]}>
        {completed ? <Check color={colors.primaryText} size={14} strokeWidth={2.8} /> : <Text style={[styles.captureStepNumber, active && styles.captureStepNumberActive]}>{number}</Text>}
      </View>
      <Text style={[styles.captureStepTitle, active && styles.captureStepTitleActive]}>{title}</Text>
    </View>
  );
}

function imagePart(asset: ImagePicker.ImagePickerAsset) {
  // On Safari, ImagePicker supplies the browser File directly. A blob: URI is
  // not a local expo-file-system path, so wrapping it in expo's File fails.
  if (asset.file) {
    if (!asset.file.size) throw new ImagePreparationError();
    return asset.file;
  }
  const file = new File(asset.uri);
  if (!file.exists || !file.size) {
    throw new ImagePreparationError();
  }
  return file;
}

function isScanFailure(value: unknown): value is ScanFailure {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<ScanFailure>;
  return typeof candidate.message === 'string'
    && (candidate.kind === 'capture'
      || candidate.kind === 'image'
      || candidate.kind === 'analysis'
      || candidate.kind === 'connection');
}

function failureTitle(kind: ScanFailureKind) {
  if (kind === 'capture') {
    return '사진을 준비하지 못했어요';
  }
  if (kind === 'image') {
    return '사진 파일을 다시 확인해 주세요';
  }
  if (kind === 'analysis') {
    return 'AI가 라벨을 분석하지 못했어요';
  }
  return '연결을 확인해 주세요';
}

function failureRetryLabel(kind: ScanFailureKind) {
  if (kind === 'capture' || kind === 'image') {
    return '앞면 다시 촬영';
  }
  if (kind === 'analysis') {
    return 'AI 분석 다시 시도';
  }
  return '다시 시도';
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
  },
  kicker: {
    color: colors.active,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2.2,
  },
  title: {
    ...type.hero,
  },
  subtitle: {
    ...type.body,
    color: colors.inkSoft,
    maxWidth: 560,
  },
  stepTrack: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  captureStep: {
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 58,
  },
  captureStepMarker: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  captureStepMarkerActive: {
    backgroundColor: colors.activeSoft,
    borderColor: colors.active,
  },
  captureStepMarkerCompleted: {
    backgroundColor: colors.completed,
    borderColor: colors.completed,
  },
  captureStepNumber: {
    color: colors.faint,
    fontSize: 10,
    fontWeight: '900',
  },
  captureStepNumberActive: {
    color: colors.active,
  },
  captureStepTitle: {
    color: colors.faint,
    fontSize: 10,
    fontWeight: '800',
  },
  captureStepTitleActive: {
    color: colors.ink,
  },
  stepConnector: {
    backgroundColor: colors.line,
    flex: 1,
    height: 1,
    marginBottom: 18,
    minWidth: spacing.md,
  },
  captureWorkspace: {
    gap: spacing.lg,
  },
  captureWorkspaceWide: {
    alignItems: 'stretch',
    flexDirection: 'row',
  },
  cameraPanel: {
    flex: 1,
    height: 344,
    overflow: 'hidden',
  },
  cameraEmpty: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  cameraIcon: {
    alignItems: 'center',
    backgroundColor: colors.activeSoft,
    borderColor: colors.active,
    borderRadius: 52,
    borderWidth: 1,
    height: 104,
    justifyContent: 'center',
    marginBottom: spacing.lg,
    width: 104,
  },
  cameraTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  cameraBody: {
    ...type.meta,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  previewImage: {
    flex: 1,
    width: '100%',
  },
  previewStatus: {
    alignItems: 'center',
    backgroundColor: colors.completedSoft,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  previewStatusText: {
    color: colors.completed,
    fontSize: 13,
    fontWeight: '900',
  },
  guidanceCard: {
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    minHeight: 270,
  },
  guidanceHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  stepNumber: {
    alignItems: 'center',
    backgroundColor: colors.activeSoft,
    borderRadius: radius.md,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  stepNumberText: {
    color: colors.active,
    fontSize: 12,
    fontWeight: '900',
  },
  guidanceCopy: {
    flex: 1,
    gap: 2,
  },
  guidanceEyebrow: {
    color: colors.active,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  guidanceTitle: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: '900',
  },
  guidanceBody: {
    ...type.body,
    color: colors.inkSoft,
  },
  optionalCard: {
    gap: spacing.md,
  },
  optionalHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
  },
  optionalCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  optionalTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '900',
  },
  optionalMeta: {
    color: colors.muted,
    fontSize: 11,
  },
  optionalBody: {
    ...type.meta,
  },
  optionalActions: {
    gap: spacing.sm,
  },
  completePill: {
    alignItems: 'center',
    backgroundColor: colors.completedSoft,
    borderRadius: 999,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
  },
  completePillText: {
    color: colors.completed,
    fontSize: 10,
    fontWeight: '900',
  },
  backPreview: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    height: 180,
    width: '100%',
  },
  errorCard: {
    gap: spacing.md,
  },
  errorTitle: {
    color: colors.warning,
    fontSize: 16,
    fontWeight: '900',
  },
  error: {
    color: colors.inkSoft,
    fontSize: 14,
    lineHeight: 20,
  },
  fallbackHint: {
    ...type.meta,
    color: colors.muted,
  },
  uploadCard: {
    gap: spacing.md,
  },
  uploadHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
  },
  uploadCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  uploadTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '900',
  },
  uploadBody: {
    ...type.body,
    color: colors.inkSoft,
  },
  modalOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.64)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    ...shadow.card,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.xxl,
    borderWidth: 1,
    gap: spacing.md,
    padding: 22,
    maxWidth: 420,
    width: '100%',
  },
  modalIcon: {
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  modalTitle: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: '900',
    lineHeight: 29,
    textAlign: 'center',
  },
  modalBody: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    maxWidth: 268,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  modalGhostButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  modalGhostText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  modalPrimaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  modalPrimaryText: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.78,
  },
});
