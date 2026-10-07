export type AuthResponse = {
  token: string;
  email: string;
};

export type MeResponse = {
  email: string;
};

export type ApiError = {
  code: string;
  message: string;
};

export type DoseStatus = 'TAKEN' | 'SKIPPED';

export type DoseHistoryStatus = DoseStatus | 'MISSED';

export type SupplementSummary = {
  id: number;
  brandName?: string;
  productName?: string;
  displayNameKo?: string;
  imageUri?: string;
  warningSummary?: string;
};

export type TodayDose = {
  supplementId: number;
  productName: string;
  displayNameKo?: string;
  imageUri?: string;
  confirmedTime?: string;
  status?: DoseStatus;
};

export type HomeResponse = {
  supplements: SupplementSummary[];
  todayDoses: TodayDose[];
};

export type ScanIngredient = {
  name: string;
  amount: string;
  unit: string;
  originalText: string;
  confidence: number;
  needsReview: boolean;
};

export type DoseLogEntry = {
  doseDate: string;
  doseTime?: string;
  status: DoseStatus;
  memo?: string;
  checkedAt: string;
};

export type DoseHistoryEntry = {
  supplementId: number;
  productName?: string;
  displayNameKo?: string;
  imageUri?: string;
  doseDate: string;
  doseTime?: string;
  status: DoseHistoryStatus;
  memo?: string;
  checkedAt?: string;
};

export type DoseHistoryResponse = {
  from: string;
  to: string;
  summary: {
    total: number;
    taken: number;
    skipped: number;
    missed: number;
    completionRate: number;
  };
  entries: DoseHistoryEntry[];
};

export type ProductInformation = {
  otherIngredients?: string[];
  storageKo?: string;
  labelMatched?: boolean;
  checkedAt?: string;
  referenceLabel?: { servingBasisKo?: string; suggestedUseKo?: string; ingredients?: ScanIngredient[] };
  guidance?: {
    overviewKo?: string;
    routineTipKo?: string;
    cautionKo?: string;
    sources: Array<{ title: string; url: string }>;
  };
};

export type SupplementDetailResponse = {
  productInformation?: ProductInformation;
  servingBasisKo?: string;
  id: number;
  brandName?: string;
  productName?: string;
  displayNameKo?: string;
  imageUri?: string;
  suggestedUseKo?: string;
  suggestedUseOriginal?: string;
  summaryKo?: string;
  originalLabelText?: string;
  warningSummary?: string;
  confirmedDoseTime?: string;
  ingredients: ScanIngredient[];
  doseLogs: DoseLogEntry[];
};

export type ScanStatus = 'PROCESSING' | 'COMPLETED' | 'FAILED';

export type ScanHistoryEntry = {
  scanId: number;
  status: ScanStatus;
  brandName?: string;
  productName?: string;
  displayNameKo?: string;
  imageUri?: string;
  saved: boolean;
  supplementId?: number;
  ingredientCount: number;
  reviewIngredientCount: number;
  hasWarnings: boolean;
  createdAt: string;
};

export type ScanHistoryResponse = {
  summary: {
    total: number;
    saved: number;
    needsReview: number;
    failed: number;
  };
  entries: ScanHistoryEntry[];
};

export type ExportSupplement = {
  servingBasisKo?: string;
  id: number;
  brandName?: string;
  productName?: string;
  displayNameKo?: string;
  suggestedUseKo?: string;
  doseTimes: string[];
  warningSummary?: string;
  createdAt: string;
  ingredients: Array<{
    name: string;
    amount?: string;
    unit?: string;
    needsReview: boolean;
  }>;
};

export type ExportDataResponse = {
  email: string;
  generatedAt: string;
  supplements: ExportSupplement[];
  doseHistory: DoseHistoryResponse;
};

export type ScanResearch = {
  status: 'LABEL_ONLY' | 'NEEDS_MORE_LABEL' | 'SEARCH_UNAVAILABLE' | 'NO_SOURCES' | 'CANDIDATE' | 'AMBIGUOUS' | 'NOT_FOUND';
  checkedAt?: string;
  verified: false;
  sources?: Array<{ title: string; url: string }>;
  searchQueries?: string[];
  matchReasonKo?: string;
  variantDescriptionKo?: string;
  candidate?: {
    brandName?: string;
    productName?: string;
    suggestedUseKo?: string;
    suggestedUseOriginal?: string;
    warningsKo?: string;
    warningsOriginal?: string;
    servingBasisKo?: string;
    ingredients?: ScanIngredient[];
  };
};

export type ScanResult = {
  productInformation?: ProductInformation;
  servingBasisKo?: string;
  research?: ScanResearch;
  scanId: number;
  status: ScanStatus;
  brandName: string;
  productName: string;
  suggestedUseKo: string;
  suggestedUseOriginal: string;
  warningsKo: string;
  warningsOriginal: string;
  originalLabelText: string;
  recommendedDoseTime: string;
  ingredients: ScanIngredient[];
};
