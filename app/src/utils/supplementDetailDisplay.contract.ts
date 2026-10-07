import type { SupplementDetailResponse } from '../api/types';
import { clearTodayDetailDoseLog } from './supplementDetailDisplay';

const detail: SupplementDetailResponse = {
  id: 10,
  brandName: 'Brand',
  productName: 'Product',
  confirmedDoseTime: '09:00,19:00',
  ingredients: [],
  doseLogs: [
    { doseDate: '2026-06-30', doseTime: '09:00', status: 'TAKEN', checkedAt: '2026-06-30T09:05:00' },
    { doseDate: '2026-06-30', doseTime: '19:00', status: 'SKIPPED', checkedAt: '2026-06-30T19:05:00' },
    { doseDate: '2026-06-29', doseTime: '09:00', status: 'TAKEN', checkedAt: '2026-06-29T09:05:00' },
  ],
};

const cleared = clearTodayDetailDoseLog(detail, '09:00', '2026-06-30');
const remainingLogs = cleared.doseLogs.map((log) => `${log.doseDate}:${log.doseTime}:${log.status}`).join('|');

if (remainingLogs !== '2026-06-30:19:00:SKIPPED|2026-06-29:09:00:TAKEN') {
  throw new Error(`Only the requested today dose log should be cleared: ${remainingLogs}`);
}

if (detail.doseLogs.length !== 3) {
  throw new Error('The original detail response should not be mutated.');
}
