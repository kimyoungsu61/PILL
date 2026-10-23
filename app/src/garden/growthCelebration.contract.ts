import { createGrowthTracker, growthCelebrationCopy } from './growthCelebration';
import type { GardenState } from './types';

const assert = {
  equal(actual: unknown, expected: unknown, message = 'Unexpected growth state') {
    if (actual !== expected) throw new Error(message);
  },
  ok(value: boolean) { if (!value) throw new Error('Expected growth copy'); },
};

const state = (count: number, todayEarned = false, todayDate = '2026-10-22'): GardenState => ({
  totalStamps: count, cycleStamps: count % 7, completedPlants: Math.floor(count / 7),
  todayEarned, todayDate, stampDates: [], selectedPot: 'sage', selectedStamp: 'sun',
});

// Returning to an already completed day is quiet, including a new app session.
assert.equal(createGrowthTracker().observe(state(2, true)), null);
const tracker = createGrowthTracker();
assert.equal(tracker.observe(state(1)), null);
assert.equal(tracker.observe(state(1)), null, 'partial progress never celebrates');
const second = tracker.observe(state(2, true));
assert.equal(second?.stage, 2);
assert.equal(second?.variant, 0);
assert.equal(second?.garden.selectedPot, 'sage');
assert.equal(second?.garden.selectedStamp, 'sun');
assert.equal(tracker.observe(state(2, true)), null, 'refresh/navigation cannot repeat the day');
assert.equal(tracker.observe(state(1)), null, 'undo is not a reward');
assert.equal(tracker.observe(state(2, true)), null, 'rechecking the same day is quiet');
assert.equal(tracker.observe(state(3, true, '2026-10-24'))?.stage, 3, 'missed days do not prevent growth');
assert.equal(tracker.observe(state(4, false, '2026-10-25')), null, 'count changes without todayEarned cannot celebrate');

for (const finalCount of [7, 14, 21, 28]) {
  const milestone = createGrowthTracker();
  milestone.observe(state(finalCount - 1));
  const seventh = milestone.observe(state(finalCount, true));
  assert.equal(seventh?.stage, 7, 'completion shows the grown plant, not next cycle seed');
  assert.equal(seventh?.variant, (finalCount / 7 - 1) % 3);
  const firstNext = milestone.observe(state(finalCount + 1, true, '2026-10-23'));
  assert.equal(firstNext?.stage, 1);
  assert.equal(firstNext?.variant, (finalCount / 7) % 3);
}

// The shared tracker survives the reminder screen resetting navigation to Home.
const notification = createGrowthTracker();
notification.observe(state(1), false);
assert.equal(notification.observe(state(2, true))?.stage, 2);
const otherAccount = createGrowthTracker();
assert.equal(otherAccount.observe(state(14, true)), null, 'new account starts without old celebrations');
for (let day = 1; day <= 7; day++) assert.ok(growthCelebrationCopy(day).title.length > 0);
