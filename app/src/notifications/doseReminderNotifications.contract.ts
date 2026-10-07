import type { DoseReminderNotificationDeps } from './doseReminderNotifications';

type ContractGlobals = typeof globalThis & { __DEV__?: boolean };
(globalThis as ContractGlobals).__DEV__ = false;

async function verifyNotificationLifecycle() {
  const {
    clearAllDoseReminders,
    notificationSupplementId,
    parseDoseTimes,
    scheduleSupplementReminders,
    scheduledDoseReminderTimes,
  } = await import('./doseReminderNotifications');

  const parsedTimes: string[] = parseDoseTimes('09:00,19:00');
  if (parsedTimes.length !== 2) {
    throw new Error('Expected two parsed reminder times');
  }

  const supplementId = notificationSupplementId({ supplementId: '42' });
  if (supplementId !== 42) {
    throw new Error('Expected notification supplement id to be parsed from data payload');
  }

  const scheduledTriggers: unknown[] = [];
  const storedValues = new Map<string, string>();
  const cancelledIdentifiers: string[] = [];
  const removedKeys: string[] = [];

  const deps: DoseReminderNotificationDeps = {
    async getAllStoredKeys() {
      return Array.from(storedValues.keys());
    },
    async getStoredNotificationIds(key) {
      return storedValues.get(key) ?? null;
    },
    async setStoredNotificationIds(key, value) {
      storedValues.set(key, value);
    },
    async removeStoredNotificationIds(key) {
      removedKeys.push(key);
      storedValues.delete(key);
    },
    async cancelScheduledNotificationAsync(identifier) {
      cancelledIdentifiers.push(identifier);
    },
    async getPermissionsAsync() {
      return { status: 'granted' };
    },
    async requestPermissionsAsync() {
      return { status: 'granted' };
    },
    async scheduleNotificationAsync(request) {
      scheduledTriggers.push(request.trigger);
      return `notification-${scheduledTriggers.length}`;
    },
  };

  const result = await scheduleSupplementReminders({
    supplementId: 42,
    productName: '비타민 C',
    times: parsedTimes,
  }, deps);
  if (result.scheduledCount !== 2 || scheduledTriggers.length !== 2) {
    throw new Error('Expected two scheduled dose reminders');
  }

  const scheduledTimes = await scheduledDoseReminderTimes(deps);
  if (Array.from(scheduledTimes.get(42) ?? []).join(',') !== '09:00,19:00') {
    throw new Error('Expected reminder identifiers to remain associated with independent dose times');
  }

  storedValues.set('@pill:dose-reminder-notifications:99', JSON.stringify(['notification-99']));
  storedValues.set('@other:feature', JSON.stringify(['keep-me']));

  await clearAllDoseReminders(deps);

  if (storedValues.has('@pill:dose-reminder-notifications:42')
    || storedValues.has('@pill:dose-reminder-notifications:99')) {
    throw new Error('Expected all PILL reminder metadata to be removed');
  }
  if (!storedValues.has('@other:feature') || removedKeys.includes('@other:feature')) {
    throw new Error('Expected unrelated storage keys to remain untouched');
  }
  for (const identifier of ['notification-1', 'notification-2', 'notification-99']) {
    if (!cancelledIdentifiers.includes(identifier)) {
      throw new Error(`Expected ${identifier} to be cancelled`);
    }
  }
}

void verifyNotificationLifecycle();
