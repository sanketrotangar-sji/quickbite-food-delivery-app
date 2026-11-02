import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { AntDesign, Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { colors, radii, spacing } from '@/constants/theme';

type AuthFrameProps = {
  children: ReactNode;
  /** Shown under the logo — dashboard uses "Restaurant dashboard". */
  badge?: string;
  onBack?: () => void;
};

/** Matches manager `AuthFrame`: cream page + white bordered card + logo. */
export function AuthFrame({ children, badge = 'Food delivery', onBack }: AuthFrameProps) {
  return (
    <View style={styles.page}>
      <View style={styles.card}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </Pressable>
        ) : null}
        <View style={styles.brand}>
          <Image
            source={require('../../../assets/images/logo2.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="QuickBite"
          />
          <AppText weight="semibold" muted style={styles.badge}>
            {badge}
          </AppText>
        </View>
        {children}
      </View>
    </View>
  );
}

export function GoogleMark({ size = 20 }: { size?: number }) {
  return <AntDesign name="google" size={size} color="#4285F4" accessibilityElementsHidden />;
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    shadowColor: colors.text,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    position: 'relative',
  },
  backBtn: {
    position: 'absolute',
    top: 14,
    left: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    backgroundColor: colors.primaryWash,
  },
  pressed: {
    opacity: 0.7,
  },
  brand: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  logo: {
    width: 168,
    height: 64,
  },
  badge: {
    marginTop: 12,
    fontSize: 14,
  },
});
