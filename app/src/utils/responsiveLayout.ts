export type LayoutMode = 'phone' | 'tablet' | 'wideTablet';

export function layoutModeForWidth(width: number): LayoutMode {
  if (width >= 1024) return 'wideTablet';
  if (width >= 768) return 'tablet';
  return 'phone';
}

export function supportsSupportingColumn(width: number) {
  return layoutModeForWidth(width) === 'wideTablet';
}

export function contentRailWidth(width: number) {
  if (width >= 1024) return 980;
  if (width >= 768) return 680;
  return width;
}
