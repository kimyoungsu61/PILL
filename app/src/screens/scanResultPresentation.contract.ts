import type { ScanResult } from '../api/types';
import { scanResultPresentation } from './scanResultPresentation';

const base: ScanResult = {
  scanId: 1, status: 'COMPLETED', brandName: 'Photo brand', productName: 'Photo product',
  suggestedUseKo: '', suggestedUseOriginal: '', warningsKo: '', warningsOriginal: '',
  originalLabelText: 'Photo label', recommendedDoseTime: '09:00', ingredients: [],
};
const researched = scanResultPresentation({
  ...base, research: {
    status: 'CANDIDATE', verified: false,
    candidate: {
      brandName: 'Web brand', productName: 'Web product', suggestedUseKo: '하루 1정',
      servingBasisKo: '1정당', ingredients: [{ name: 'Magnesium', amount: '100', unit: 'mg',
        originalText: 'Magnesium 100 mg', confidence: 0.96, needsReview: false }],
    },
    sources: [
      { title: 'Manufacturer', url: 'https://example.com/product' },
      { title: 'Same site', url: 'https://example.com/other' },
      { title: 'Unsafe', url: 'javascript:alert(1)' },
    ],
  },
});
if (researched.productName !== 'Photo product' || researched.suggestedUseKo !== '하루 1정'
  || researched.ingredients.length !== 1 || !researched.ingredients[0].needsReview
  || researched.sources.length !== 2 || researched.originalLabelText !== 'Photo label') {
  throw new Error('A grounded product should be populated for review without an import action.');
}
const photoOnly = scanResultPresentation({ ...base, research: { status: 'NO_SOURCES', verified: false } });
if (photoOnly.productName !== 'Photo product' || photoOnly.hasWebDetails) {
  throw new Error('Missing search evidence must keep the observed photo result.');
}

const observedBasis = scanResultPresentation({ ...base, servingBasisKo: '2캡슐당', ingredients: [{ name: '철', amount: '5', unit: 'mg', originalText: '', confidence: 0.8, needsReview: false }] });
if (observedBasis.servingBasisKo !== '2캡슐당') throw Error('Photo serving basis must be available for confirmation.');
const mixed = scanResultPresentation({ ...base, servingBasisKo: '1정당', ingredients: observedBasis.ingredients, research: { status: 'CANDIDATE', verified: false, candidate: { servingBasisKo: '3정당', ingredients: [] } } });
if (mixed.servingBasisKo !== '1정당') throw Error('Research basis must not be attached to observed ingredients when the candidate has no ingredient list.');

const conflictingWeb = scanResultPresentation({ ...base, servingBasisKo: '1정당', suggestedUseKo: '사진의 하루 1정', ingredients: [{ name: 'Mg', amount: '100', unit: 'mg', originalText: 'photo', confidence: 0.9, needsReview: false }], research: { status: 'CANDIDATE', verified: false, candidate: { suggestedUseKo: '웹의 하루 2정', servingBasisKo: '2정당', ingredients: [{ name: 'Mg', amount: '200', unit: 'mg', originalText: 'web', confidence: 0, needsReview: true }] } } });
if (conflictingWeb.ingredients[0].amount !== '100' || conflictingWeb.servingBasisKo !== '1정당' || conflictingWeb.suggestedUseKo !== '사진의 하루 1정') throw Error('Web research must not replace the photographed serving basis, amounts or use.');
