export type DoseNotificationTarget = { supplementId: number; doseDate?: string; doseTime?: string };

export function doseNotificationTarget(data: Record<string, unknown>): DoseNotificationTarget | null {
  const supplementId = Number(data.supplementId);
  if (!Number.isSafeInteger(supplementId) || supplementId <= 0) return null;
  const { doseDate, doseTime } = data;
  if (typeof doseDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(doseDate)
    && Number.isFinite(Date.parse(doseDate + 'T00:00:00Z'))
    && new Date(doseDate + 'T00:00:00Z').toISOString().slice(0, 10) === doseDate
    && typeof doseTime === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(doseTime)) {
    return { supplementId, doseDate, doseTime };
  }
  return { supplementId };
}
