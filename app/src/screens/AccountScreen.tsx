import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { CheckCircle2, Mail, ShieldCheck } from 'lucide-react-native';
import { apiRequest } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import RitualAction from '../components/RitualAction';
import RitualSurface from '../components/RitualSurface';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { colors, type } from '../theme';

type Profile = { email: string; emailVerified: boolean; mailAvailable: boolean };
type Receipt = { message: string; resendAfterSeconds: number };
type Work = 'send' | 'verify' | 'delete' | null;

export default function AccountScreen() {
  const { token, email, closeDeletedAccount } = useAuth();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const owner = `${token ?? ''}|${email ?? ''}`;
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const [snapshot, setSnapshot] = useState<{ owner: string; profile: Profile } | null>(null);
  const profile = snapshot?.owner === owner ? snapshot.profile : null;
  const [loading, setLoading] = useState(true);
  const [work, setWork] = useState<Work>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const active = useRef(false);
  const generation = useRef(0);
  const operation = useRef(0);
  const inFlight = useRef(false);
  const remaining = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const load = useCallback(async () => {
    if (!token || inFlight.current || !active.current) return;
    const entered = generation.current;
    const request = ++operation.current;
    const current = () => active.current && ownerRef.current === owner
      && generation.current === entered && operation.current === request;
    setLoading(true);
    setError('');
    try {
      const response = await apiRequest<Profile>('/api/account/profile', {}, token);
      if (current()) setSnapshot({ owner, profile: response });
    } catch (err) {
      if (current()) setError(err instanceof Error ? err.message : '계정 정보를 불러오지 못했어요.');
    } finally {
      if (current()) setLoading(false);
    }
  }, [owner, token]);
  const loadRef = useRef(load);
  loadRef.current = load;

  useFocusEffect(useCallback(() => {
    active.current = true;
    generation.current += 1;
    setNow(Date.now());
    if (!inFlight.current) setWork(null);
    void load();
    return () => {
      active.current = false;
      generation.current += 1;
      operation.current += 1;
      // Current-password fields are deliberately not retained after leaving.
      setPassword('');
      setConfirmation('');
      setCode('');
      setDeleting(false);
    };
  }, [load]));

  async function run(kind: Exclude<Work, null>, action: (current: () => boolean) => Promise<void>) {
    if (!token || loading || inFlight.current || !active.current) return;
    const entered = generation.current;
    const request = ++operation.current;
    const current = () => active.current && ownerRef.current === owner
      && generation.current === entered && operation.current === request;
    inFlight.current = true;
    setWork(kind);
    setError('');
    setMessage('');
    try {
      await action(current);
    } catch (err) {
      if (current()) setError(err instanceof Error ? err.message : '잠시 후 다시 시도해 주세요.');
    } finally {
      inFlight.current = false;
      if (active.current && ownerRef.current === owner) {
        setWork(null);
        if (!current()) void loadRef.current();
      }
    }
  }

  function sendCode() {
    if (!profile?.mailAvailable || profile.emailVerified || remaining > 0) return;
    void run('send', async current => {
      const response = await apiRequest<Receipt>('/api/account/email-verification/request', { method: 'POST' }, token ?? undefined);
      if (!current()) return;
      setCodeSent(true);
      setCode('');
      setCooldownUntil(Date.now() + Math.max(0, response.resendAfterSeconds) * 1000);
      setNow(Date.now());
      setMessage(response.message || '이메일로 인증번호를 보냈어요.');
    });
  }

  function verifyCode() {
    if (!/^\d{6}$/.test(code)) { setError('이메일로 받은 인증번호 6자리를 입력해 주세요.'); return; }
    void run('verify', async current => {
      const response = await apiRequest<Profile>('/api/account/email-verification/confirm', {
        method: 'POST', body: JSON.stringify({ code }),
      }, token ?? undefined);
      if (!current()) return;
      setSnapshot({ owner, profile: response });
      setCode('');
      setCodeSent(false);
      setMessage('이메일 확인이 끝났어요.');
    });
  }

  function deleteAccount() {
    if (!password || confirmation !== '탈퇴') return;
    void run('delete', async () => {
      await apiRequest<void>('/api/account', {
        method: 'DELETE', body: JSON.stringify({ password, confirmation }),
      }, token ?? undefined);
      // Deletion has already committed even if this screen was closed meanwhile.
      // Never clear a different account that signed in while the request ran.
      if (ownerRef.current === owner) await closeDeletedAccount();
    });
  }

  const busy = work !== null;
  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.rail}>
        <View style={styles.intro}>
          <Text style={styles.heading}>내 계정을 안전하게</Text>
          <Text style={styles.body}>로그인과 이메일, 계정 정보를 관리해요.</Text>
        </View>
        {loading && !profile ? <View style={styles.loading}><ActivityIndicator color={colors.active} /><Text style={styles.body}>계정 정보를 확인하고 있어요.</Text></View> : null}
        {profile ? <>
          <RitualSurface style={styles.card}>
            <View style={styles.sectionHeading}><Mail size={21} strokeWidth={1.8} color={colors.active} /><Text style={styles.sectionTitle}>로그인 이메일</Text></View>
            <Text selectable style={styles.email}>{profile.email}</Text>
            <View style={styles.statusRow}>
              {profile.emailVerified ? <CheckCircle2 size={16} color={colors.completed} /> : <View style={styles.pendingDot} />}
              <Text style={[styles.status, profile.emailVerified && styles.verified]}>{profile.emailVerified ? '확인된 이메일' : '이메일 확인이 필요해요'}</Text>
            </View>
            {profile.emailVerified ? <Text style={styles.body}>비밀번호를 잊었을 때 이 이메일로 계정을 다시 찾을 수 있어요.</Text>
              : !profile.mailAvailable ? <View style={styles.note}>
                <Text style={styles.noteTitle}>이메일 인증을 준비 중이에요</Text>
                <Text style={styles.meta}>지금은 인증 메일을 보낼 수 없어요. 잠시 후 다시 확인해 주세요.</Text>
                <RitualAction label="다시 확인하기" tone="quiet" disabled={busy} loading={loading} onPress={() => void load()} />
              </View> : <>
                <Text style={styles.body}>{codeSent ? '메일함에서 받은 6자리 인증번호를 입력해 주세요.' : '이메일을 확인해 두면 계정을 더 안전하게 이용할 수 있어요.'}</Text>
                {codeSent ? <>
                  <TextInput accessibilityLabel="이메일 인증번호" autoComplete="one-time-code" textContentType="oneTimeCode"
                    keyboardType="number-pad" maxLength={6} value={code} onChangeText={value => setCode(value.replace(/\D/g, ''))}
                    placeholder="6자리 인증번호" placeholderTextColor={colors.faint} style={[styles.input, styles.codeInput]} editable={!busy && !loading} />
                  <RitualAction label="이메일 확인하기" loading={work === 'verify'} disabled={busy || loading || code.length !== 6} onPress={verifyCode} fullWidth />
                  <RitualAction label={remaining > 0 ? `${remaining}초 후 다시 받기` : '인증번호 다시 받기'} tone="quiet" loading={work === 'send'} disabled={busy || loading || remaining > 0} onPress={sendCode} fullWidth />
                </> : <RitualAction label="인증번호 받기" loading={work === 'send'} disabled={busy || loading || remaining > 0} onPress={sendCode} fullWidth />}
              </>}
            {error && !deleting ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          </RitualSurface>
          <RitualSurface style={styles.card}>
            <View style={styles.sectionHeading}><ShieldCheck size={21} strokeWidth={1.8} color={colors.active} /><Text style={styles.sectionTitle}>비밀번호</Text></View>
            <Text style={styles.body}>이메일로 본인을 확인한 뒤 새 비밀번호를 정할 수 있어요.</Text>
            <RitualAction label="비밀번호 재설정" tone="secondary" disabled={busy || loading || !profile.mailAvailable} onPress={() => navigation.navigate('PasswordReset', { email: profile.email })} fullWidth />
          </RitualSurface>
        </> : null}
        {error && !profile ? <View style={styles.errorBox}><Text accessibilityRole="alert" style={styles.error}>{error}</Text>{!loading ? <RitualAction label="다시 불러오기" tone="secondary" onPress={() => void load()} /> : null}</View> : null}
        {message ? <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text> : null}
        {profile ? <View style={styles.deleteSection}>
          {!deleting ? <>
            <Text style={styles.deleteTitle}>PILL을 떠나시나요?</Text>
            <Text style={styles.meta}>계정과 연결된 모든 기록을 삭제할 수 있어요.</Text>
            <Pressable accessibilityRole="button" onPress={() => { setDeleting(true); setError(''); setMessage(''); }} disabled={busy || loading} style={styles.deleteLink}><Text style={styles.deleteLinkText}>회원 탈퇴</Text></Pressable>
          </> : <RitualSurface style={styles.card}>
            <Text style={styles.sectionTitle}>계정과 기록을 삭제할까요?</Text>
            <Text selectable style={styles.deleteEmail}>{profile.email}</Text>
            <Text style={styles.body}>등록한 영양제, 복용 기록, 분석 기록과 정원, 알림 설정이 모두 삭제돼요.</Text>
            <Text style={styles.deleteWarning}>탈퇴 후에는 기록을 복구할 수 없어요.</Text>
            <View style={styles.field}>
              <Text style={styles.label}>현재 비밀번호</Text>
              <TextInput accessibilityLabel="탈퇴 확인용 현재 비밀번호" autoCapitalize="none" autoCorrect={false} autoComplete="current-password" textContentType="password" secureTextEntry
                value={password} onChangeText={setPassword} maxLength={128} editable={!busy} style={styles.input} placeholder="현재 비밀번호" placeholderTextColor={colors.faint} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>확인을 위해 ‘탈퇴’를 입력해 주세요</Text>
              <TextInput accessibilityLabel="탈퇴 확인 문구" autoCapitalize="none" autoCorrect={false} value={confirmation} onChangeText={setConfirmation}
                editable={!busy} style={styles.input} placeholder="탈퇴" placeholderTextColor={colors.faint} maxLength={2} />
            </View>
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            <RitualAction label="계정과 기록 삭제" tone="danger" loading={work === 'delete'} disabled={busy || !password || confirmation !== '탈퇴'} onPress={deleteAccount} fullWidth />
            <RitualAction label="계속 이용할게요" tone="quiet" disabled={busy} onPress={() => { setDeleting(false); setPassword(''); setConfirmation(''); setError(''); }} fullWidth />
          </RitualSurface>}
        </View> : null}
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingBottom: 48 },
  rail: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: 20 },
  intro: { gap: 8, marginBottom: 4 },
  heading: { ...type.hero },
  body: { ...type.body },
  meta: { ...type.meta },
  card: { padding: 20, gap: 16 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionTitle: { ...type.section, lineHeight: 25 },
  email: { color: colors.ink, fontSize: 18, lineHeight: 28, fontWeight: '600' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -8 },
  status: { ...type.meta, color: colors.muted },
  verified: { color: colors.completed },
  pendingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.faint },
  note: { backgroundColor: colors.surfaceMuted, padding: 14, borderRadius: 12, gap: 6 },
  noteTitle: { color: colors.inkSoft, fontSize: 14, fontWeight: '600', lineHeight: 21 },
  loading: { paddingVertical: 30, alignItems: 'center', gap: 12 },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 14, minHeight: 52, color: colors.ink, backgroundColor: colors.surface, fontSize: 16 },
  codeInput: { textAlign: 'center', letterSpacing: 5, fontVariant: ['tabular-nums'] },
  field: { gap: 8 },
  label: { color: colors.inkSoft, fontSize: 13, lineHeight: 21, fontWeight: '500' },
  errorBox: { gap: 10 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 21 },
  message: { color: colors.completed, fontSize: 13, lineHeight: 21 },
  deleteSection: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 24, marginTop: 4, gap: 8 },
  deleteTitle: { color: colors.inkSoft, fontSize: 14, fontWeight: '600', lineHeight: 22 },
  deleteLink: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' },
  deleteLinkText: { color: colors.danger, fontSize: 13, textDecorationLine: 'underline' },
  deleteEmail: { color: colors.inkSoft, fontSize: 13, lineHeight: 21 },
  deleteWarning: { color: colors.danger, fontSize: 13, lineHeight: 21, fontWeight: '500' },
});
