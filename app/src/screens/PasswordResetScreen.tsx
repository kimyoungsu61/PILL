import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CheckCircle2, Eye, EyeOff } from 'lucide-react-native';
import { normalizeEmail, validateEmail, validateNewPassword } from '../account/forms';
import { apiRequest } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import RitualAction from '../components/RitualAction';
import RitualSurface from '../components/RitualSurface';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { colors, type } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'PasswordReset'>;
type Receipt = { message: string; resendAfterSeconds: number };
type Step = 'email' | 'code' | 'done';

export default function PasswordResetScreen({ navigation, route }: Props) {
  const { token, email: signedInEmail, closeDeletedAccount } = useAuth();
  const owner = `${token ?? ''}|${signedInEmail ?? ''}`;
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const [email, setEmail] = useState(signedInEmail ?? route.params?.email ?? '');
  const [requestedEmail, setRequestedEmail] = useState('');
  const [step, setStep] = useState<Step>('email');
  const [config, setConfig] = useState<{ mailAvailable: boolean } | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState(false);
  const [busy, setBusy] = useState<'send' | 'reset' | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const active = useRef(false);
  const generation = useRef(0);
  const request = useRef(0);
  const inFlight = useRef(false);
  const remaining = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadConfig = useCallback(async () => {
    const entered = generation.current;
    const version = ++request.current;
    const current = () => active.current && generation.current === entered && request.current === version;
    setConfigLoading(true);
    setConfigError(false);
    try {
      const response = await apiRequest<{ mailAvailable: boolean }>('/api/auth/account-config');
      if (current()) setConfig(response);
    } catch {
      if (current()) setConfigError(true);
    } finally {
      if (current()) setConfigLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    active.current = true;
    generation.current += 1;
    setNow(Date.now());
    if (!inFlight.current) { setBusy(null); void loadConfig(); }
    return () => {
      active.current = false;
      generation.current += 1;
      request.current += 1;
      setPassword('');
      setConfirmation('');
      setCode('');
      setShowPassword(false);
    };
  }, [loadConfig]));

  async function run(kind: 'send' | 'reset', action: (current: () => boolean) => Promise<void>) {
    if (!active.current || inFlight.current || configLoading || !config?.mailAvailable) return;
    const entered = generation.current;
    const version = ++request.current;
    const current = () => active.current && ownerRef.current === owner
      && generation.current === entered && request.current === version;
    inFlight.current = true;
    setBusy(kind);
    setError('');
    setMessage('');
    try { await action(current); }
    catch (err) { if (current()) setError(err instanceof Error ? err.message : '잠시 후 다시 시도해 주세요.'); }
    finally {
      inFlight.current = false;
      if (active.current && ownerRef.current === owner) {
        setBusy(null);
        if (!current()) void loadConfig();
      }
    }
  }

  function sendCode(resend = false) {
    if (remaining > 0) return;
    const destination = resend ? requestedEmail : normalizeEmail(token && signedInEmail ? signedInEmail : email);
    const invalid = validateEmail(destination);
    if (invalid) { setError(invalid); return; }
    void run('send', async current => {
      const response = await apiRequest<Receipt>('/api/auth/password-reset/request', {
        method: 'POST', body: JSON.stringify({ email: destination }),
      });
      if (!current()) return;
      setRequestedEmail(destination);
      setEmail(destination);
      setStep('code');
      setCode('');
      setCooldownUntil(Date.now() + Math.max(0, response.resendAfterSeconds) * 1000);
      setNow(Date.now());
      setMessage(response.message || '가입된 이메일이라면 인증번호를 보내드려요. 메일함을 확인해 주세요.');
    });
  }

  function resetPassword() {
    if (!/^\d{6}$/.test(code)) { setError('이메일로 받은 인증번호 6자리를 입력해 주세요.'); return; }
    const invalid = validateNewPassword(password, confirmation);
    if (invalid) { setError(invalid); return; }
    void run('reset', async current => {
      await apiRequest<void>('/api/auth/password-reset/confirm', {
        method: 'POST', body: JSON.stringify({ email: requestedEmail, code, newPassword: password }),
      });
      if (!current()) return;
      setPassword(''); setConfirmation(''); setCode('');
      setStep('done');
      if (token && ownerRef.current === owner && normalizeEmail(requestedEmail) === normalizeEmail(signedInEmail ?? '')) {
        await closeDeletedAccount();
      }
    });
  }

  function editEmail() {
    if (busy) return;
    setStep('email'); setCode(''); setPassword(''); setConfirmation(''); setShowPassword(false); setError(''); setMessage('');
  }

  const disabled = busy !== null || configLoading || !config?.mailAvailable;
  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.rail}>
        {step === 'done' ? <RitualSurface style={styles.success}>
          <View style={styles.successIcon}><CheckCircle2 size={32} strokeWidth={1.6} color={colors.completed} /></View>
          <Text style={styles.heading}>비밀번호를 바꿨어요</Text>
          <Text style={[styles.body, styles.center]}>모든 기기에서 기존 로그인이 종료됐어요.{ '\n' }새 비밀번호로 다시 로그인해 주세요.</Text>
          <Text style={[styles.meta, styles.center]}>다시 로그인한 뒤 알림 설정에서 이 기기를 다시 연결해 주세요.</Text>
          <RitualAction label="로그인하러 가기" fullWidth onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] })} />
        </RitualSurface> : <>
          <View style={styles.intro}>
            <Text style={styles.heading}>{step === 'email' ? '비밀번호를 잊으셨나요?' : '새 비밀번호를 정해 주세요'}</Text>
            <Text style={styles.body}>{step === 'email' ? '가입한 이메일로 본인을 확인하고 비밀번호를 다시 정할 수 있어요.' : '이메일로 받은 인증번호와 새 비밀번호를 입력해 주세요.'}</Text>
          </View>
          {configLoading ? <View style={styles.loading}><ActivityIndicator size="small" color={colors.active} /><Text style={styles.meta}>잠시만 기다려 주세요.</Text></View>
            : configError ? <RitualSurface style={styles.card}><Text style={styles.body}>연결 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.</Text><RitualAction label="다시 확인하기" tone="secondary" onPress={() => void loadConfig()} /></RitualSurface>
              : config && !config.mailAvailable ? <RitualSurface style={styles.card}><Text style={styles.sectionTitle}>이메일 안내를 준비 중이에요</Text><Text style={styles.body}>지금은 비밀번호 재설정 메일을 보낼 수 없어요. 잠시 후 다시 확인해 주세요.</Text><RitualAction label="다시 확인하기" tone="secondary" onPress={() => void loadConfig()} /></RitualSurface> : null}
          <RitualSurface style={styles.card}>
            {step === 'email' ? <>
              <View style={styles.field}>
                <Text style={styles.label}>가입한 이메일</Text>
                <TextInput accessibilityLabel="비밀번호를 재설정할 이메일" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" keyboardType="email-address"
                  value={email} onChangeText={setEmail} maxLength={255} editable={!busy && !token} style={styles.input} placeholder="name@example.com" placeholderTextColor={colors.faint} />
              </View>
              <RitualAction label={remaining > 0 ? `${remaining}초 후 다시 받기` : '인증번호 받기'} fullWidth disabled={disabled || remaining > 0} loading={busy === 'send'} onPress={() => sendCode()} />
            </> : <>
              <View style={styles.emailRow}><Text selectable style={styles.email}>{requestedEmail}</Text>{!token ? <Pressable accessibilityRole="button" disabled={busy !== null} onPress={editEmail} style={styles.editEmail}><Text style={styles.link}>변경</Text></Pressable> : null}</View>
              <View style={styles.field}>
                <Text style={styles.label}>인증번호</Text>
                <TextInput accessibilityLabel="비밀번호 재설정 인증번호" autoComplete="one-time-code" textContentType="oneTimeCode" keyboardType="number-pad" maxLength={6}
                  value={code} onChangeText={value => setCode(value.replace(/\D/g, ''))} editable={!busy} style={[styles.input, styles.code]} placeholder="6자리 인증번호" placeholderTextColor={colors.faint} />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>새 비밀번호</Text>
                <View style={styles.passwordWrap}>
                  <TextInput accessibilityLabel="새 비밀번호" autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" secureTextEntry={!showPassword}
                    value={password} onChangeText={setPassword} maxLength={72} editable={!busy} style={styles.passwordInput} placeholder="8자 이상 입력" placeholderTextColor={colors.faint} />
                  <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'} onPress={() => setShowPassword(value => !value)} style={styles.eye} disabled={busy !== null}>
                    {showPassword ? <EyeOff size={20} color={colors.muted} /> : <Eye size={20} color={colors.muted} />}
                  </Pressable>
                </View>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>새 비밀번호 확인</Text>
                <TextInput accessibilityLabel="새 비밀번호 확인" autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" secureTextEntry={!showPassword}
                  value={confirmation} onChangeText={setConfirmation} maxLength={72} editable={!busy} style={styles.input} placeholder="한 번 더 입력해 주세요" placeholderTextColor={colors.faint} />
              </View>
              <Text style={styles.meta}>비밀번호를 바꾸면 모든 기기에서 다시 로그인해야 해요.</Text>
              <RitualAction label="새 비밀번호 저장" fullWidth disabled={disabled || code.length !== 6 || !password || !confirmation} loading={busy === 'reset'} onPress={resetPassword} />
              <RitualAction label={remaining > 0 ? `${remaining}초 후 다시 받기` : '인증번호 다시 받기'} tone="quiet" disabled={disabled || remaining > 0} loading={busy === 'send'} onPress={() => sendCode(true)} fullWidth />
            </>}
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            {message ? <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text> : null}
          </RitualSurface>
          <Pressable accessibilityRole="button" disabled={busy !== null} onPress={() => token ? navigation.goBack() : navigation.navigate('Login')} style={styles.backLink}><Text style={styles.link}>{token ? '계정 관리로 돌아가기' : '로그인으로 돌아가기'}</Text></Pressable>
        </>}
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, padding: 24, paddingTop: 32, paddingBottom: 48 },
  rail: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: 24 },
  intro: { gap: 10 },
  heading: { ...type.hero, fontSize: 26, lineHeight: 35 },
  sectionTitle: { ...type.section },
  body: { ...type.body },
  meta: { ...type.meta },
  card: { padding: 20, gap: 18 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  field: { gap: 8 },
  label: { color: colors.inkSoft, fontSize: 13, fontWeight: '500', lineHeight: 20 },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, minHeight: 52, paddingHorizontal: 14, color: colors.ink, backgroundColor: colors.surface, fontSize: 16 },
  code: { textAlign: 'center', letterSpacing: 5, fontVariant: ['tabular-nums'] },
  passwordWrap: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, flexDirection: 'row', minHeight: 52, backgroundColor: colors.surface },
  passwordInput: { minWidth: 0, flex: 1, paddingLeft: 14, color: colors.ink, fontSize: 16 },
  eye: { width: 48, alignItems: 'center', justifyContent: 'center' },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: 8 },
  email: { flex: 1, minWidth: 0, color: colors.inkSoft, fontSize: 14, lineHeight: 22 },
  editEmail: { minHeight: 44, justifyContent: 'center', paddingLeft: 8 },
  link: { color: colors.active, fontSize: 13, lineHeight: 21, fontWeight: '500' },
  backLink: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 21 },
  message: { color: colors.inkSoft, fontSize: 13, lineHeight: 21 },
  success: { padding: 24, gap: 20, alignItems: 'center', marginTop: 30 },
  successIcon: { width: 66, height: 66, borderRadius: 33, backgroundColor: colors.completedSoft, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
});
