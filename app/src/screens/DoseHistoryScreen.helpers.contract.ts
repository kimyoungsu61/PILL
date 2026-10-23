import type { DoseHistoryEntry } from '../api/types';
import {
  doseHistoryStatusLabel,
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

const unknownEntry: DoseHistoryEntry = {
  supplementId: 4, productName: 'Vitamin C', doseDate: '2026-07-29', doseTime: '21:00',
  status: 'UNKNOWN', checkedAt: '2026-07-29T21:01:00',
};
const mixedGroup = groupDoseHistory([...entries, unknownEntry])[0];
if (mixedGroup.entries.filter((entry) => entry.status === 'UNKNOWN').length !== 1
  || mixedGroup.entries.filter((entry) => entry.status === 'MISSED').length !== 1) {
  throw new Error('History must preserve uncertainty separately from absent records.');
}
if (doseHistoryStatusLabel('UNKNOWN') !== '기억이 안 나요' || doseHistoryStatusLabel('MISSED') !== '미기록'
  || doseHistoryStatusLabel('TAKEN') !== '먹었어요' || doseHistoryStatusLabel('SKIPPED') !== '못 먹었어요') {
  throw new Error('History must describe the saved answer without inferring adherence.');
}
