import type { ScanResult } from '../api/types';
import { scanRecognitionPresentation } from './scanRecognitionPresentation';

const base: ScanResult = {
  scanId: 1, status: 'COMPLETED', brandName: '', productName: '', ingredients: [],
  suggestedUseKo: '', suggestedUseOriginal: '', warningsKo: '', warningsOriginal: '',
  originalLabelText: '', recommendedDoseTime: '',
};
const soju = scanRecognitionPresentation({ ...base, recognition: {
  category: 'ALCOHOL', displayName: '참이슬 fresh 소주', confidence: 0.98,
  messageKo: '소주를 찍으셨네요. 건강을 위해 음주는 줄여 주세요.', registrationAllowed: false,
} });
if (soju.canRegister || soju.displayName !== '참이슬 fresh 소주' || !soju.message.includes('소주')) {
  throw Error('Soju should retain its identified name and friendly note while blocking supplement registration.');
}
const forgedAlcohol = scanRecognitionPresentation({ ...base, recognition: {
  category: 'ALCOHOL', displayName: '소주', confidence: 1, messageKo: '', registrationAllowed: true,
} });
if (forgedAlcohol.canRegister) throw Error('A nonsupplement category must stay blocked even with an inconsistent server flag.');
const supplementRecognition = {
  category: 'SUPPLEMENT' as const, displayName: '마그네슘', confidence: 0.96,
  messageKo: '', registrationAllowed: true,
};
if (!scanRecognitionPresentation({ ...base, recognition: supplementRecognition }).canRegister) {
  throw Error('Confident supplement recognition with server permission should preserve registration.');
}
for (const confidence of [0.79, -1, 1.01, Number.NaN, Number.POSITIVE_INFINITY]) {
  const uncertain = scanRecognitionPresentation({ ...base, recognition: { ...supplementRecognition, confidence } });
  if (uncertain.canRegister || uncertain.displayName === '마그네슘') {
    throw Error('Uncertain or malformed recognition must neither permit registration nor assert an object identity.');
  }
}
const noPermission = scanRecognitionPresentation({ ...base, recognition: { ...supplementRecognition, registrationAllowed: false } });
if (noPermission.canRegister) throw Error('The server registration gate must not be inferred from category alone.');
if (scanRecognitionPresentation({ ...base, recognition: { ...supplementRecognition, displayName: ' ' } }).canRegister) {
  throw Error('A missing target identity must not permit supplement registration.');
}
if (scanRecognitionPresentation(base).canRegister) throw Error('Legacy scans without classification require another photo.');
const unclassified = scanRecognitionPresentation({ ...base, recognition: {
  category: 'UNKNOWN', displayName: '콜라', confidence: 1, messageKo: '카페인이 있어요', registrationAllowed: true,
} });
if (unclassified.canRegister || unclassified.displayName.includes('콜라') || unclassified.message.includes('카페인')) {
  throw Error('Unknown recognition must not turn provider guesses into factual product or health claims.');
}
if (scanRecognitionPresentation({ ...base, status: 'FAILED', recognition: supplementRecognition }).canRegister) {
  throw Error('Only successfully completed scans may be registered.');
}
