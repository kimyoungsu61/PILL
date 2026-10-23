import type { ReminderDose } from './webPush';
import { doseRecordLabel, isRecordedDose } from '../utils/doseRecord';

export type ReminderConfirmation = { title: string; detail: string };

export function reminderConfirmation(dose: ReminderDose): ReminderConfirmation {
  const occurrence = `${dose.name} · ${dose.doseDate.replaceAll('-', '.')} ${dose.doseTime}`;
  // Another device may already have recorded this dose. Always describe the saved result.
  if (isRecordedDose(dose.status)) return { title: '기록을 저장했어요', detail: `${occurrence} · ${doseRecordLabel(dose.status)}` };
  const next = dose.nextReminderAt ? new Date(dose.nextReminderAt) : null;
  if (next && Number.isFinite(next.getTime())) {
    const time = next.toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    return { title: '다시 알림을 예약했어요', detail: `${dose.name} · ${time}에 다시 알려드릴게요.` };
  }
  throw new Error('처리 결과를 확인하지 못했어요. 다시 시도해 주세요.');
}
