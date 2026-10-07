export function normalizeManualDoseTimes(times: string[]) {
  const normalized: string[] = [];
  for (const rawTime of times) {
    const time = rawTime.trim();
    if (time && !normalized.includes(time)) {
      normalized.push(time);
    }
    if (normalized.length >= 3) {
      break;
    }
  }
  return normalized.length ? normalized : ['09:00'];
}

export type ManualSupplementDraft = {
  brandName?: string;
  productName?: string;
  suggestedUseKo?: string;
  doseTimes?: string[];
  imageUri?: string;
};

export function manualSupplementInitialValues(draft: ManualSupplementDraft = {}) {
  return {
    brandName: text(draft.brandName),
    productName: text(draft.productName),
    suggestedUseKo: text(draft.suggestedUseKo),
    doseTimes: normalizeManualDoseTimes(draft.doseTimes ?? []),
    imageUri: text(draft.imageUri),
  };
}

function text(value?: string) {
  return value?.trim() ?? '';
}
