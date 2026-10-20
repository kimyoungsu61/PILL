import { clampHour, clampMinute, createPressRepeat, formatClockTime, parseClockTime, stepMinute } from './TimePickerField.helpers';

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

let pending: { work: () => void; delay: number } | undefined;
let repeatMinute = 58;
let changes = 0;
const repeat = createPressRepeat(() => { repeatMinute = stepMinute(repeatMinute, 1); changes++; }, (work, delay) => {
  const task = { work, delay };
  pending = task;
  return () => { if (pending === task) pending = undefined; };
});
repeat.start();
expect(changes === 1 && repeatMinute === 59, 'long press starts stepping');
for (let index = 0; index < 6; index++) pending?.work();
expect(changes === 7 && repeatMinute === 5, 'held minutes repeat and wrap through zero');
expect(pending?.delay === 70, 'a sustained hold accelerates');
const queuedBeforeRelease = pending?.work;
repeat.stop();
queuedBeforeRelease?.();
expect(changes === 7 && pending === undefined, 'release cancels pending and already queued work');
repeat.start();
queuedBeforeRelease?.();
expect(changes === 8, 'restarting cannot revive the previous press');
repeat.stop();
let stopping: ReturnType<typeof createPressRepeat>;
stopping = createPressRepeat(() => stopping.stop(), () => { throw new Error('cancelled press scheduled more work'); });
stopping.start();
