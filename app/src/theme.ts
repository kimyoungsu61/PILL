import type { ViewStyle } from 'react-native';
import type { DoseStatus } from './api/types';

const neutralColors = {
  background: '#F7F8FA',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceMuted: '#F2F4F7',
  ink: '#202733',
  inkSoft: '#4D5867',
  muted: '#687382',
  faint: '#A0A8B2',
  line: '#E8EBEF',
  primary: '#385BCE',
  primaryText: '#FFFFFF',
  active: '#385BCE',
  activeSoft: '#EDF2FD',
  completed: '#1D8A68',
  completedSoft: '#E6F6EF',
  warning: '#9A631A',
  warningSoft: '#FFF4E5',
  danger: '#BC4C5B',
  dangerSoft: '#FCEEF0',
  white: '#FFFFFF',
  black: '#17234D',
} as const;

export const colors = {
  ...neutralColors,
  cream: neutralColors.activeSoft,
  sage: neutralColors.completed,
  clay: neutralColors.warning,
  rose: neutralColors.danger,
  roseSoft: neutralColors.dangerSoft,
  indigo: neutralColors.active,
  indigoDark: neutralColors.active,
  indigoSoft: neutralColors.activeSoft,
  amber: neutralColors.warning,
  amberSoft: neutralColors.warningSoft,
  blue: neutralColors.active,
  blueSoft: neutralColors.activeSoft,
  success: neutralColors.completed,
  successSoft: neutralColors.completedSoft,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
};

export const radius = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  xxl: 20,
};

export const shadow = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0,
    shadowRadius: 34,
    elevation: 0,
  } satisfies ViewStyle,
  soft: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0,
    shadowRadius: 18,
    elevation: 0,
  } satisfies ViewStyle,
};

export const type = {
  hero: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.8,
    lineHeight: 36,
  },
  title: {
    color: colors.ink,
    fontSize: 23,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
    lineHeight: 31,
  },
  section: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  body: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 23,
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
};

export function doseStatusLabel(status?: DoseStatus) {
  if (status === 'TAKEN') {
    return '완료';
  }
  if (status === 'SKIPPED') {
    return '건너뜀';
  }
  return '대기';
}

export function doseStatusColors(status?: DoseStatus) {
  if (status === 'TAKEN') {
    return { background: colors.completedSoft, text: colors.completed };
  }
  if (status === 'SKIPPED') {
    return { background: colors.dangerSoft, text: colors.danger };
  }
  return { background: colors.activeSoft, text: colors.active };
}

export function supplementInitial(name?: string) {
  const trimmed = name?.trim();
  if (!trimmed) {
    return 'P';
  }
  return trimmed.slice(0, 1).toUpperCase();
}
