import type { ScanResult } from './types';

const scanResultContract: ScanResult = {
  scanId: 1,
  status: 'COMPLETED',
  brandName: 'Sample Brand',
  productName: 'Sample Product',
  suggestedUseKo: '하루 1회',
  suggestedUseOriginal: 'Once daily',
  warningsKo: '주의 문구',
  warningsOriginal: 'Warning text',
  originalLabelText: 'Original label text',
  recommendedDoseTime: '08:00',
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
};

void scanResultContract;
