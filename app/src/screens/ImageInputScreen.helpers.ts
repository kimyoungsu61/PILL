export type ScanSide = 'front' | 'back';

export type ScanFailureKind = 'capture' | 'image' | 'analysis' | 'connection';

export type DeferredCameraState = {
  isBackPromptVisible: boolean;
  pendingCameraSide: ScanSide | null;
};

export function requestBackCameraAfterPrompt(): DeferredCameraState {
  return {
    isBackPromptVisible: false,
    pendingCameraSide: 'back',
  };
}

export function deferredCameraSide(state: DeferredCameraState): ScanSide | null {
  if (state.isBackPromptVisible) {
    return null;
  }
  return state.pendingCameraSide;
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
