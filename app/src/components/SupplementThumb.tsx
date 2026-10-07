import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, radius, supplementInitial } from '../theme';

type Props = {
  imageUri?: string;
  name?: string;
  size?: number;
  muted?: boolean;
  tone?: 'indigo' | 'blue' | 'amber';
};

const toneColors = {
  indigo: { background: colors.activeSoft, text: colors.active },
  blue: { background: colors.surfaceElevated, text: colors.inkSoft },
  amber: { background: colors.completedSoft, text: colors.completed },
};

export default function SupplementThumb({ imageUri, name, size = 52, muted = false, tone = 'indigo' }: Props) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const showImage = Boolean(imageUri && failedUri !== imageUri);
  const palette = toneColors[tone];
  const frameStyle = {
    borderRadius: radius.lg,
    height: size,
    width: size,
  };

  return (
    <View
      accessibilityLabel={showImage ? `${name || '영양제'} 제품 이미지` : `${name || '영양제'} 이니셜`}
      style={[
        styles.frame,
        frameStyle,
        { backgroundColor: muted ? colors.surfaceMuted : palette.background },
        muted && styles.muted,
      ]}
    >
      {showImage ? (
        <Image onError={() => setFailedUri(imageUri ?? null)} source={{ uri: imageUri }} style={styles.image} />
      ) : (
        <Text style={[styles.initial, { color: muted ? colors.muted : palette.text, fontSize: Math.max(18, size * 0.36) }]}>
          {supplementInitial(name)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    borderColor: colors.line,
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    backgroundColor: colors.surfaceMuted,
    height: '100%',
    width: '100%',
  },
  muted: {
    opacity: 0.68,
  },
  initial: {
    fontWeight: '900',
  },
});
