import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pill } from 'lucide-react-native';
import { useAuth } from '../auth/AuthContext';
import { validateAuthFields } from '../auth/authValidation';
import RitualAction from '../components/RitualAction';
import RitualSurface from '../components/RitualSurface';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { colors, radius, spacing, type } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit() {
    setFormError('');
    const fieldErrors = validateAuthFields(email, password);
    setEmailError(fieldErrors.emailError);
    setPasswordError(fieldErrors.passwordError);
    if (fieldErrors.emailError || fieldErrors.passwordError) {
      return;
    }

    try {
      setIsSubmitting(true);
      await login(email, password);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '로그인에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.rail}>
          <View style={styles.brandHeader}>
            <View style={styles.logo}>
              <Pill size={26} color={colors.primaryText} strokeWidth={1.8} />
            </View>
            <View>
              <Text style={styles.brandName}>PILL</Text>
            </View>
          </View>

          <View style={styles.intro}>
            <Text style={styles.title}>내 영양제,{'\n'}매일의 기록</Text>
            <Text style={styles.subtitle}>등록한 영양제와 복용 기록을 이어서 확인하세요.</Text>
          </View>

          <RitualSurface style={styles.panel}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>이메일</Text>
              <TextInput
                accessibilityLabel="이메일"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                keyboardType="email-address"
                maxLength={255}
                onChangeText={setEmail}
                placeholder="name@example.com"
                placeholderTextColor={colors.muted}
                style={styles.input}
                textContentType="emailAddress"
                value={email}
              />
              {emailError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{emailError}</Text> : null}
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>비밀번호</Text>
              <TextInput
                accessibilityLabel="비밀번호"
                autoCapitalize="none"
                autoComplete="current-password"
                autoCorrect={false}
                maxLength={128}
                onChangeText={setPassword}
                placeholder="8자 이상 입력"
                placeholderTextColor={colors.muted}
                secureTextEntry
                style={styles.input}
                textContentType="password"
                value={password}
              />
              {passwordError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{passwordError}</Text> : null}
            </View>
            {formError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{formError}</Text> : null}
            <RitualAction
              fullWidth
              label="로그인"
              loading={isSubmitting}
              onPress={() => void submit()}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate('Signup')}
              style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
            >
              <Text style={styles.linkText}>처음이신가요? 계정 만들기</Text>
            </Pressable>
          </RitualSurface>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  rail: {
    alignSelf: 'center',
    maxWidth: 460,
    width: '100%',
  },
  brandHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: 32,
  },
  logo: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  brandName: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  brandKicker: {
    color: colors.active,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 2,
  },
  intro: {
    marginBottom: spacing.xl,
  },
  title: {
    ...type.hero,
    fontSize: 31,
    lineHeight: 38,
  },
  subtitle: {
    ...type.body,
    marginTop: spacing.sm,
  },
  panel: {
    gap: spacing.lg,
    padding: 0,
    backgroundColor: 'transparent',
  },
  fieldGroup: {
    gap: spacing.sm,
  },
  label: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 0,
    color: colors.ink,
    fontSize: 15,
    minHeight: 56,
    paddingHorizontal: spacing.lg,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 19,
  },
  linkButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  linkText: {
    color: colors.active,
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.72,
  },
});
