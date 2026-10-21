import { normalizeEmail, passwordBytes, validateEmail, validateNewPassword } from './forms';
function check(value: boolean, message: string) { if (!value) throw new Error(message); }
check(normalizeEmail(' Example@Mail.COM ') === 'example@mail.com', 'Email identity normalizes consistently');
check(validateEmail('a@b.com') === '' && validateEmail('a@') !== '', 'Recovery requires a usable email');
check(validateNewPassword('abcdefgh', 'abcdefgh') === '', 'An eight-character password is valid');
check(validateNewPassword('abcdefgh', 'abcdEfgh') !== '', 'Confirmation must match exactly');
check(passwordBytes('가😀a') === 8, 'Password limits count UTF-8 bytes on native and web');
check(validateNewPassword('가'.repeat(24), '가'.repeat(24)) === '', 'BCrypt supports 72 bytes');
check(validateNewPassword('가'.repeat(25), '가'.repeat(25)) !== '', 'Do not silently truncate a multibyte password');
check(validateNewPassword('abcdefg ', 'abcdefg ') === '', 'Passwords are not trimmed');
