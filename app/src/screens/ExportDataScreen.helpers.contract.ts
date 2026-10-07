import type { ExportDataResponse } from '../api/types';
import {
  buildDoseHistoryCsv,
  buildSupplementCsv,
  exportFileStamp,
  exportRangeLabel,
} from './ExportDataScreen.helpers';

const data: ExportDataResponse = {
  email: 'owner@example.com',
  generatedAt: '2026-07-29T16:30:00',
  supplements: [
    {
      id: 1,
      brandName: 'Healthy "Lab"',
      productName: '=Formula Product',
      displayNameKo: '비타민 C',
      suggestedUseKo: '하루 한 번',
      doseTimes: ['09:00', '19:00'],
      warningSummary: '식후 복용',
      createdAt: '2026-07-20T10:00:00',
      ingredients: [
        { name: 'Vitamin C', amount: '500', unit: 'mg', needsReview: false },
      ],
    },
  ],
  doseHistory: {
    from: '2026-07-23',
    to: '2026-07-29',
    summary: { total: 1, taken: 1, skipped: 0, missed: 0, completionRate: 100 },
    entries: [
      {
        supplementId: 1,
        displayNameKo: '비타민 C',
        doseDate: '2026-07-29',
        doseTime: '09:00',
        status: 'TAKEN',
        memo: '아침, 식후',
        checkedAt: '2026-07-29T09:01:00',
      },
    ],
  },
};

const supplementCsv = buildSupplementCsv(data);
if (!supplementCsv.includes('"비타민 C"') || !supplementCsv.includes('"09:00 / 19:00"')) {
  throw new Error('Supplement CSV should include display names and every dose time.');
}
if (!supplementCsv.includes('"Healthy ""Lab"""') || !supplementCsv.includes('"\'=Formula Product"')) {
  throw new Error('CSV should escape quotes and neutralize spreadsheet formulas.');
}

const doseCsv = buildDoseHistoryCsv(data);
if (!doseCsv.includes('"복용 완료"') || !doseCsv.includes('"아침, 식후"')) {
  throw new Error('Dose CSV should localize statuses and preserve comma-containing memos.');
}
if (exportFileStamp(data.generatedAt) !== '20260729_1630') {
  throw new Error('Export filenames should use a stable timestamp.');
}
if (exportRangeLabel('2026-07-23', '2026-07-29') !== '7월 23일 – 7월 29일') {
  throw new Error('Export range should be concise and localized.');
}

console.log('ExportDataScreen helper contract passed.');
