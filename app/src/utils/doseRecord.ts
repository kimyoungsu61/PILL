import type { DoseStatus } from '../api/types';
import { completionPercent } from '../garden/types';

export const DOSE_RECORD_OPTIONS: ReadonlyArray<{ status: DoseStatus; label: string }> = [
  { status: 'TAKEN', label: '먹었어요' },
  { status: 'SKIPPED', label: '못 먹었어요' },
  { status: 'UNKNOWN', label: '기억이 안 나요' },
];

export function isRecordedDose(status?: string): status is DoseStatus {
  return status === 'TAKEN' || status === 'SKIPPED' || status === 'UNKNOWN';
}

export function doseRecordLabel(status?: string) {
  return DOSE_RECORD_OPTIONS.find(option => option.status === status)?.label ?? '아직 기록하지 않았어요';
}

// An explicit UNKNOWN is a completed record, never evidence of ingestion.
export function summarizeDoseRecords(doses: ReadonlyArray<{ status?: string }>) {
  const total = doses.length;
  const taken = doses.filter(dose => dose.status === 'TAKEN').length;
  const skipped = doses.filter(dose => dose.status === 'SKIPPED').length;
  const unknown = doses.filter(dose => dose.status === 'UNKNOWN').length;
  const recorded = taken + skipped + unknown;
  return { total, taken, skipped, unknown, recorded, unrecorded: total - recorded,
    recordPercent: completionPercent(recorded, total), takenPercent: completionPercent(taken, total) };
}
