import type { SupplementDetailResponse } from '../api/types';

export function clearTodayDetailDoseLog(
  detail: SupplementDetailResponse,
  doseTime: string,
  today = todayKey(),
): SupplementDetailResponse {
  return {
    ...detail,
    doseLogs: detail.doseLogs.filter((log) => {
      const logDoseTime = log.doseTime || firstDoseTime(detail.confirmedDoseTime);
      return !(log.doseDate === today && logDoseTime === doseTime);
    }),
  };
}

function firstDoseTime(value?: string) {
  return value?.split(',').map((time) => time.trim()).find(Boolean) ?? '09:00';
}

function todayKey() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}
