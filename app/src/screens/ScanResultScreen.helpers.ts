import type { ScanIngredient } from '../api/types';

export function cleanScanText(value?: string) {
  const text = value?.trim() ?? '';
  if (!text) {
    return '';
  }
  const lower = text.toLowerCase();
  if (
    lower.includes('<!doctype html')
    || lower.includes('<html')
    || lower.includes('bad gateway')
    || lower.includes('cloudflare')
  ) {
    return '';
  }
  return text;
}

export function ingredientAmountText(ingredient: ScanIngredient) {
  if (!ingredient.amount?.trim()) return '함량 정보 없음';
  return [ingredient.amount, ingredient.unit].map((value) => value?.trim()).filter(Boolean).join(' ') || '함량 정보 없음';
}

export function ingredientCompactMetaText(ingredient: ScanIngredient) {
  return ingredientAmountText(ingredient);
}

export function ingredientConfidenceText(ingredient: ScanIngredient) {
  return `신뢰도 ${Math.round(ingredient.confidence * 100)}%`;
}

export function ingredientReviewSummary(ingredients: ScanIngredient[]) {
  const reviewCount = ingredients.filter((ingredient) => ingredient.needsReview).length;
  if (!ingredients.length) {
    return '인식된 성분 없음';
  }
  if (reviewCount > 0) {
    return `${reviewCount}개 확인 필요`;
  }
  return '성분 확인 양호';
}

export function scanReviewState(warnings: string[], isProductConfirmed: boolean) {
  if (!isProductConfirmed) return { label: '제품 확인 필요', tone: 'active' as const };
  if (warnings.length) return { label: `${warnings.length}개 확인 필요`, tone: 'warning' as const };
  return { label: '저장 준비 완료', tone: 'completed' as const };
}

export function doseCountSummaryText(times: string[]) {
  const count = times.map((time) => time.trim()).filter(Boolean).length || 1;
  return `하루 ${count}번`;
}

export function doseTimeSummaryText(times: string[]) {
  return times.map((time) => time.trim()).filter(Boolean).join(' · ') || '09:00';
}

type ScanSaveWarningInput = {
  productName: string;
  suggestedUseKo: string;
  isProductConfirmed?: boolean;
  ingredients: ScanIngredient[];
};

export function scanSaveWarnings(input: ScanSaveWarningInput) {
  const warnings: string[] = [];
  if (input.isProductConfirmed === false) {
    warnings.push('제품이 맞는지 아직 확인하지 않았어요.');
  }
  if (!input.productName.trim()) {
    warnings.push('제품명이 비어 있어요.');
  }
  if (!input.suggestedUseKo.trim()) {
    warnings.push('복용 안내가 비어 있어요.');
  }
  if (!input.ingredients.length) {
    warnings.push('인식된 성분이 없어요.');
  }
  if (input.ingredients.some((ingredient) => ingredient.needsReview)) {
    warnings.push('확인이 필요한 성분이 있어요.');
  }
  return warnings;
}
