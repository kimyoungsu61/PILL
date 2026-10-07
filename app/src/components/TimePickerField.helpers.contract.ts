import { clampHour, clampMinute, formatClockTime, parseClockTime, stepMinute } from './TimePickerField.helpers';

function expect(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

expect(formatClockTime(9, 1) === '09:01', 'formats time with two-digit hour and minute');
expect(formatClockTime(24, 60) === '00:00', 'wraps overflowing hour and minute');

const parsedTime = parseClockTime('19:37');
expect(parsedTime.hour === 19 && parsedTime.minute === 37, 'parses valid clock time');

const fallbackTime = parseClockTime('bad');
expect(fallbackTime.hour === 9 && fallbackTime.minute === 0, 'falls back for invalid clock time');

expect(clampHour(-1) === 23, 'wraps negative hours');
expect(clampHour(24) === 0, 'wraps overflowing hours');
expect(clampMinute(62) === 2, 'wraps overflowing minutes without rounding');
expect(clampMinute(-1) === 59, 'wraps negative minutes without rounding');
expect(stepMinute(59, 1) === 0, 'steps minutes forward across the hour boundary');
expect(stepMinute(0, -1) === 59, 'steps minutes backward across the hour boundary');
