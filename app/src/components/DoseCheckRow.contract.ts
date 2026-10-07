import type { TodayDose } from '../api/types';
import { doseCheckRowPresentation } from './DoseCheckRow.helpers';

const baseDose: TodayDose = {
  supplementId: 1,
  productName: 'Vitamin C',
  displayNameKo: '비타민 C',
  imageUri: undefined,
  confirmedTime: '09:00',
  status: undefined,
};

const pending = doseCheckRowPresentation(baseDose);
if (pending.cardState !== 'pending' || pending.takenLabel !== '먹었어요' || pending.skippedLabel !== '건너뛰기') {
  throw new Error('Pending dose row presentation is wrong.');
}
if (pending.statusLabel !== '복용 예정' || pending.nextAction !== 'take') {
  throw new Error('Pending dose action is wrong.');
}

const taken = doseCheckRowPresentation({ ...baseDose, status: 'TAKEN' });
if (!taken.isChecked || !taken.disableTaken || taken.disableSkipped || taken.skippedLabel !== '건너뜀으로 수정') {
  throw new Error('Taken dose row presentation is wrong.');
}
if (taken.statusLabel !== '복용 완료' || taken.nextAction !== 'changeToSkipped') {
  throw new Error('Taken dose action is wrong.');
}

const skipped = doseCheckRowPresentation({ ...baseDose, status: 'SKIPPED' });
if (!skipped.isChecked || skipped.disableTaken || !skipped.disableSkipped || skipped.takenLabel !== '복용으로 수정') {
  throw new Error('Skipped dose row presentation is wrong.');
}
if (skipped.statusLabel !== '건너뜀' || skipped.nextAction !== 'changeToTaken') {
  throw new Error('Skipped dose action is wrong.');
}
