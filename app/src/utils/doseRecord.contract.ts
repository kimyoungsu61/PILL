import { DOSE_RECORD_OPTIONS, doseRecordLabel, isRecordedDose, summarizeDoseRecords } from './doseRecord';

function assert(condition: boolean, message: string) { if (!condition) throw new Error(message); }
const mixed = summarizeDoseRecords([{ status: 'TAKEN' }, { status: 'SKIPPED' }, { status: 'UNKNOWN' }, {}]);
assert(mixed.recorded === 3 && mixed.recordPercent === 75 && mixed.takenPercent === 25, 'record progress and taken percentage must be separate');
assert(mixed.unknown === 1 && mixed.unrecorded === 1, 'uncertain and unrecorded are different');
for (const status of ['TAKEN', 'SKIPPED', 'UNKNOWN']) {
  const summary = summarizeDoseRecords([{ status }, { status }]);
  assert(summary.recordPercent === 100 && summary.recorded === 2, 'each explicit status completes recording equally');
  assert(summary.takenPercent === (status === 'TAKEN' ? 100 : 0), 'only TAKEN contributes to reported ingestion');
  assert(isRecordedDose(status), 'explicit status must be recognized');
}
assert(summarizeDoseRecords([]).recordPercent === 0, 'empty schedule is not a completed day');
assert(!isRecordedDose(undefined) && !isRecordedDose('MISSED') && !isRecordedDose('other'), 'missing or unsupported status is not an explicit record');
assert(summarizeDoseRecords([{ status: 'MISSED' }]).unrecorded === 1, 'MISSED stays unrecorded');
assert(DOSE_RECORD_OPTIONS.length === 3 && new Set(DOSE_RECORD_OPTIONS.map(option => option.status)).size === 3, 'all choices available once');
assert(doseRecordLabel('UNKNOWN') !== doseRecordLabel(undefined), 'uncertainty must not be labelled missing');
