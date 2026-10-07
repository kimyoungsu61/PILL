import type * as ExpoNotifications from 'expo-notifications';

const STORAGE_KEY_PREFIX = '@pill:dose-reminder-notifications:';
const ANDROID_CHANNEL_ID = 'dose-reminders';

type PermissionResponse = {
  status: string;
};

type NotificationRequest = {
  content: ExpoNotifications.NotificationContentInput;
  trigger: {
    type: string;
    hour: number;
    minute: number;
    channelId: string;
  };
};

type NotificationChannelRequest = {
  name: string;
  importance: number;
  sound?: string;
};

export type DoseReminderNotificationDeps = {
  getAllStoredKeys: () => Promise<readonly string[]>;
  getStoredNotificationIds: (key: string) => Promise<string | null>;
  setStoredNotificationIds: (key: string, value: string) => Promise<void>;
  removeStoredNotificationIds: (key: string) => Promise<void>;
  cancelScheduledNotificationAsync: (identifier: string) => Promise<void>;
  getPermissionsAsync: () => Promise<PermissionResponse>;
  requestPermissionsAsync: () => Promise<PermissionResponse>;
  scheduleNotificationAsync: (request: NotificationRequest) => Promise<string>;
  setNotificationChannelAsync?: (channelId: string, channel: NotificationChannelRequest) => Promise<unknown>;
  platformOS?: string;
  dailyTriggerType?: string;
  androidImportanceHigh?: number;
};

export type ScheduleDoseReminderOptions = {
  supplementId: number;
  productName?: string;
  displayNameKo?: string;
  times: string[] | string;
};

export type ScheduleDoseReminderResult = {
  scheduledCount: number;
  permissionStatus: string;
};

type StoredDoseReminder = {
  identifier: string;
  time: string | null;
};

export type DoseReminderPermissionStatus = 'granted' | 'denied' | 'unavailable' | 'undetermined';

export function configureDoseNotificationHandler() {
  if (!supportsLocalDoseReminders() || isExpoGoRuntime()) {
    return;
  }

  const Notifications = loadNotifications();
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export function parseDoseTimes(value: string[] | string | undefined) {
  const rawTimes = Array.isArray(value) ? value : (value ?? '').split(',');
  return Array.from(new Set(rawTimes
    .map((time) => time.trim())
    .filter((time) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))));
}

export function notificationStorageKey(supplementId: number) {
  return `${STORAGE_KEY_PREFIX}${supplementId}`;
}

export function notificationSupplementId(data: Record<string, unknown> | undefined) {
  const rawId = data?.supplementId;
  const supplementId = typeof rawId === 'number' ? rawId : Number(rawId);
  return Number.isInteger(supplementId) && supplementId > 0 ? supplementId : null;
}

export function supportsLocalDoseReminders() {
  const { Platform } = loadReactNative();
  return Platform.OS !== 'web';
}

export async function getDoseReminderPermissionStatus(
  deps: DoseReminderNotificationDeps = createDefaultDeps()
): Promise<DoseReminderPermissionStatus> {
  if (!supportsReminderRuntime(deps)) {
    return 'unavailable';
  }
  return normalizePermissionStatus((await deps.getPermissionsAsync()).status);
}

export async function requestDoseReminderPermission(
  deps: DoseReminderNotificationDeps = createDefaultDeps()
): Promise<DoseReminderPermissionStatus> {
  if (!supportsReminderRuntime(deps)) {
    return 'unavailable';
  }
  if (deps.platformOS === 'android' && deps.setNotificationChannelAsync) {
    await deps.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: '복용 알림',
      importance: deps.androidImportanceHigh ?? 4,
    });
  }
  return normalizePermissionStatus((await deps.requestPermissionsAsync()).status);
}

export async function scheduledDoseReminderSupplementIds(
  deps: DoseReminderNotificationDeps = createDefaultDeps()
) {
  const keys = await deps.getAllStoredKeys();
  const ids = await Promise.all(keys
    .filter((key) => key.startsWith(STORAGE_KEY_PREFIX))
    .map(async (key) => {
      const storedValue = await deps.getStoredNotificationIds(key);
      const supplementId = Number(key.slice(STORAGE_KEY_PREFIX.length));
      return parseStoredReminders(storedValue).length && Number.isInteger(supplementId) && supplementId > 0
        ? supplementId
        : null;
    }));
  return new Set(ids.filter((id): id is number => id !== null));
}

export async function scheduledDoseReminderTimes(
  deps: DoseReminderNotificationDeps = createDefaultDeps()
) {
  const schedules = new Map<number, Set<string>>();
  const keys = (await deps.getAllStoredKeys())
    .filter((key) => key.startsWith(STORAGE_KEY_PREFIX));
  await Promise.all(keys.map(async (key) => {
    const supplementId = Number(key.slice(STORAGE_KEY_PREFIX.length));
    if (!Number.isInteger(supplementId) || supplementId <= 0) {
      return;
    }
    const reminders = parseStoredReminders(await deps.getStoredNotificationIds(key));
    if (!reminders.length) {
      return;
    }
    const hasLegacyReminder = reminders.some((reminder) => reminder.time === null);
    schedules.set(supplementId, new Set(hasLegacyReminder
      ? ['*']
      : reminders.map((reminder) => reminder.time).filter((time): time is string => time !== null)));
  }));
  return schedules;
}

export async function cancelSupplementReminders(
  supplementId: number,
  deps: DoseReminderNotificationDeps = createDefaultDeps()
) {
  const key = notificationStorageKey(supplementId);
  const storedValue = await deps.getStoredNotificationIds(key);
  const identifiers = parseStoredReminders(storedValue).map((reminder) => reminder.identifier);

  await Promise.all(identifiers.map((identifier) => deps.cancelScheduledNotificationAsync(identifier)));
  await deps.removeStoredNotificationIds(key);
}

export async function clearAllDoseReminders(
  deps: DoseReminderNotificationDeps = createDefaultDeps()
) {
  const keys = (await deps.getAllStoredKeys())
    .filter((key) => key.startsWith(STORAGE_KEY_PREFIX));
  await Promise.all(keys.map(async (key) => {
    const storedValue = await deps.getStoredNotificationIds(key);
    const identifiers = parseStoredReminders(storedValue).map((reminder) => reminder.identifier);
    await Promise.all(identifiers.map((identifier) => deps.cancelScheduledNotificationAsync(identifier)));
    await deps.removeStoredNotificationIds(key);
  }));
}

export async function scheduleSupplementReminders(
  options: ScheduleDoseReminderOptions,
  deps: DoseReminderNotificationDeps = createDefaultDeps()
): Promise<ScheduleDoseReminderResult> {
  const times = parseDoseTimes(options.times);
  await cancelSupplementReminders(options.supplementId, deps);

  if (!times.length) {
    return { scheduledCount: 0, permissionStatus: 'skipped' };
  }

  const permissionStatus = await requestDoseReminderPermission(deps);
  if (permissionStatus !== 'granted') {
    return { scheduledCount: 0, permissionStatus };
  }

  const label = options.displayNameKo || options.productName || '영양제';
  const identifiers = await Promise.all(times.map((time) => {
    const [hourText, minuteText] = time.split(':');
    return deps.scheduleNotificationAsync({
      content: {
        title: '복용 시간이에요',
        body: `${label} 복용할 시간입니다.`,
        sound: 'default',
        data: {
          supplementId: options.supplementId,
          doseTime: time,
        },
      },
      trigger: {
        type: deps.dailyTriggerType ?? 'daily',
        hour: Number(hourText),
        minute: Number(minuteText),
        channelId: ANDROID_CHANNEL_ID,
      },
    });
  }));

  const storedReminders: StoredDoseReminder[] = identifiers.map((identifier, index) => ({
    identifier,
    time: times[index],
  }));
  await deps.setStoredNotificationIds(notificationStorageKey(options.supplementId), JSON.stringify(storedReminders));
  return { scheduledCount: identifiers.length, permissionStatus };
}

function parseStoredReminders(value: string | null): StoredDoseReminder[] {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const reminders = parsed.flatMap((item): StoredDoseReminder[] => {
      if (typeof item === 'string') {
        return [{ identifier: item, time: null }];
      }
      if (!item || typeof item !== 'object' || typeof item.identifier !== 'string') {
        return [];
      }
      const time = typeof item.time === 'string' && parseDoseTimes([item.time]).length
        ? item.time
        : null;
      return [{ identifier: item.identifier, time }];
    });
    return Array.from(new Map(reminders.map((reminder) => [reminder.identifier, reminder])).values());
  } catch {
    return [];
  }
}

function createDefaultDeps(): DoseReminderNotificationDeps {
  const AsyncStorage = loadAsyncStorage();
  if (!supportsLocalDoseReminders() || isExpoGoRuntime()) {
    return {
      getAllStoredKeys: () => AsyncStorage.getAllKeys(),
      getStoredNotificationIds: (key) => AsyncStorage.getItem(key),
      setStoredNotificationIds: (key, value) => AsyncStorage.setItem(key, value),
      removeStoredNotificationIds: (key) => AsyncStorage.removeItem(key),
      cancelScheduledNotificationAsync: async () => {},
      getPermissionsAsync: async () => ({ status: 'unavailable' }),
      requestPermissionsAsync: async () => ({ status: 'unavailable' }),
      scheduleNotificationAsync: async () => '',
    };
  }

  const Notifications = loadNotifications();
  const { Platform } = loadReactNative();
  return {
    getAllStoredKeys: () => AsyncStorage.getAllKeys(),
    getStoredNotificationIds: (key) => AsyncStorage.getItem(key),
    setStoredNotificationIds: (key, value) => AsyncStorage.setItem(key, value),
    removeStoredNotificationIds: (key) => AsyncStorage.removeItem(key),
    cancelScheduledNotificationAsync: Notifications.cancelScheduledNotificationAsync,
    getPermissionsAsync: Notifications.getPermissionsAsync,
    requestPermissionsAsync: Notifications.requestPermissionsAsync,
    scheduleNotificationAsync: (request) => Notifications.scheduleNotificationAsync(
      request as ExpoNotifications.NotificationRequestInput
    ),
    setNotificationChannelAsync: (channelId, channel) => Notifications.setNotificationChannelAsync(
      channelId,
      channel as ExpoNotifications.NotificationChannelInput
    ),
    platformOS: Platform.OS,
    dailyTriggerType: Notifications.SchedulableTriggerInputTypes.DAILY,
    androidImportanceHigh: Notifications.AndroidImportance.HIGH,
  };
}

function loadAsyncStorage() {
  const module = require('@react-native-async-storage/async-storage') as typeof import('@react-native-async-storage/async-storage');
  return module.default;
}

function loadNotifications() {
  return require('expo-notifications') as typeof import('expo-notifications');
}

function loadReactNative() {
  return require('react-native') as typeof import('react-native');
}

function isExpoGoRuntime() {
  const { isRunningInExpoGo } = require('expo') as typeof import('expo');
  return isRunningInExpoGo();
}

function normalizePermissionStatus(status: string): DoseReminderPermissionStatus {
  if (status === 'granted' || status === 'denied' || status === 'undetermined') {
    return status;
  }
  return 'unavailable';
}

function supportsReminderRuntime(deps: DoseReminderNotificationDeps) {
  return deps.platformOS !== 'web';
}
