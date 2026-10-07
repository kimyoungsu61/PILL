import { validateAuthFields } from './authValidation';

const bothInvalid = validateAuthFields('missing-at-sign', 'short');
if (bothInvalid.emailError !== '이메일 형식을 확인해 주세요.') {
  throw new Error(`Invalid email should have a field error: ${bothInvalid.emailError}`);
}
if (bothInvalid.passwordError !== '비밀번호는 8자 이상이어야 합니다.') {
  throw new Error(`Short password should have a field error: ${bothInvalid.passwordError}`);
}

const passwordOnlyInvalid = validateAuthFields('person@example.com', 'short');
if (passwordOnlyInvalid.emailError !== '') {
  throw new Error(`Valid email should not have an error: ${passwordOnlyInvalid.emailError}`);
}
if (passwordOnlyInvalid.passwordError !== '비밀번호는 8자 이상이어야 합니다.') {
  throw new Error(`Short password should stay field-adjacent: ${passwordOnlyInvalid.passwordError}`);
}

const valid = validateAuthFields('person@example.com', 'long-enough-password');
if (valid.emailError !== '' || valid.passwordError !== '') {
  throw new Error(`Valid credentials should not have client field errors: ${JSON.stringify(valid)}`);
}
