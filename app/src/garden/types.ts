export type GardenPot = 'clay' | 'cloud' | 'sage' | 'ink';
export type GardenStamp = 'leaf' | 'flower' | 'sun' | 'star';

export type GardenState = {
  totalStamps: number;
  cycleStamps: number;
  completedPlants: number;
  todayEarned: boolean;
  todayDate: string;
  stampDates: string[];
  selectedPot: GardenPot;
  selectedStamp: GardenStamp;
};

export function completionPercent(done: number, total: number) {
  if (total <= 0) return 0;
  return done >= total ? 100 : Math.max(0, Math.min(99, Math.round(done / total * 100)));
}

export function gardenMilestone(previous: GardenState | null, next: GardenState) {
  return Boolean(previous && next.completedPlants > previous.completedPlants);
}

export function growthLabel(stage: number) {
  if (stage === 0) return '작은 시작';
  if (stage <= 2) return '고개 내민 새싹';
  if (stage <= 4) return '잎을 펼치는 중';
  if (stage <= 6) return '제법 자랐어요';
  return '함께 키운 식물';
}
