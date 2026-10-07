import type { ScanHistoryEntry } from '../api/types';

export type ScanHistoryFilter = 'ALL' | 'SAVED' | 'REVIEW' | 'FAILED';

export function filterScanHistory(entries: ScanHistoryEntry[], filter: ScanHistoryFilter) {
  if (filter === 'SAVED') {
    return entries.filter((entry) => entry.saved);
  }
  if (filter === 'REVIEW') {
    return entries.filter((entry) => entry.status === 'COMPLETED' && !entry.saved);
  }
  if (filter === 'FAILED') {
    return entries.filter((entry) => entry.status === 'FAILED');
  }
  return entries;
}

export function formatScanHistoryDate(value: string, now = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '시간 정보 없음';
  }

  const sameDay = date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
  const time = new Intl.DateTimeFormat('ko-KR', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
  if (sameDay) {
    return `오늘 ${time}`;
  }

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function scanHistoryStatus(entry: ScanHistoryEntry) {
  if (entry.saved) {
    return {
      label: '보관함 저장됨',
      action: '보관함 보기',
      tone: 'SAVED' as const,
    };
  }
  if (entry.status === 'COMPLETED') {
    return {
      label: '저장 전 분석',
      action: '분석 결과 이어보기',
      tone: 'REVIEW' as const,
    };
  }
  if (entry.status === 'FAILED') {
    return {
      label: '분석 실패',
      action: '다시 촬영',
      tone: 'FAILED' as const,
    };
  }
  return {
    label: '분석 처리 중',
    action: '새로고침',
    tone: 'PROCESSING' as const,
  };
}

export function scanHistoryName(entry: ScanHistoryEntry) {
  return entry.displayNameKo?.trim()
    || entry.productName?.trim()
    || '제품명을 확인하지 못했어요';
}
