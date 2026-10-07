import type { ScanIngredient } from '../api/types';
import { createIngredientDraft, editIngredientField, finishIngredientDraft, newIngredientDraft } from './ingredientEditing';
const source: ScanIngredient[] = [
  { name: 'Vitamin C', amount: '500', unit: 'mg', originalText: 'Vitamin C 500 mg', confidence: 0.91, needsReview: false },
  { name: '삭제할 성분', amount: '10', unit: 'mg', originalText: 'Other 10 mg', confidence: 0.5, needsReview: true },
];
const untouched = JSON.stringify(source);
const initial = createIngredientDraft(source);
const renamed = editIngredientField(initial[0], 'name', ' 비타민 C ');
const corrected = editIngredientField(editIngredientField(renamed, 'amount', ' 250 '), 'unit', ' µg ');
const added = { ...newIngredientDraft(2), name: ' 아연 ', amount: '5', unit: 'mg' };
const result = finishIngredientDraft([corrected, added], ' 2정당 ');
if (!result.ok || result.servingBasisKo !== '2정당' || result.ingredients.length !== 2
  || result.ingredients[0].name !== '비타민 C' || result.ingredients[0].amount !== '250'
  || result.ingredients[0].unit !== 'µg' || result.ingredients[1].name !== '아연'
  || result.ingredients.some(item => 'key' in item)) throw Error('Edits, removal, addition and serving basis must form a clean confirmation payload.');
if (result.ingredients[0].originalText !== source[0].originalText || result.ingredients[0].confidence !== 0
  || result.ingredients[0].needsReview) throw Error('User review must preserve raw evidence without inventing AI confidence.');
if (JSON.stringify(source) !== untouched) throw Error('An editor draft must not mutate the previous product when cancelled.');
const missingName = finishIngredientDraft([newIngredientDraft(3)], '');
if (missingName.ok || missingName.invalidIndex !== 0) throw Error('An empty ingredient name cannot be applied.');
const missingAmount = finishIngredientDraft([{ ...newIngredientDraft(4), name: '철' }], '');
if (!missingAmount.ok || missingAmount.servingBasisKo || !missingAmount.ingredients[0].needsReview) throw Error('Unknown amount and basis must remain unknown rather than inferred.');
if (finishIngredientDraft([corrected], 'a'.repeat(256)).ok) throw Error('Overlong serving basis must be rejected before calling the API.');
