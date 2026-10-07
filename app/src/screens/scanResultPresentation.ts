import type { ScanIngredient, ScanResult } from '../api/types';

export function scanResultPresentation(result: ScanResult) {
  const research = result.research;
  const candidate = research?.status === 'CANDIDATE' ? research.candidate : undefined;
  const hasWebDetails = Boolean(candidate);
  const toText = (value: unknown) => typeof value === 'string' ? value.trim() : '';
  const photoIngredients = Array.isArray(result.ingredients) ? result.ingredients : [];
  const researchedIngredients = Array.isArray(candidate?.ingredients) ? candidate.ingredients : [];
  const useWebIngredients = hasWebDetails && researchedIngredients.length > 0
    && (!photoIngredients.length || (!toText(result.servingBasisKo) && photoIngredients.every(item => !toText(item.amount))));
  const ingredients: ScanIngredient[] = useWebIngredients
    ? researchedIngredients.map((item) => ({
      name: toText(item.name), amount: toText(item.amount), unit: toText(item.unit),
      originalText: toText(item.originalText), confidence: 0, needsReview: true,
    }))
    : photoIngredients;

  const sources: Array<{ title: string; url: string }> = [];
  const seen = new Set<string>();
  for (const source of research?.sources ?? []) {
    try {
      const url = new URL(source.url);
      if (url.protocol !== 'https:' || seen.has(url.toString())) continue;
      seen.add(url.toString());
      sources.push({ title: toText(source.title) || url.hostname, url: url.toString() });
    } catch {
      // Ignore invalid provider links rather than showing a broken action.
    }
  }

  return {
    hasWebDetails,
    brandName: toText(result.brandName) || toText(candidate?.brandName),
    productName: toText(result.productName) || toText(candidate?.productName),
    suggestedUseKo: toText(result.suggestedUseKo) || toText(candidate?.suggestedUseKo),
    suggestedUseOriginal: toText(result.suggestedUseOriginal) || toText(candidate?.suggestedUseOriginal),
    warningsKo: toText(result.warningsKo) || toText(candidate?.warningsKo),
    warningsOriginal: toText(result.warningsOriginal) || toText(candidate?.warningsOriginal),
    originalLabelText: toText(result.originalLabelText),
    servingBasisKo: useWebIngredients
      ? toText(candidate?.servingBasisKo)
      : toText(result.servingBasisKo),
    ingredients,
    productInformation: result.productInformation,
    sources,
  };
}
