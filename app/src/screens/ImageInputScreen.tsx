import { useEffect, useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Camera, Check, Image as ImageIcon, Plus, X } from 'lucide-react-native';
import { ApiTimeoutError, apiFetch, readableErrorMessage } from '../api/client';
import type { ScanResult } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import RitualAction from '../components/RitualAction';
import RitualSurface from '../components/RitualSurface';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme';
import { deferredCaptureSource, nextScanPhotos, requestBackCaptureAfterPrompt, scanFailureKind, type ScanFailureKind, type ScanPhotoSource, type ScanSide } from './ImageInputScreen.helpers';

type Props = NativeStackScreenProps<RootStackParamList, 'ImageInput'>;
type ScanFailure = { kind: ScanFailureKind; message: string };
type Photo = ImagePicker.ImagePickerAsset;
class ImagePreparationError extends Error {
  constructor() { super('사진을 열지 못했어요. 다시 촬영하거나 다른 사진을 선택해 주세요.'); }
}
const SCAN_ANALYSIS_TIMEOUT_MS = 150_000;

export default function ImageInputScreen({ navigation }: Props) {
  const { token } = useAuth();
  const [photos, setPhotos] = useState<{ product: Photo | null; extra: Photo | null }>({ product: null, extra: null });
  const [failure, setFailure] = useState<ScanFailure | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showBackPrompt, setShowBackPrompt] = useState(false);
  const [pendingSource, setPendingSource] = useState<ScanPhotoSource | null>(null);
  const captureInFlight = useRef(false);
  const uploadInFlight = useRef(false);

  useEffect(() => {
    const source = deferredCaptureSource({ isBackPromptVisible: showBackPrompt, pendingSource });
    if (!source) return;
    // iPhone must finish dismissing the prompt before presenting another picker.
    const timer = setTimeout(() => { setPendingSource(null); void pickPhoto('back', source); }, 250);
    return () => clearTimeout(timer);
  }, [showBackPrompt, pendingSource]);

  async function pickPhoto(side: ScanSide, source: ScanPhotoSource) {
    if (captureInFlight.current || uploadInFlight.current) return;
    captureInFlight.current = true;
    try {
      const permission = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setFailure({ kind: 'capture', message: source === 'camera' ? '카메라를 사용할 수 없어요. 기기 설정에서 권한을 확인하거나 앨범에서 사진을 선택해 주세요.' : '사진을 선택할 수 없어요. 기기 설정에서 사진 접근 권한을 확인해 주세요.' });
        return;
      }
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      setPhotos(current => nextScanPhotos(current, side, asset));
      setFailure(null);
      if (side === 'front') setShowBackPrompt(true);
    } catch {
      setFailure({ kind: 'capture', message: '사진을 준비하지 못했어요. 다시 촬영하거나 앨범에서 선택해 주세요.' });
    } finally { captureInFlight.current = false; }
  }

  async function upload() {
    if (uploadInFlight.current) return;
    if (!token) { setFailure({ kind: 'connection', message: '로그인이 필요해요. 다시 로그인한 뒤 시도해 주세요.' }); return; }
    if (!photos.product) { setFailure({ kind: 'capture', message: '제품 사진을 먼저 준비해 주세요.' }); return; }
    uploadInFlight.current = true; setIsUploading(true); setFailure(null); setShowBackPrompt(false);
    try {
      const body = new FormData();
      body.append('frontImage', imagePart(photos.product), photos.product.fileName ?? 'supplement-front.jpg');
      if (photos.extra) body.append('backImage', imagePart(photos.extra), photos.extra.fileName ?? 'supplement-back.jpg');
      const response = await apiFetch('/api/scans', { method: 'POST', body }, token, SCAN_ANALYSIS_TIMEOUT_MS);
      if (!response.ok) {
        const message = await response.text();
        throw { kind: scanFailureKind(response.status, message), message: readableErrorMessage(message, '제품 정보를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.') } satisfies ScanFailure;
      }
      const result = await response.json() as ScanResult;
      navigation.navigate('ScanResult', { result, imageUri: photos.product.uri });
    } catch (err) {
      if (isScanFailure(err)) setFailure(err);
      else if (err instanceof ApiTimeoutError) setFailure({ kind: 'analysis', message: '제품 확인에 시간이 조금 더 걸리고 있어요. 사진은 그대로 있으니 다시 시도해 주세요.' });
      else if (err instanceof ImagePreparationError) setFailure({ kind: 'image', message: err.message });
      else setFailure({ kind: 'connection', message: err instanceof Error ? err.message : '서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.' });
    } finally { uploadInFlight.current = false; setIsUploading(false); }
  }

  function addExtra(source: ScanPhotoSource) {
    const next = requestBackCaptureAfterPrompt(source);
    setPendingSource(next.pendingSource); setShowBackPrompt(next.isBackPromptVisible);
  }

  return <>
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.rail}>
        <View style={styles.heading}>
          <Text style={styles.title}>{photos.product ? '사진을 확인해 주세요' : '제품 사진으로 등록해요'}</Text>
          <Text style={styles.subtitle}>{photos.product ? '준비한 사진으로 제품 정보를 찾아드릴게요.' : '제품명과 브랜드가 잘 보이게 찍어주세요.'}</Text>
        </View>

        {photos.product ? <>
          <View style={styles.photoCard}>
            <Image accessibilityLabel="선택한 제품 사진" source={{ uri: photos.product.uri }} resizeMode="contain" style={styles.preview} />
            <View style={styles.photoFooter}>
              <View style={styles.photoLabel}><Check size={16} color={colors.completed} /><Text style={styles.photoLabelText}>제품 사진</Text></View>
              <View style={styles.inlineActions}>
                <Pressable accessibilityRole="button" accessibilityLabel="제품 사진 다시 촬영" disabled={isUploading} onPress={() => void pickPhoto('front', 'camera')} style={styles.inlineButton}><Text style={styles.inlineText}>다시 촬영</Text></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="제품 사진 앨범에서 변경" disabled={isUploading} onPress={() => void pickPhoto('front', 'library')} style={styles.inlineButton}><Text style={styles.inlineText}>사진 변경</Text></Pressable>
              </View>
            </View>
          </View>
          {photos.extra ? <View style={styles.extraCard}>
            <Image accessibilityLabel="추가한 성분표 사진" source={{ uri: photos.extra.uri }} style={styles.extraPreview} />
            <View style={styles.extraCopy}><Text style={styles.extraTitle}>추가 사진</Text><Text style={styles.extraBody}>성분표와 복용법도 함께 확인해요.</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="추가 사진 변경" disabled={isUploading} onPress={() => setShowBackPrompt(true)} style={styles.extraEdit}><Text style={styles.inlineText}>사진 변경</Text></Pressable>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="추가 사진 제거" disabled={isUploading} onPress={() => setPhotos(current => ({ ...current, extra: null }))} style={styles.close}><X size={18} color={colors.muted} /></Pressable>
          </View> : <Pressable accessibilityRole="button" accessibilityLabel="성분표 사진 추가" disabled={isUploading} onPress={() => setShowBackPrompt(true)} style={styles.extraLink}><Plus size={18} color={colors.active} /><Text style={styles.extraLinkText}>성분표 사진도 추가할 수 있어요</Text></Pressable>}
          <View style={styles.continueSection}>
            <RitualAction fullWidth label={isUploading ? '제품 정보를 확인하고 있어요' : '제품 정보 확인하기'} loading={isUploading} onPress={() => void upload()} />
            {isUploading ? <Text accessibilityLiveRegion="polite" style={styles.waitText}>잠시만 기다려 주세요. 준비되면 결과를 보여드릴게요.</Text> : null}
          </View>
        </> : <View style={styles.startCard}>
          <RitualAction fullWidth label="사진 촬영" icon={<Camera size={21} color={colors.white} />} onPress={() => void pickPhoto('front', 'camera')} />
          <RitualAction fullWidth tone="secondary" label="앨범에서 선택" icon={<ImageIcon size={20} color={colors.active} />} onPress={() => void pickPhoto('front', 'library')} />
          <View style={styles.hintRow}><View style={styles.hintLine} /><Text style={styles.hint}>글씨가 선명할수록 더 잘 찾을 수 있어요</Text><View style={styles.hintLine} /></View>
        </View>}

        {failure ? <RitualSurface variant="warning" style={styles.errorCard}>
          <Text accessibilityRole="alert" style={styles.errorText}>{failure.message}</Text>
          <RitualAction fullWidth tone="secondary" label={failure.kind === 'capture' || failure.kind === 'image' ? '사진 다시 준비하기' : '다시 시도'} disabled={isUploading}
            onPress={() => { if (failure.kind === 'capture' || failure.kind === 'image') void pickPhoto('front', 'camera'); else void upload(); }} />
          {failure.kind === 'capture' || failure.kind === 'analysis' ? <RitualAction fullWidth tone="quiet" label="직접 입력으로 등록" onPress={() => navigation.navigate('ManualSupplement', { imageUri: photos.product?.uri })} /> : null}
        </RitualSurface> : null}
      </View>
    </ScrollView>

    <Modal animationType="fade" transparent visible={showBackPrompt} onRequestClose={() => setShowBackPrompt(false)}>
      <View style={styles.overlay}>
        <View style={styles.prompt}>
          <View style={styles.promptHeader}><Text style={styles.promptTitle}>뒷면도 찍어볼까요?</Text><Pressable accessibilityRole="button" accessibilityLabel="추가 촬영 안내 닫기" onPress={() => setShowBackPrompt(false)} style={styles.close}><X size={20} color={colors.muted} /></Pressable></View>
          <Text style={styles.promptBody}>성분표와 복용법이 보이면 제품 정보를 더 자세히 확인할 수 있어요.</Text>
          <RitualAction fullWidth label="뒷면 촬영" icon={<Camera size={19} color={colors.white} />} onPress={() => addExtra('camera')} />
          <RitualAction fullWidth tone="secondary" label="앨범에서 추가" onPress={() => addExtra('library')} />
          <RitualAction fullWidth tone="quiet" label={photos.extra ? '이 사진들로 계속' : '이 사진으로 계속'} onPress={() => void upload()} />
        </View>
      </View>
    </Modal>
  </>;
}

function imagePart(asset: Photo) {
  if (asset.file) { if (!asset.file.size) throw new ImagePreparationError(); return asset.file; }
  const file = new File(asset.uri);
  if (!file.exists || !file.size) throw new ImagePreparationError();
  return file;
}
function isScanFailure(value: unknown): value is ScanFailure {
  if (!value || typeof value !== 'object') return false;
  const failure = value as Partial<ScanFailure>;
  return typeof failure.message === 'string' && ['capture', 'image', 'analysis', 'connection'].includes(failure.kind || '');
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 48 },
  rail: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: 20 },
  heading: { marginBottom: 8, gap: 10 },
  title: { color: colors.ink, fontSize: 28, lineHeight: 39, fontWeight: '700', letterSpacing: -0.7 },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 24 },
  startCard: { backgroundColor: colors.surface, padding: 20, borderRadius: 18, gap: 14 },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 10, marginBottom: 2 },
  hint: { color: colors.muted, fontSize: 11, lineHeight: 18, textAlign: 'center', flexShrink: 1 },
  hintLine: { flex: 1, maxWidth: 24, height: 1, backgroundColor: colors.line },
  photoCard: { backgroundColor: colors.surface, borderRadius: 18, overflow: 'hidden' },
  preview: { width: '100%', height: 300, backgroundColor: colors.surfaceMuted },
  photoFooter: { paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  photoLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  photoLabelText: { color: colors.inkSoft, fontSize: 13, fontWeight: '500' },
  inlineActions: { flexDirection: 'row', gap: 12 },
  inlineButton: { minHeight: 44, justifyContent: 'center' },
  inlineText: { color: colors.active, fontSize: 13, fontWeight: '600' },
  extraCard: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 16, padding: 14, gap: 14 },
  extraPreview: { width: 66, height: 86, borderRadius: 8 },
  extraCopy: { flex: 1, gap: 5 },
  extraTitle: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  extraBody: { color: colors.muted, fontSize: 12, lineHeight: 20 },
  extraEdit: { minHeight: 36, justifyContent: 'center', alignSelf: 'flex-start' },
  extraLink: { flexDirection: 'row', alignItems: 'center', minHeight: 48, gap: 8, alignSelf: 'flex-start' },
  extraLinkText: { color: colors.active, fontSize: 13, fontWeight: '500' },
  continueSection: { gap: 10, marginTop: 4 },
  waitText: { color: colors.muted, fontSize: 13, lineHeight: 22, textAlign: 'center' },
  errorCard: { gap: 12 }, errorText: { color: colors.ink, fontSize: 14, lineHeight: 24 },
  overlay: { flex: 1, backgroundColor: 'rgba(32,39,51,0.46)', justifyContent: 'center', padding: 24 },
  prompt: { width: '100%', maxWidth: 420, alignSelf: 'center', padding: 24, backgroundColor: colors.surface, borderRadius: 22, gap: 12 },
  promptHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  promptTitle: { color: colors.ink, fontSize: 21, lineHeight: 30, fontWeight: '700', flex: 1 },
  promptBody: { color: colors.inkSoft, fontSize: 14, lineHeight: 24, marginBottom: 8 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10, marginTop: -6 },
});
