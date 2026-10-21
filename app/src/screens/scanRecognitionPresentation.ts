import type { ScanRecognition, ScanResult } from '../api/types';
import { cleanScanText } from './ScanResultScreen.helpers';

const categories = new Set<ScanRecognition['category']>([
  'SUPPLEMENT', 'ALCOHOL', 'BEVERAGE', 'FOOD', 'MEDICINE', 'OTHER', 'UNKNOWN',
]);

const unknownMessage = '사진만으로 어떤 제품인지 확실히 알아보기 어려워요. 제품명과 라벨이 잘 보이도록 다시 찍어 주세요.';

export function scanRecognitionPresentation(result: Pick<ScanResult, 'status' | 'recognition'>) {
  const recognition = result.recognition;
  const category = recognition && categories.has(recognition.category) ? recognition.category : 'UNKNOWN';
  const confident = typeof recognition?.confidence === 'number'
    && Number.isFinite(recognition.confidence)
    && recognition.confidence >= 0.8 && recognition.confidence <= 1;
  const name = typeof recognition?.displayName === 'string' ? cleanScanText(recognition.displayName) : '';
  const message = typeof recognition?.messageKo === 'string' ? cleanScanText(recognition.messageKo) : '';
  const identified = category !== 'UNKNOWN' && confident && Boolean(name);
  const canRegister = result.status === 'COMPLETED' && category === 'SUPPLEMENT'
    && identified && recognition?.registrationAllowed === true;
  const knownOther = identified && category !== 'SUPPLEMENT';

  return {
    canRegister,
    identified,
    displayName: identified ? name : '어떤 제품인지 확인해 주세요',
    message: identified
      ? message || '촬영한 제품을 확인했어요. PILL에는 영양제만 등록할 수 있어요.'
      : unknownMessage,
    title: identified ? '알아두면 좋아요' : '사진을 한 번 더 찍어볼까요?',
    blockedReason: knownOther ? '영양제만 보관함에 저장할 수 있어요.' : '영양제인지 확인한 뒤 저장할 수 있어요.',
  };
}
