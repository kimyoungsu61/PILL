import type { DoseHistoryEntry } from '../api/types';

export type DoseHistoryGroup = {
  date: string;
  entries: DoseHistoryEntry[];
};

export function groupDoseHistory(entries: DoseHistoryEntry[]): DoseHistoryGroup[] {
  const sorted = [...entries].sort((left, right) => {
    const dateOrder = right.doseDate.localeCompare(left.doseDate);
    if (dateOrder) {
      return dateOrder;
    }
    const timeOrder = (left.doseTime || '').localeCompare(right.doseTime || '');
    if (timeOrder) {
      return timeOrder;
    }
    return (right.checkedAt || '').localeCompare(left.checkedAt || '');
  });

  const groups = new Map<string, DoseHistoryEntry[]>();
  for (const entry of sorted) {
    const group = groups.get(entry.doseDate) ?? [];
    group.push(entry);
    groups.set(entry.doseDate, group);
  }
  return Array.from(groups, ([date, groupedEntries]) => ({ date, entries: groupedEntries }));
}

export function formatDoseHistoryDate(date: string, today = localDateKey(new Date())) {
  if (date === today) {
    return '오늘';
  }
  const todayDate = parseLocalDate(today);
  const targetDate = parseLocalDate(date);
  const difference = Math.round((todayDate.getTime() - targetDate.getTime()) / 86_400_000);
  if (difference === 1) {
    return '어제';
  }
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(targetDate);
}

export function formatDoseHistoryTime(time?: string) {
  if (!time || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    return '시간 미지정';
  }
  const [hour, minute] = time.split(':').map(Number);
  const period = hour < 12 ? '오전' : '오후';
  return `${period} ${hour % 12 || 12}:${String(minute).padStart(2, '0')}`;
}

export function formatHistoryRange(from: string, to: string) {
  return `${formatShortDate(from)} – ${formatShortDate(to)}`;
}

function parseLocalDate(date: string) {
  return new Date(`${date}T00:00:00`);
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatShortDate(date: string) {
  const parsed = parseLocalDate(date);
  return `${parsed.getMonth() + 1}월 ${parsed.getDate()}일`;
}
