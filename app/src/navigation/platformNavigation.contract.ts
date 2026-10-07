import { supportsNotificationNavigation } from './platformNavigation';

function expectEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
  }
}

expectEqual(
  supportsNotificationNavigation('web'),
  false,
  'Web should skip unavailable notification navigation APIs',
);
expectEqual(
  supportsNotificationNavigation('android'),
  true,
  'Android should keep notification navigation enabled',
);
expectEqual(
  supportsNotificationNavigation('ios'),
  true,
  'iOS should keep notification navigation enabled',
);
