import type { DoseHistoryEntry } from '../api/types';
import {
  formatDoseHistoryDate,
  formatDoseHistoryTime,
  formatHistoryRange,
  groupDoseHistory,
} from './DoseHistoryScreen.helpers';

const entries: DoseHistoryEntry[] = [
  {
    supplementId: 1,
    productName: 'Vitamin D',
    doseDate: '2026-07-28',
    doseTime: '20:00',
    status: 'SKIPPED',
    checkedAt: '2026-07-28T20:01:00',
  },
  {
    supplementId: 2,
    productName: 'Magnesium',
    doseDate: '2026-07-29',
    doseTime: '09:00',
    status: 'TAKEN',
    checkedAt: '2026-07-29T09:01:00',
  },
  {
    supplementId: 1,
    productName: 'Vitamin D',
    doseDate: '2026-07-29',
    doseTime: '08:00',
    status: 'TAKEN',
    checkedAt: '2026-07-29T08:01:00',
  },
  {
    supplementId: 3,
    productName: 'Milk Thistle',
    doseDate: '2026-07-29',
    doseTime: '20:00',
    status: 'MISSED',
  },
];

const groups = groupDoseHistory(entries);
if (groups.length !== 2 || groups[0].date !== '2026-07-29') {
  throw new Error('Dose history should be grouped by descending date.');
}
if (groups[0].entries.map((entry) => entry.doseTime).join(',') !== '08:00,09:00,20:00') {
  throw new Error('Entries within a day should be ordered by dose time.');
}
if (formatDoseHistoryDate('2026-07-29', '2026-07-29') !== '오늘') {
  throw new Error('Today should use the concise Korean label.');
}
if (formatDoseHistoryDate('2026-07-28', '2026-07-29') !== '어제') {
  throw new Error('Yesterday should use the concise Korean label.');
}
if (formatDoseHistoryTime('20:05') !== '오후 8:05') {
  throw new Error('Dose time should be localized for display.');
}
if (formatHistoryRange('2026-07-01', '2026-07-29') !== '7월 1일 – 7월 29일') {
  throw new Error('History range should use short Korean dates.');
}
