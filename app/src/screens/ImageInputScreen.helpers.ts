export type ScanSide = 'front' | 'back';

export type ScanFailureKind = 'capture' | 'image' | 'analysis' | 'connection';

export type ScanPhotoSource = 'camera' | 'library';

export type DeferredCaptureState = {
  isBackPromptVisible: boolean;
  pendingSource: ScanPhotoSource | null;
};

export function requestBackCaptureAfterPrompt(source: ScanPhotoSource): DeferredCaptureState {
  return {
    isBackPromptVisible: false,
    pendingSource: source,
  };
}

export function deferredCaptureSource(state: DeferredCaptureState): ScanPhotoSource | null {
  if (state.isBackPromptVisible) {
    return null;
  }
  return state.pendingSource;
}

export function nextScanPhotos<T>(photos: { product: T | null; extra: T | null }, side: ScanSide, photo: T) {
  // A new product photo must never reuse another product's ingredient label.
  return side === 'front' ? { product: photo, extra: null } : { ...photos, extra: photo };
}

export function scanFailureKind(status: number | undefined, responseBody = ''): ScanFailureKind {
  const normalized = responseBody.toUpperCase();

  if (normalized.includes('PROVIDER_UNAVAILABLE')) {
    return 'analysis';
  }
  if (normalized.includes('INVALID_IMAGE') || normalized.includes('UPLOAD_TOO_LARGE')) {
    return 'image';
  }
  if (status !== undefined && status >= 500) {
    return 'analysis';
  }
  return 'connection';
}
