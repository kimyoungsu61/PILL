import { manualSupplementInitialValues, normalizeManualDoseTimes } from './ManualSupplementScreen.helpers';

const normalized = normalizeManualDoseTimes(['09:00', ' 19:00 ', '09:00']);
if (normalized.join(',') !== '09:00,19:00') {
  throw new Error(`Manual dose times should trim and dedupe: ${normalized.join(',')}`);
}

if (normalizeManualDoseTimes(['']).join(',') !== '09:00') {
  throw new Error('Manual dose times should default to 09:00 when blank.');
}

if (normalizeManualDoseTimes(['08:00', '13:00', '19:00', '21:00']).length !== 3) {
  throw new Error('Manual dose times should keep at most three values.');
}

const initialValues = manualSupplementInitialValues({
  brandName: '  종근당  ',
  productName: '  유산균 골드  ',
  suggestedUseKo: '하루 2번',
  doseTimes: ['09:00', ' 19:00 ', '09:00'],
  imageUri: ' file:///front-label.jpg ',
});
if (initialValues.brandName !== '종근당') {
  throw new Error(`Manual draft should trim brand name: ${initialValues.brandName}`);
}
if (initialValues.productName !== '유산균 골드') {
  throw new Error(`Manual draft should trim product name: ${initialValues.productName}`);
}
if (initialValues.doseTimes.join(',') !== '09:00,19:00') {
  throw new Error(`Manual draft should normalize dose times: ${initialValues.doseTimes.join(',')}`);
}
if (initialValues.imageUri !== 'file:///front-label.jpg') {
  throw new Error(`Manual draft should trim image uri: ${initialValues.imageUri}`);
}
