import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { colors, radii } from '@/constants/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  /** Rendered above the scroll area (e.g. a back button). */
  headerLeft?: ReactNode;
  headerRight?: ReactNode;
  /** Sticky footer (primary action). */
  footer?: ReactNode;
  children: ReactNode;
};

/** App-wide bottom sheet: gesture to dismiss, backdrop, keyboard aware, sized to content. */
export function Sheet({ visible, onClose, title, subtitle, headerLeft, headerRight, footer, children }: Props) {
  const ref = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) ref.current?.present();
    else ref.current?.dismiss();
  }, [visible]);

  const backdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={ref}
      onDismiss={onClose}
      enableDynamicSizing
      backdropComponent={backdrop}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      handleIndicatorStyle={styles.handle}
      backgroundStyle={styles.background}>
      <BottomSheetScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: footer ? 12 : Math.max(insets.bottom, 16) }]}>
        {title ? (
          <View style={styles.head}>
            {headerLeft}
            <View style={styles.headCopy}>
              <AppText heading weight="semibold" variant="title">
                {title}
              </AppText>
              {subtitle ? (
                <AppText muted variant="meta">
                  {subtitle}
                </AppText>
              ) : null}
            </View>
            {headerRight}
          </View>
        ) : null}
        {children}
      </BottomSheetScrollView>
      {footer ? <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>{footer}</View> : null}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  background: { backgroundColor: colors.background, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl },
  handle: { backgroundColor: colors.border, width: 40 },
  content: { paddingHorizontal: 16, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  headCopy: { flex: 1, gap: 2 },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
