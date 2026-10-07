import type { ScanIngredient } from '../api/types';
import {
  cleanScanText,
  doseCountSummaryText,
  doseTimeSummaryText,
  ingredientAmountText,
  ingredientCompactMetaText,
  ingredientConfidenceText,
  ingredientReviewSummary,
  scanReviewState,
  scanSaveWarnings,
} from './ScanResultScreen.helpers';

const ingredient: ScanIngredient = {
  name: 'Vitamin C',
  amount: '1000',
  unit: 'mg',
  originalText: 'Vitamin C 1000mg',
  confidence: 0.92,
  needsReview: false,
};

const productReviewState = scanReviewState([], false);
if (productReviewState.label !== '제품 확인 필요' || productReviewState.tone !== 'active') {
  throw new Error('Scan review state should require product confirmation first.');
}

const warningReviewState = scanReviewState(['warning one', 'warning two'], true);
if (warningReviewState.label !== '2개 확인 필요' || warningReviewState.tone !== 'warning') {
  throw new Error('Scan review state should count warnings after product confirmation.');
}

const completedReviewState = scanReviewState([], true);
if (completedReviewState.label !== '저장 준비 완료' || completedReviewState.tone !== 'completed') {
  throw new Error('Scan review state should describe a completed review.');
}

if (ingredientAmountText(ingredient) !== '1000 mg') {
  throw new Error('Ingredient amount text should combine amount and unit.');
}

if (ingredientAmountText({ ...ingredient, amount: '', unit: '' }) !== '함량 정보 없음') {
  throw new Error('Ingredient amount text should fallback when amount is missing.');
}

if (ingredientCompactMetaText({ ...ingredient, needsReview: true }) !== '1000 mg') {
  throw new Error('Ingredient compact meta text should stay focused on amount and not expose review state.');
}

if (ingredientConfidenceText(ingredient) !== '신뢰도 92%') {
  throw new Error('Ingredient confidence text should round confidence percent.');
}

if (ingredientReviewSummary([]) !== '인식된 성분 없음') {
  throw new Error('Ingredient review summary should describe empty ingredients.');
}

if (ingredientReviewSummary([{ ...ingredient, needsReview: true }]) !== '1개 확인 필요') {
  throw new Error('Ingredient review summary should count ingredients that need review.');
}

if (ingredientReviewSummary([ingredient]) !== '성분 확인 양호') {
  throw new Error('Ingredient review summary should describe reviewed ingredients.');
}

if (doseCountSummaryText(['09:00', '19:00']) !== '하루 2번') {
  throw new Error('Dose count summary should describe how many reminders will be created.');
}

if (doseCountSummaryText(['09:00', '']) !== '하루 1번') {
  throw new Error('Dose count summary should ignore blank reminder times.');
}

if (doseTimeSummaryText(['09:00', '19:00']) !== '09:00 · 19:00') {
  throw new Error('Dose time summary should join reminder times for scan review.');
}

const saveWarnings = scanSaveWarnings({
  productName: '',
  suggestedUseKo: '',
  isProductConfirmed: false,
  ingredients: [{ ...ingredient, needsReview: true }],
});

if (!saveWarnings.includes('제품명이 비어 있어요.')) {
  throw new Error('Save warnings should include missing product name.');
}

if (!saveWarnings.includes('복용 안내가 비어 있어요.')) {
  throw new Error('Save warnings should include missing suggested use.');
}

if (!saveWarnings.includes('확인이 필요한 성분이 있어요.')) {
  throw new Error('Save warnings should include ingredients that need review.');
}

if (!saveWarnings.includes('제품이 맞는지 아직 확인하지 않았어요.')) {
  throw new Error('Save warnings should include unconfirmed product selection.');
}

if (!scanSaveWarnings({ productName: 'Vitamin C', suggestedUseKo: '하루 1번', ingredients: [] }).includes('인식된 성분이 없어요.')) {
  throw new Error('Save warnings should include missing ingredients.');
}

const tunnelHtml = '<!DOCTYPE html><html><head><title>Temporary tunnel | 502: Bad gateway</title></head><body>Tunnel Error</body></html>';
if (cleanScanText(tunnelHtml) !== '') {
  throw new Error('Tunnel HTML error pages should not be shown as scan text.');
}

if (cleanScanText('Take 2 tablets daily.') !== 'Take 2 tablets daily.') {
  throw new Error('Normal scan text should stay unchanged.');
}

if (ingredientAmountText({ ...ingredient, amount: '', unit: 'mg' }) !== '함량 정보 없음') throw Error('A unit alone must not be displayed as a known ingredient amount.');
