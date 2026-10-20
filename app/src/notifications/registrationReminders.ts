import { getDoseReminderPermissionStatus, parseDoseTimes, scheduleSupplementReminders, type ScheduleDoseReminderOptions, type ScheduleDoseReminderResult } from './doseReminderNotifications';
import { getWebPushState, saveWebReminderTimes, type WebPushState } from './webPush';

export type RegistrationReminders = {
  supplementId: number;
  status: 'enabled' | 'needs-setup' | 'retry';
  times: string[];
};

export type RegistrationReminderDeps = {
  platform: string;
  permission: () => string | Promise<string>;
  webState: (token: string) => Promise<WebPushState | null>;
  saveWebTimes: (token: string, state: WebPushState, supplementId: number, times: string[]) => Promise<WebPushState>;
  scheduleNative: (options: ScheduleDoseReminderOptions) => Promise<ScheduleDoseReminderResult>;
};

// Called only after a new product has been saved. Failure here never means the
// registration failed, and a retry must reserve reminders without creating it again.
export async function enableRegisteredSupplementReminders(
  token: string,
  options: ScheduleDoseReminderOptions,
  deps: RegistrationReminderDeps = defaultDeps(),
): Promise<RegistrationReminders> {
  const times = parseDoseTimes(options.times);
  const result = (status: RegistrationReminders['status']): RegistrationReminders => ({ supplementId: options.supplementId, status, times });
  if (!times.length) return result('needs-setup');
  try {
    // Never request permission after an asynchronous product save. A user who
    // disabled this device can explicitly reconnect it from notification settings.
    if (await deps.permission() !== 'granted') return result('needs-setup');
    if (deps.platform === 'web') {
      const current = await deps.webState(token);
      if (!current?.enabled) return result('needs-setup');
      const saved = await deps.saveWebTimes(token, current, options.supplementId, times);
      if (!saved.enabled) return result('needs-setup');
      const selected = new Set(saved.reminders.filter(item => item.supplementId === options.supplementId).map(item => item.time));
      return result(times.every(time => selected.has(time)) ? 'enabled' : 'retry');
    }
    const saved = await deps.scheduleNative({ ...options, times });
    return result(saved.permissionStatus !== 'granted' ? 'needs-setup' : saved.scheduledCount === times.length ? 'enabled' : 'retry');
  } catch {
    return result('retry');
  }
}

function defaultDeps(): RegistrationReminderDeps {
  const { Platform } = require('react-native') as typeof import('react-native');
  return {
    platform: Platform.OS,
    permission: () => Platform.OS === 'web'
      ? typeof Notification === 'undefined' ? 'unavailable' : Notification.permission
      : getDoseReminderPermissionStatus(),
    webState: getWebPushState,
    saveWebTimes: saveWebReminderTimes,
    scheduleNative: scheduleSupplementReminders,
  };
}
