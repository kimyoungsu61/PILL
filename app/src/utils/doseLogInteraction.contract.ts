import { doseStatusText } from './doseLogInteraction';

if (doseStatusText('TAKEN') !== '먹었어요') {
  throw new Error('TAKEN status text is wrong.');
}

if (doseStatusText('SKIPPED') !== '못 먹었어요') {
  throw new Error('SKIPPED status text is wrong.');
}

if (doseStatusText('UNKNOWN') !== '기억이 안 나요') {
  throw new Error('UNKNOWN must remain distinct from a skipped or unrecorded dose.');
}
