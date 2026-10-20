import { useEffect, useRef, useState } from 'react';
import { AppState, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { colors, radius, shadow, spacing, type } from '../theme';
import { clampHour, createPressRepeat, formatClockTime, parseClockTime, stepMinute } from './TimePickerField.helpers';

type Props = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export default function TimePickerField({ label = '알림 시간', value, onChange, disabled }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const parsedValue = parseClockTime(value);
  const [draftHour, setDraftHour] = useState(parsedValue.hour);
  const [draftMinute, setDraftMinute] = useState(parsedValue.minute);

  useEffect(() => {
    if (!isOpen) {
      const nextValue = parseClockTime(value);
      setDraftHour(nextValue.hour);
      setDraftMinute(nextValue.minute);
    }
  }, [isOpen, value]);

  function openPicker() {
    if (disabled) {
      return;
    }
    const nextValue = parseClockTime(value);
    setDraftHour(nextValue.hour);
    setDraftMinute(nextValue.minute);
    setIsOpen(true);
  }

  function applyTime() {
    onChange(formatClockTime(draftHour, draftMinute));
    setIsOpen(false);
  }

  const displayValue = formatClockTime(parsedValue.hour, parsedValue.minute);

  return (
    <>
      <Pressable
        accessibilityLabel={`${label}, ${displayValue}`}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={openPicker}
        style={({ pressed }) => [styles.field, disabled && styles.disabledField, pressed && styles.pressed]}
      >
        <View style={styles.fieldCopy}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <Text style={styles.fieldValue}>{displayValue}</Text>
        </View>
        <View style={styles.fieldStepper}>
          <ChevronUp size={14} color={colors.sage} strokeWidth={2.6} />
          <ChevronDown size={14} color={colors.sage} strokeWidth={2.6} />
        </View>
      </Pressable>

      <Modal animationType="fade" onRequestClose={() => setIsOpen(false)} transparent visible={isOpen}>
        <Pressable onPress={() => setIsOpen(false)} style={styles.overlay}>
          <Pressable style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.title}>{label}</Text>
            <Text style={styles.subtitle}>길게 누르면 빠르게 조절할 수 있어요.</Text>

            <View style={styles.pickerRow}>
              <TimeColumn
                label="시"
                active={isOpen && !disabled}
                onDown={() => setDraftHour((current) => clampHour(current - 1))}
                onUp={() => setDraftHour((current) => clampHour(current + 1))}
                value={String(draftHour).padStart(2, '0')}
              />
              <Text style={styles.colon}>:</Text>
              <TimeColumn
                label="분"
                active={isOpen && !disabled}
                onDown={() => setDraftMinute((current) => stepMinute(current, -1))}
                onUp={() => setDraftMinute((current) => stepMinute(current, 1))}
                value={String(draftMinute).padStart(2, '0')}
              />
            </View>

            <View style={styles.actions}>
              <Pressable accessibilityLabel="시간 선택 취소" accessibilityRole="button" onPress={() => setIsOpen(false)} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                <Text style={styles.secondaryText}>취소</Text>
              </Pressable>
              <Pressable accessibilityLabel="시간 선택 적용" accessibilityRole="button" onPress={applyTime} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                <Text style={styles.primaryText}>적용</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

type TimeColumnProps = {
  label: string;
  active: boolean;
  value: string;
  onUp: () => void;
  onDown: () => void;
};

function TimeColumn({ label, active, value, onUp, onDown }: TimeColumnProps) {
  return (
    <View style={styles.timeColumn}>
      <TimeStepButton label={`${label} 올리기`} active={active} onStep={onUp} direction="up" />
      <View style={styles.numberPanel}>
        <Text style={styles.numberText}>{value}</Text>
        <Text style={styles.numberLabel}>{label}</Text>
      </View>
      <TimeStepButton label={`${label} 내리기`} active={active} onStep={onDown} direction="down" />
    </View>
  );
}

function TimeStepButton({ label, active, onStep, direction }: { label: string; active: boolean; onStep: () => void; direction: 'up' | 'down' }) {
  const latestStep = useRef(onStep);
  latestStep.current = onStep;
  const [repeat] = useState(() => createPressRepeat(() => latestStep.current()));
  useEffect(() => {
    if (!active) repeat.stop();
    return repeat.stop;
  }, [active, repeat]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') repeat.stop(); });
    function hidden() { if (document.hidden) repeat.stop(); }
    if (Platform.OS === 'web') {
      window.addEventListener('blur', repeat.stop);
      document.addEventListener('visibilitychange', hidden);
    }
    return () => {
      subscription.remove();
      if (Platform.OS === 'web') {
        window.removeEventListener('blur', repeat.stop);
        document.removeEventListener('visibilitychange', hidden);
      }
      repeat.stop();
    };
  }, [repeat]);
  const Icon = direction === 'up' ? ChevronUp : ChevronDown;
  return <Pressable accessibilityLabel={label} accessibilityRole="button" disabled={!active}
    delayLongPress={350} onPress={onStep} onLongPress={() => { if (active) repeat.start(); }}
    onPressOut={repeat.stop} onBlur={repeat.stop}
    style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}>
    <Icon size={24} color={colors.ink} strokeWidth={2.8} />
  </Pressable>;
}

const styles = StyleSheet.create({
  field: {
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 54,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  fieldCopy: {
    flex: 1,
    gap: 2,
  },
  disabledField: {
    opacity: 0.52,
  },
  fieldLabel: {
    ...type.meta,
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  fieldValue: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 24,
  },
  fieldStepper: {
    alignItems: 'center',
    backgroundColor: colors.indigoSoft,
    borderColor: colors.line,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  overlay: {
    backgroundColor: 'rgba(10, 8, 6, 0.72)',
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.lg,
  },
  sheet: {
    ...shadow.card,
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.lg,
    padding: spacing.xl,
  },
  sheetHandle: {
    alignSelf: 'center',
    backgroundColor: colors.line,
    borderRadius: 99,
    height: 4,
    width: 42,
  },
  title: {
    ...type.section,
    textAlign: 'center',
  },
  subtitle: {
    ...type.body,
    marginTop: -spacing.md,
    textAlign: 'center',
  },
  pickerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
  },
  timeColumn: {
    alignItems: 'center',
    gap: spacing.sm,
    width: 118,
  },
  stepButton: {
    alignItems: 'center',
    backgroundColor: colors.indigoSoft,
    borderColor: colors.line,
    borderRadius: radius.lg,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: '100%',
  },
  numberPanel: {
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.line,
    borderRadius: radius.xl,
    borderWidth: 1,
    height: 104,
    justifyContent: 'center',
    width: '100%',
  },
  numberText: {
    color: colors.ink,
    fontSize: 38,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 46,
  },
  numberLabel: {
    ...type.meta,
    color: colors.sage,
    fontWeight: '700',
  },
  colon: {
    color: colors.sage,
    fontSize: 34,
    fontWeight: '700',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 50,
  },
  secondaryText: {
    color: colors.inkSoft,
    fontSize: 15,
    fontWeight: '700',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    flex: 1,
    justifyContent: 'center',
    minHeight: 50,
  },
  primaryText: {
    color: colors.primaryText,
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.74,
    transform: [{ scale: 0.99 }],
  },
});
