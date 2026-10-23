import type { GardenState } from './types';

export type GardenGrowth = {
  id: string;
  stage: number;
  variant: number;
  garden: GardenState;
};

// Compare confirmed server stamps, never the optimistic 100% in the home UI.
// Keep this tracker in the signed-in session so navigating or undo/rechecking
// cannot replay the same day's celebration.
export function createGrowthTracker() {
  let previous: GardenState | null = null;
  const celebrated = new Set<string>();
  return {
    observe(next: GardenState, celebrate = true): GardenGrowth | null {
      const earned = previous !== null && next.todayEarned
        && next.totalStamps > previous.totalStamps
        && (!previous.todayEarned || previous.todayDate !== next.todayDate);
      previous = next;
      if (!celebrate || !earned || celebrated.has(next.todayDate)) return null;
      celebrated.add(next.todayDate);
      const stage = next.cycleStamps || 7;
      return {
        id: next.todayDate,
        stage,
        variant: Math.max(0, next.completedPlants - (stage === 7 ? 1 : 0)) % 3,
        garden: next,
      };
    },
  };
}

export function growthCelebrationCopy(stage: number) {
  const titles = [
    '작은 새싹이 돋았어요',
    '새잎이 고개를 내밀었어요',
    '잎이 한층 풍성해졌어요',
    '초록빛이 더 짙어졌어요',
    '쑥쑥, 제법 자랐어요',
    '꽃 피울 준비를 마쳤어요',
    '우리 식물이 다 자랐어요',
  ];
  return {
    title: titles[Math.max(0, Math.min(6, stage - 1))],
    detail: stage === 7
      ? '차곡차곡 남긴 일곱 날,\n정원에 식물 하나가 더해졌어요.'
      : '남겨준 오늘의 기록이\n작은 정원을 한 뼘 키웠어요.',
  };
}
