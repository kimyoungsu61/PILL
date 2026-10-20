const assert = {
  equal(actual: unknown, expected: unknown) { if (actual !== expected) throw new Error(`Reminder activation mismatch: ${actual} != ${expected}`); },
  deepEqual(actual: unknown, expected: unknown) { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('Reminder activation mismatch'); },
};
import { enableRegisteredSupplementReminders, type RegistrationReminderDeps } from './registrationReminders';
import type { WebPushState } from './webPush';

const options = { supplementId: 42, productName: '마그네슘', times: ['21:00', ' 09:00 ', '21:00', 'invalid'] };
const device: WebPushState = { id: 'this-device', enabled: true, reminders: [{ supplementId: 7, time: '19:00' }] };

async function run() {
  let stateReads = 0;
  let saves = 0;
  let nativeSaves = 0;
  const deps: RegistrationReminderDeps = {
    platform: 'web',
    permission: () => 'granted',
    webState: async token => { assert.equal(token, 'session'); stateReads++; return device; },
    saveWebTimes: async (token, current, id, times) => {
      saves++;
      assert.equal(token, 'session');
      assert.equal(current.id, 'this-device');
      assert.equal(id, 42);
      assert.deepEqual(times, ['21:00', '09:00']);
      // Only the new product's endpoint is updated; existing products stay selected.
      return { ...current, reminders: [...current.reminders, ...times.map(time => ({ supplementId: id, time }))] };
    },
    scheduleNative: async value => { nativeSaves++; assert.equal(value.supplementId, 42); return { scheduledCount: 2, permissionStatus: 'granted' }; },
  };

  const saved = await enableRegisteredSupplementReminders('session', options, deps);
  assert.deepEqual(saved, { supplementId: 42, status: 'enabled', times: ['21:00', '09:00'] });
  assert.equal(saves, 1);
  assert.equal(nativeSaves, 0);
  assert.deepEqual(device.reminders, [{ supplementId: 7, time: '19:00' }]);

  for (const permission of ['default', 'denied', 'unavailable']) {
    stateReads = 0; saves = 0;
    assert.equal((await enableRegisteredSupplementReminders('session', options, { ...deps, permission: () => permission })).status, 'needs-setup');
    assert.equal(stateReads, 0);
    assert.equal(saves, 0);
  }
  for (const current of [null, { ...device, enabled: false }]) {
    saves = 0;
    assert.equal((await enableRegisteredSupplementReminders('session', options, { ...deps, webState: async () => current })).status, 'needs-setup');
    assert.equal(saves, 0); // Never reconnect or revive an intentionally disabled device.
  }
  for (const failure of ['read', 'save', 'incomplete']) {
    let attempts = 0;
    const failing: RegistrationReminderDeps = {
      ...deps,
      webState: async () => { if (failure === 'read') throw new Error('offline'); return device; },
      saveWebTimes: async () => { attempts++; if (failure === 'save') throw new Error('offline'); return device; },
    };
    assert.equal((await enableRegisteredSupplementReminders('session', options, failing)).status, 'retry');
    // Retrying this helper only reserves reminders; it cannot create a duplicate product.
    assert.equal((await enableRegisteredSupplementReminders('session', options, failing)).status, 'retry');
    assert.equal(attempts, failure === 'read' ? 0 : 2);
  }
  assert.equal((await enableRegisteredSupplementReminders('session', options, { ...deps, saveWebTimes: async () => ({ ...device, enabled: false }) })).status, 'needs-setup');

  assert.equal((await enableRegisteredSupplementReminders('session', options, { ...deps, platform: 'ios' })).status, 'enabled');
  assert.equal(nativeSaves, 1);
  assert.equal((await enableRegisteredSupplementReminders('session', options, { ...deps, platform: 'ios', permission: () => 'denied' })).status, 'needs-setup');
  assert.equal(nativeSaves, 1);
  assert.equal((await enableRegisteredSupplementReminders('session', options, { ...deps, platform: 'ios', scheduleNative: async () => ({ scheduledCount: 1, permissionStatus: 'granted' }) })).status, 'retry');
  assert.equal((await enableRegisteredSupplementReminders('session', { ...options, times: [] }, deps)).status, 'needs-setup');
}

void run().catch(error => { console.error(error); process.exitCode = 1; });
