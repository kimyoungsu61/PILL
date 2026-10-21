import { completionPercent, gardenMilestone, type GardenState } from './types';

function assert(value: boolean, message: string) {
  if (!value) throw new Error(message);
}
const state: GardenState = {
  totalStamps: 6, cycleStamps: 6, completedPlants: 0, todayEarned: false,
  todayDate: '2026-10-20', stampDates: [], selectedPot: 'clay', selectedStamp: 'leaf',
};
assert(completionPercent(1, 4) === 25, 'percentage uses scheduled occurrences, not product count');
assert(completionPercent(0, 0) === 0, 'empty days never display completion');
assert(completionPercent(999, 1000) === 99, 'rounding cannot award a premature 100%');
assert(completionPercent(4, 4) === 100, 'all scheduled occurrences means complete');
assert(!gardenMilestone(null, { ...state, completedPlants: 1 }), 'loading existing rewards does not replay a celebration');
assert(gardenMilestone(state, { ...state, completedPlants: 1 }), 'a confirmed new plant celebrates');
assert(!gardenMilestone({ ...state, completedPlants: 1 }, state), 'an undo never celebrates');
