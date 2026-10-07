import type { ScanHistoryEntry } from '../api/types';
import {
  filterScanHistory,
  formatScanHistoryDate,
  scanHistoryName,
  scanHistoryStatus,
} from './ScanHistoryScreen.helpers';

const baseEntry: ScanHistoryEntry = {
  scanId: 1,
  status: 'COMPLETED',
  brandName: 'Test Lab',
  productName: 'Daily Vitamin',
  displayNameKo: '종합비타민',
  imageUri: '',
  saved: false,
  ingredientCount: 3,
  reviewIngredientCount: 1,
  hasWarnings: false,
  createdAt: '2026-07-29T10:20:00',
};

const entries: ScanHistoryEntry[] = [
  baseEntry,
  { ...baseEntry, scanId: 2, saved: true, supplementId: 9 },
  { ...baseEntry, scanId: 3, status: 'FAILED' },
];

if (filterScanHistory(entries, 'SAVED').map((entry) => entry.scanId).join(',') !== '2') {
  throw new Error('Saved filter should only include saved entries.');
}
if (filterScanHistory(entries, 'REVIEW').map((entry) => entry.scanId).join(',') !== '1') {
  throw new Error('Review filter should only include completed, unsaved entries.');
}
if (filterScanHistory(entries, 'FAILED').map((entry) => entry.scanId).join(',') !== '3') {
  throw new Error('Failed filter should only include failed entries.');
}
if (scanHistoryStatus(entries[0]).action !== '분석 결과 이어보기') {
  throw new Error('Completed unsaved scans should resume their result.');
}
if (scanHistoryStatus(entries[1]).label !== '보관함 저장됨') {
  throw new Error('Saved scans should use the cabinet status.');
}
if (scanHistoryName(baseEntry) !== '종합비타민') {
  throw new Error('Korean display name should be preferred.');
}
const formattedToday = formatScanHistoryDate(
  '2026-07-29T10:20:00',
  new Date('2026-07-29T18:00:00'),
);
if (!formattedToday.startsWith('오늘 ') || !formattedToday.includes('10:20')) {
  throw new Error(`Same-day scans should use a concise localized time: ${formattedToday}`);
}

console.log('ScanHistoryScreen helper contract passed.');
