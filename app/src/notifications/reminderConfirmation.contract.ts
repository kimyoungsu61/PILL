import { reminderConfirmation } from './reminderConfirmation';
import type { ReminderDose } from './webPush';

const dose: ReminderDose = { supplementId: 1, name: '마그네슘', doseDate: '2026-10-20', doseTime: '23:59', status: '', active: true, canSnooze: true, nextReminderAt: null };
function assert(value: boolean) { if (!value) throw new Error('Reminder confirmation mismatch'); }

// Saved status takes precedence over a snooze timestamp (including another device's record).
for (const [status, label] of [['TAKEN', '먹었어요'], ['SKIPPED', '못 먹었어요'], ['UNKNOWN', '기억이 안 나요']]) {
  const saved = reminderConfirmation({ ...dose, status, nextReminderAt: 'invalid' });
  assert(saved.title === '기록을 저장했어요');
  assert(saved.detail.includes(dose.name) && saved.detail.includes('2026.10.20 23:59') && saved.detail.includes(label));
}
// Use the server's actual next date/time, including a snooze crossing midnight.
const nextReminderAt = '2026-10-21T00:14:00+09:00';
const snoozed = reminderConfirmation({ ...dose, nextReminderAt });
const expected = new Date(nextReminderAt).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
assert(snoozed.detail.includes(expected) && snoozed.detail.includes(dose.name));
for (const nextReminderAt of [null, 'invalid']) {
  let failed = false;
  try { reminderConfirmation({ ...dose, nextReminderAt }); } catch { failed = true; }
  assert(failed); // Never claim a reservation without a confirmed timestamp.
}
