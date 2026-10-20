import {
  deferredCaptureSource,
  nextScanPhotos,
  requestBackCaptureAfterPrompt,
  scanFailureKind,
} from './ImageInputScreen.helpers';

for (const source of ['camera', 'library'] as const) {
  const confirmState = requestBackCaptureAfterPrompt(source);
  if (confirmState.isBackPromptVisible || confirmState.pendingSource !== source) {
    throw new Error('Additional photo selection must close its prompt and queue the selected source.');
  }
  if (deferredCaptureSource({ isBackPromptVisible: true, pendingSource: source }) !== null) {
    throw new Error('A native camera or album must not open over the prompt.');
  }
  if (deferredCaptureSource(confirmState) !== source) {
    throw new Error('The selected camera or album must open after the prompt closes.');
  }
}

if (deferredCaptureSource({ isBackPromptVisible: false, pendingSource: null }) !== null) {
  throw new Error('Photo selection must stay idle when no source is queued.');
}

const originalPhotos = { product: 'bottle-one', extra: 'ingredients-one' };
const replacedProduct = nextScanPhotos(originalPhotos, 'front', 'bottle-two');
if (replacedProduct.product !== 'bottle-two' || replacedProduct.extra !== null) {
  throw new Error('Replacing the product photo must discard the previous product ingredient label.');
}
const replacedExtra = nextScanPhotos(originalPhotos, 'back', 'ingredients-two');
if (replacedExtra.product !== 'bottle-one' || replacedExtra.extra !== 'ingredients-two') {
  throw new Error('Replacing an extra photo must preserve the selected product photo.');
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
