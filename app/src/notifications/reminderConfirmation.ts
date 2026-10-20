import type { ReminderDose } from './webPush';

export type ReminderConfirmation = { title: string; detail: string };

export function reminderConfirmation(dose: ReminderDose): ReminderConfirmation {
  const occurrence = `${dose.name} · ${dose.doseDate.replaceAll('-', '.')} ${dose.doseTime}`;
  // Another device may already have recorded this dose. Always describe the saved result.
  if (dose.status === 'TAKEN') return { title: '복용 완료로 기록했어요', detail: occurrence };
  if (dose.status === 'SKIPPED') return { title: '이번 복용을 건너뛰었어요', detail: occurrence };
  const next = dose.nextReminderAt ? new Date(dose.nextReminderAt) : null;
  if (next && Number.isFinite(next.getTime())) {
    const time = next.toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    return { title: '다시 알림을 예약했어요', detail: `${dose.name} · ${time}에 다시 알려드릴게요.` };
  }
  throw new Error('처리 결과를 확인하지 못했어요. 다시 시도해 주세요.');
}
