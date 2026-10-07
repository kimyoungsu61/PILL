import type { SupplementSummary } from '../api/types';

export function filterSupplementsForSearch(supplements: SupplementSummary[], query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return supplements;
  }
  return supplements.filter((supplement) => {
    const haystack = [
      supplement.displayNameKo,
      supplement.productName,
      supplement.brandName,
      supplement.warningSummary,
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(needle);
  });
}

export function supplementCollectionSummary(total: number, query: string) {
  if (query.trim()) return `${total}개의 검색 결과`;
  return total ? `${total}개의 영양제` : '등록된 영양제가 없어요';
}
