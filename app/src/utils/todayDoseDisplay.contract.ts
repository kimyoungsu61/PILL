import { applyTodayDoseStatus, clearTodayDoseStatus, sortTodayDosesForDisplay } from './todayDoseDisplay';
import type { TodayDose } from '../api/types';

function dose(supplementId: number, confirmedTime: string, status?: TodayDose['status']): TodayDose {
  return {
    supplementId,
    productName: `Product ${supplementId}`,
    displayNameKo: `제품 ${supplementId}`,
    imageUri: undefined,
    confirmedTime,
    status,
  };
}

const sorted = sortTodayDosesForDisplay([
  dose(1, '19:00', 'TAKEN'),
  dose(2, '13:00'),
  dose(3, '09:00', 'SKIPPED'),
  dose(4, '08:00'),
]);

const order = sorted.map((item) => `${item.supplementId}:${item.confirmedTime}`).join(',');
if (order !== '4:08:00,2:13:00,3:09:00,1:19:00') {
  throw new Error(`Today dose display order is wrong: ${order}`);
}

const updated = applyTodayDoseStatus([
  dose(10, '09:00'),
  dose(10, '19:00'),
  dose(11, '09:00'),
], dose(10, '19:00'), 'TAKEN');

const statusSummary = updated.map((item) => `${item.supplementId}:${item.confirmedTime}:${item.status ?? 'PENDING'}`).join('|');
if (statusSummary !== '10:09:00:PENDING|10:19:00:TAKEN|11:09:00:PENDING') {
  throw new Error(`Only the matching today dose should change status: ${statusSummary}`);
}

const cleared = clearTodayDoseStatus([
  dose(10, '09:00', 'TAKEN'),
  dose(10, '19:00', 'SKIPPED'),
], dose(10, '09:00', 'TAKEN'));

const clearSummary = cleared.map((item) => `${item.confirmedTime}:${item.status ?? 'PENDING'}`).join('|');
if (clearSummary !== '09:00:PENDING|19:00:SKIPPED') {
  throw new Error(`Only the matching today dose should clear status: ${clearSummary}`);
}
