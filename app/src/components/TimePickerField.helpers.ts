export type ClockTimeParts = {
  hour: number;
  minute: number;
};

export function clampHour(value: number) {
  return ((Math.trunc(value) % 24) + 24) % 24;
}

export function clampMinute(value: number) {
  return ((Math.trunc(value) % 60) + 60) % 60;
}

export function stepMinute(current: number, delta: number) {
  return clampMinute(current + delta);
}

export function formatClockTime(hour: number, minute: number) {
  return `${String(clampHour(hour)).padStart(2, '0')}:${String(clampMinute(minute)).padStart(2, '0')}`;
}

export function parseClockTime(value?: string): ClockTimeParts {
  const match = value?.trim().match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) {
    return { hour: 9, minute: 0 };
  }

  return {
    hour: clampHour(Number(match[1])),
    minute: clampMinute(Number(match[2])),
  };
}
