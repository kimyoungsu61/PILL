import { doseNotificationTarget } from './doseNotificationTarget';

const assert = {
  equal(actual: unknown, expected: unknown) { if (actual !== expected) throw new Error('Notification target mismatch'); },
  deepEqual(actual: unknown, expected: unknown) { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('Notification target mismatch'); },
};

assert.equal(doseNotificationTarget({ supplementId: -1 }), null);
assert.equal(doseNotificationTarget({ supplementId: 'bad' }), null);
assert.deepEqual(doseNotificationTarget({ supplementId: '7' }), { supplementId: 7 });
assert.deepEqual(doseNotificationTarget({ supplementId: 7, doseDate: '2026-10-20', doseTime: '23:59' }),
  { supplementId: 7, doseDate: '2026-10-20', doseTime: '23:59' });
for (const doseDate of ['2026-02-30', '2026-99-99', 'bad']) {
  assert.deepEqual(doseNotificationTarget({ supplementId: 7, doseDate, doseTime: '09:00' }), { supplementId: 7 });
}
assert.deepEqual(doseNotificationTarget({ supplementId: 7, doseDate: '2026-10-20', doseTime: '24:00' }), { supplementId: 7 });
