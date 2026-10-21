export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function validateEmail(value: string) {
  const email = normalizeEmail(value);
  if (!email) return '이메일을 입력해 주세요.';
  return email.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '' : '이메일 주소를 확인해 주세요.';
}

export function passwordBytes(value: string) {
  let bytes = 0;
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  return bytes;
}

export function validateNewPassword(password: string, confirmation: string) {
  if (password.length < 8) return '비밀번호는 8자 이상으로 정해 주세요.';
  if (passwordBytes(password) > 72) return '비밀번호가 너무 길어요. 영문 72자 또는 한글 24자 이내로 입력해 주세요.';
  if (password !== confirmation) return '두 비밀번호가 같지 않아요.';
  return '';
}
