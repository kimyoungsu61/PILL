import { doseChangeConfirmationMessage, doseStatusText, shouldConfirmDoseChange } from './doseLogInteraction';
import type { DoseStatus } from '../api/types';

if (doseStatusText('TAKEN') !== '복용 완료') {
  throw new Error('TAKEN status text is wrong.');
}

if (doseStatusText('SKIPPED') !== '건너뜀') {
  throw new Error('SKIPPED status text is wrong.');
}

if (shouldConfirmDoseChange(undefined, 'TAKEN' satisfies DoseStatus)) {
  throw new Error('Pending dose should not need confirmation.');
}

if (shouldConfirmDoseChange('TAKEN', 'TAKEN')) {
  throw new Error('Same status should not need confirmation.');
}

if (!shouldConfirmDoseChange('TAKEN', 'SKIPPED')) {
  throw new Error('Changing an existing dose status should need confirmation.');
}

if (doseChangeConfirmationMessage('TAKEN', 'SKIPPED') !== '현재 기록: 복용 완료. 건너뜀으로 바꿀까요?') {
  throw new Error('Dose change confirmation message is wrong.');
}
