import type { DoseStatus, TodayDose } from '../api/types';

export function sortTodayDosesForDisplay(doses: TodayDose[]) {
  return [...doses].sort((left, right) => {
    const leftChecked = left.status ? 1 : 0;
    const rightChecked = right.status ? 1 : 0;
    if (leftChecked !== rightChecked) {
      return leftChecked - rightChecked;
    }
    return (left.confirmedTime ?? '09:00').localeCompare(right.confirmedTime ?? '09:00');
  });
}

export function applyTodayDoseStatus(doses: TodayDose[], target: TodayDose, status: DoseStatus): TodayDose[] {
  return doses.map((dose) => isSameTodayDose(dose, target) ? { ...dose, status } : dose);
}

export function clearTodayDoseStatus(doses: TodayDose[], target: TodayDose): TodayDose[] {
  return doses.map((dose) => {
    if (!isSameTodayDose(dose, target)) {
      return dose;
    }
    const { status: _status, ...clearedDose } = dose;
    return clearedDose;
  });
}

function isSameTodayDose(left: TodayDose, right: TodayDose) {
  return left.supplementId === right.supplementId
    && (left.confirmedTime ?? '09:00') === (right.confirmedTime ?? '09:00');
}
