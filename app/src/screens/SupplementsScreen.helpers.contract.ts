import type { SupplementSummary } from '../api/types';
import { filterSupplementsForSearch, supplementCollectionSummary } from './SupplementsScreen.helpers';

const supplements: SupplementSummary[] = [
  { id: 1, brandName: 'Nanowell', productName: 'HOVENIA-Rx Milk Thistle', displayNameKo: '간 건강' },
  { id: 2, brandName: 'Jongkundang', productName: 'Vitamin C 1000', displayNameKo: '비타민C' },
  { id: 3, brandName: 'Healthy Gut', productName: '55B Probiotics', displayNameKo: '유산균' },
];

if (filterSupplementsForSearch(supplements, '').length !== 3) {
  throw new Error('Empty search should keep every supplement.');
}

const korean = filterSupplementsForSearch(supplements, '유산균').map((supplement) => supplement.id).join(',');
if (korean !== '3') {
  throw new Error(`Search should match Korean display names: ${korean}`);
}

const english = filterSupplementsForSearch(supplements, 'vita').map((supplement) => supplement.id).join(',');
if (english !== '2') {
  throw new Error(`Search should match English product names case-insensitively: ${english}`);
}

const brand = filterSupplementsForSearch(supplements, 'nano').map((supplement) => supplement.id).join(',');
if (brand !== '1') {
  throw new Error(`Search should match brand names: ${brand}`);
}

if (supplementCollectionSummary(0, '') !== '등록된 영양제가 없어요') {
  throw new Error('Empty collection copy is wrong.');
}
if (supplementCollectionSummary(2, 'vita') !== '2개의 검색 결과') {
  throw new Error('Filtered collection copy is wrong.');
}
