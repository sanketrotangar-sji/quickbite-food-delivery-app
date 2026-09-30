import type { ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { AntDesign } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { colors, radii, spacing } from '@/constants/theme';

type AuthFrameProps = {
  children: ReactNode;
  /** Shown under the logo — dashboard uses "Restaurant dashboard". */
  badge?: string;
};

/** Matches manager `AuthFrame`: cream page + white bordered card + logo. */
export function AuthFrame({ children, badge = 'Food delivery' }: AuthFrameProps) {
  return (
    <View style={styles.page}>
      <View style={styles.card}>
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
