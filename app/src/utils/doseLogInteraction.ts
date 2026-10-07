import type { DoseStatus } from '../api/types';

export function doseStatusText(status: DoseStatus) {
  return status === 'TAKEN' ? '복용 완료' : '건너뜀';
}

export function shouldConfirmDoseChange(currentStatus: DoseStatus | undefined, nextStatus: DoseStatus) {
  return Boolean(currentStatus && currentStatus !== nextStatus);
}

export function doseChangeConfirmationMessage(currentStatus: DoseStatus, nextStatus: DoseStatus) {
  return `현재 기록: ${doseStatusText(currentStatus)}. ${doseStatusText(nextStatus)}으로 바꿀까요?`;
}
