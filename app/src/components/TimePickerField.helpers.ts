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

type RepeatScheduler = (work: () => void, delay: number) => () => void;

// Invoked by Pressable's long-press gesture. A generation also invalidates a
// callback already queued when the user releases or starts another press.
export function createPressRepeat(step: () => void, schedule: RepeatScheduler = (work, delay) => {
  const timer = setTimeout(work, delay);
  return () => clearTimeout(timer);
}) {
  let generation = 0;
  let cancel: (() => void) | undefined;
  function stop() {
    generation++;
    cancel?.();
    cancel = undefined;
  }
  return {
    stop,
    start() {
      stop();
      const current = generation;
      let repeats = 0;
      function tick() {
        if (current !== generation) return;
        step();
        if (current === generation) cancel = schedule(tick, repeats++ < 5 ? 130 : 70);
      }
      tick();
    },
  };
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
