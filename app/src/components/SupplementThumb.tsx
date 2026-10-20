import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { loadProductImage } from '../api/productImages';
import { useAuth } from '../auth/AuthContext';
import { DESIGN_PREVIEW_TOKEN } from '../auth/designPreview';
import { colors, radius, supplementInitial } from '../theme';

type Props = {
  supplementId?: number;
  imageUri?: string;
  name?: string;
  size?: number;
  muted?: boolean;
  tone?: 'indigo' | 'blue' | 'amber';
};

const toneColors = {
  indigo: { background: colors.activeSoft, text: colors.active },
  blue: { background: colors.surfaceMuted, text: colors.inkSoft },
  amber: { background: colors.completedSoft, text: colors.completed },
};

export default function SupplementThumb({ supplementId, imageUri, name, size = 52, muted = false, tone = 'blue' }: Props) {
  const { token, email } = useAuth();
  const account = email || '';
  const [resolved, setResolved] = useState<{ id: number; account: string; uri: string } | null>(null);
  const savedUri = imageUri?.startsWith('https://') ? imageUri : undefined;
  const representativeUri = resolved && resolved.id === supplementId && resolved.account === account ? resolved.uri : savedUri;
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const showImage = Boolean(representativeUri && failedUri !== representativeUri);
  useEffect(() => {
    if (!supplementId || !token || token === DESIGN_PREVIEW_TOKEN || savedUri) return;
    let current = true;
    void loadProductImage(account, supplementId, token).then(result => {
      if (current && result.status === 'FOUND' && result.imageUri.startsWith('https://')) {
        setResolved({ id: supplementId, account, uri: result.imageUri });
      }
    }).catch(() => { /* Keep the neutral initial when a product photo is unavailable. */ });
    return () => { current = false; };
  }, [account, savedUri, supplementId, token]);
  const palette = toneColors[tone];
  const frameStyle = {
    borderRadius: radius.md,
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
        <Image accessibilityLabel={`${name || '영양제'} 제품 대표사진`} resizeMode="contain"
          onError={() => setFailedUri(representativeUri ?? null)} source={{ uri: representativeUri }} style={styles.image} />
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
    borderWidth: 0,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    backgroundColor: colors.surface,
    height: '88%',
    width: '88%',
  },
  muted: {
    opacity: 0.68,
  },
  initial: {
    fontWeight: '700',
  },
});
