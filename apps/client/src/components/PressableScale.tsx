import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { motion } from '@/constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Scale while pressed (default from motion tokens). */
  scaleTo?: number;
  /** Light tap feedback on press. Use for add-to-cart, toggles, primary CTAs. */
  haptic?: boolean;
};

/** Pressable with a UI-thread press-in scale and optional haptic. */
export function PressableScale({
  children,
  style,
  scaleTo = motion.pressScale,
  haptic = false,
  onPressIn,
  onPressOut,
  onPress,
  disabled,
  ...rest
}: Props) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(event) => {
        scale.value = withTiming(scaleTo, { duration: motion.fast, reduceMotion: ReduceMotion.System });
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.value = withSpring(1, { damping: 14, stiffness: 260, reduceMotion: ReduceMotion.System });
        onPressOut?.(event);
      }}
      onPress={(event) => {
        if (haptic) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        onPress?.(event);
      }}
      style={[style, animated]}>
      {children}
    </AnimatedPressable>
  );
}
