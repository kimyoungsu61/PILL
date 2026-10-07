export const DESIGN_PREVIEW_TOKEN = 'pill-web-design-preview';

export function isWebDesignPreview(platform: string, development: boolean, liveApi = false) {
  return platform === 'web' && development && !liveApi;
}
