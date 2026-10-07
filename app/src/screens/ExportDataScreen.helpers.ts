import type { ExportDataResponse } from '../api/types';

const doseStatusLabels: Record<string, string> = {
  TAKEN: '복용 완료',
  SKIPPED: '건너뜀',
  MISSED: '미복용',
};

export function buildSupplementCsv(data: ExportDataResponse) {
  const rows: string[][] = [
    ['등록일', '영양제명', '브랜드', '원문 제품명', '복용 시간', '성분', '함량 기준', '복용 안내', '주의 문구'],
    ...data.supplements.map((supplement) => [
      supplement.createdAt.slice(0, 10),
      supplement.displayNameKo || supplement.productName || '',
      supplement.brandName || '',
      supplement.productName || '',
      supplement.doseTimes.join(' / '),
      supplement.ingredients.map((ingredient) => {
        const amount = [ingredient.amount, ingredient.unit].filter(Boolean).join(' ');
        const review = ingredient.needsReview ? ' [확인 필요]' : '';
        return `${ingredient.name}${amount ? ` ${amount}` : ''}${review}`;
      }).join(' / '),
      supplement.servingBasisKo || '',
      supplement.suggestedUseKo || '',
      supplement.warningSummary || '',
    ]),
  ];
  return csv(rows);
}

export function buildDoseHistoryCsv(data: ExportDataResponse) {
  const rows: string[][] = [
    ['날짜', '시간', '영양제명', '상태', '메모', '확인 시각'],
    ...data.doseHistory.entries.map((entry) => [
      entry.doseDate,
      entry.doseTime || '',
      entry.displayNameKo || entry.productName || '',
      doseStatusLabels[entry.status] || entry.status,
      entry.memo || '',
      entry.checkedAt || '',
    ]),
  ];
  return csv(rows);
}

export function exportFileStamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'export';
  }
  const parts = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    '_',
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
  ];
  return parts.join('');
}

export function exportRangeLabel(from: string, to: string) {
  return `${shortDate(from)} – ${shortDate(to)}`;
}

function csv(rows: string[][]) {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

function csvCell(value: string) {
  const normalized = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${normalized.replaceAll('"', '""')}"`;
}

function shortDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}
