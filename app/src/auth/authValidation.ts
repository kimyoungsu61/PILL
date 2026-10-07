export type AuthFieldErrors = {
  emailError: string;
  passwordError: string;
};

export function validateAuthFields(email: string, password: string): AuthFieldErrors {
  return {
    emailError: email.includes('@') ? '' : '이메일 형식을 확인해 주세요.',
    passwordError: password.length >= 8 ? '' : '비밀번호는 8자 이상이어야 합니다.',
  };
}
