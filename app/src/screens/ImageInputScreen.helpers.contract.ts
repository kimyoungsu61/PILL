import {
  deferredCameraSide,
  requestBackCameraAfterPrompt,
  scanFailureKind,
} from './ImageInputScreen.helpers';

const confirmState = requestBackCameraAfterPrompt();

if (confirmState.isBackPromptVisible) {
  throw new Error('Back capture confirmation should close the prompt before opening camera.');
}

if (confirmState.pendingCameraSide !== 'back') {
  throw new Error(`Back capture confirmation should queue back camera: ${confirmState.pendingCameraSide}`);
}

if (deferredCameraSide({ isBackPromptVisible: true, pendingCameraSide: 'back' }) !== null) {
  throw new Error('Deferred camera should not launch while the back prompt is still visible.');
}

if (deferredCameraSide(confirmState) !== 'back') {
  throw new Error('Deferred camera should launch the queued back camera after the prompt closes.');
}

if (deferredCameraSide({ isBackPromptVisible: false, pendingCameraSide: null }) !== null) {
  throw new Error('Deferred camera should stay idle when no camera is queued.');
}

if (scanFailureKind(503, '{"code":"PROVIDER_UNAVAILABLE"}') !== 'analysis') {
  throw new Error('Provider failures should be presented as AI analysis failures.');
}

if (scanFailureKind(413, '{"code":"UPLOAD_TOO_LARGE"}') !== 'image') {
  throw new Error('Upload-size failures should ask for a new photo, not manual registration.');
}

if (scanFailureKind(undefined) !== 'connection') {
  throw new Error('Network failures should be distinguishable from AI analysis failures.');
}
