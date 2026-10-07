import type { TodayDose } from '../api/types';

type DoseCheckRowPresentation = {
  cardState: 'pending' | 'taken' | 'skipped';
  disableSkipped: boolean;
  disableTaken: boolean;
  isChecked: boolean;
  nextAction: 'take' | 'changeToTaken' | 'changeToSkipped' | 'clear';
  skippedLabel: string;
  statusLabel: '복용 예정' | '복용 완료' | '건너뜀';
  takenLabel: string;
  timeLabel: string;
};

export function doseCheckRowPresentation(dose: TodayDose): DoseCheckRowPresentation {
  const isTaken = dose.status === 'TAKEN';
  const isSkipped = dose.status === 'SKIPPED';
  const isChecked = isTaken || isSkipped;

  return {
    cardState: isTaken ? 'taken' : isSkipped ? 'skipped' : 'pending',
    disableSkipped: isSkipped,
    disableTaken: isTaken,
    isChecked,
    nextAction: isTaken ? 'changeToSkipped' : isSkipped ? 'changeToTaken' : 'take',
    skippedLabel: isTaken ? '건너뜀으로 수정' : isSkipped ? '건너뜀' : '건너뛰기',
    statusLabel: isTaken ? '복용 완료' : isSkipped ? '건너뜀' : '복용 예정',
    takenLabel: isTaken ? '먹었어요' : isSkipped ? '복용으로 수정' : '먹었어요',
    timeLabel: isChecked ? '기록됨' : '복용 예정',
  };
}
