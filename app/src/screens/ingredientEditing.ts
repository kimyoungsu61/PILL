import type { ScanIngredient } from '../api/types';

export const MAX_INGREDIENTS = 100;
export type IngredientDraft = ScanIngredient & { key: number };

export function createIngredientDraft(ingredients: ScanIngredient[]): IngredientDraft[] {
  return ingredients.map((ingredient, key) => ({ ...ingredient, key }));
}

export function newIngredientDraft(key: number): IngredientDraft {
  return { key, name: '', amount: '', unit: '', originalText: '', confidence: 0, needsReview: true };
}

export function editIngredientField(draft: IngredientDraft, field: 'name' | 'amount' | 'unit', value: string): IngredientDraft {
  return { ...draft, [field]: value, confidence: 0, needsReview: true };
}

export function finishIngredientDraft(draft: IngredientDraft[], servingBasisKo: string):
  | { ok: true; ingredients: ScanIngredient[]; servingBasisKo: string }
  | { ok: false; message: string; invalidIndex?: number } {
  if (draft.length > MAX_INGREDIENTS) return { ok: false, message: '성분은 100개까지 입력할 수 있습니다.' };
  const invalidIndex = draft.findIndex(item => !item.name.trim() || item.name.trim().length > 255
    || item.amount.trim().length > 80 || item.unit.trim().length > 40);
  if (invalidIndex !== -1) return { ok: false, invalidIndex, message: !draft[invalidIndex].name.trim() ? `${invalidIndex + 1}번째 성분명을 입력해 주세요.` : `${invalidIndex + 1}번째 성분 정보를 짧게 입력해 주세요.` };
  const basis = servingBasisKo.trim();
  if (basis.length > 255) return { ok: false, message: '함량 기준은 255자 이내로 입력해 주세요.' };
  return {
    ok: true, servingBasisKo: basis,
    ingredients: draft.map(({ key: _key, ...item }) => ({
      ...item, name: item.name.trim(), amount: item.amount.trim(), unit: item.unit.trim(),
      // Confirmation records the user's review, not a calibrated AI confidence score.
      needsReview: !item.amount.trim(),
    })),
  };
}
