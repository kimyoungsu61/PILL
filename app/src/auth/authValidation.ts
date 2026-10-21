import { passwordBytes, validateEmail } from '../account/forms';

export type AuthFieldErrors = {
  emailError: string;
  passwordError: string;
};

export function validateAuthFields(email: string, password: string): AuthFieldErrors {
  return {
    emailError: validateEmail(email) ? '이메일 형식을 확인해 주세요.' : '',
    passwordError: password.length < 8 ? '비밀번호는 8자 이상이어야 합니다.'
      : passwordBytes(password) > 72 ? '비밀번호는 영문 72자 또는 한글 24자 이내로 입력해 주세요.' : '',
  };
}
