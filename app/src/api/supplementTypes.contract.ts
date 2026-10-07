import type { SupplementDetailResponse } from './types';

const detailContract: SupplementDetailResponse = {
  id: 1,
  brandName: 'Sample Brand',
  productName: 'Sample Product',
  suggestedUseKo: '하루 1회',
  suggestedUseOriginal: 'Once daily',
  summaryKo: '샘플 영양제',
  originalLabelText: 'Original label text',
  warningSummary: '주의 문구',
  confirmedDoseTime: '08:00',
  ingredients: [
    {
      name: 'Vitamin C',
      amount: '500',
      unit: 'mg',
      originalText: 'Vitamin C 500mg',
      confidence: 0.95,
      needsReview: false,
    },
  ],
  doseLogs: [
    {
      doseDate: '2026-06-28',
      doseTime: '08:00',
      status: 'TAKEN',
      memo: '아침',
      checkedAt: '2026-06-28T08:00:00',
    },
  ],
};

void detailContract;
