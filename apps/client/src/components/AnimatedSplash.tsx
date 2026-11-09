import { useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '@/constants/theme';

type AnimatedSplashProps = {
  isReady: boolean;
  onAnimationComplete?: () => void;
};

const MIN_DISPLAY_MS = 900;
const MAX_SAFETY_MS = 3000;

/** Short brand ident over the native splash; exits once auth is ready. */
export function AnimatedSplash({ isReady, onAnimationComplete }: AnimatedSplashProps) {
  const { width } = useWindowDimensions();
  const [minElapsed, setMinElapsed] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const exiting = useRef(false);

  const logoWidth = Math.min(Math.round(width * 0.62), 260);
  const opacity = useSharedValue(1);
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.94);

  useEffect(() => {
    const ease = { duration: 420, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };
    logoOpacity.value = withTiming(1, ease);
    logoScale.value = withTiming(1, ease);
    const min = setTimeout(() => setMinElapsed(true), MIN_DISPLAY_MS);
    const safety = setTimeout(() => setTimedOut(true), MAX_SAFETY_MS);
    return () => {
      clearTimeout(min);
      clearTimeout(safety);
    };
  }, [logoOpacity, logoScale]);

  useEffect(() => {
    if (exiting.current) return;
    if (!((isReady && minElapsed) || timedOut)) return;
    exiting.current = true;
    const done = () => onAnimationComplete?.();
    opacity.value = withTiming(0, { duration: 220, reduceMotion: ReduceMotion.System }, (finished) => {
      if (finished) runOnJS(done)();
    });
  }, [isReady, minElapsed, timedOut, onAnimationComplete, opacity]);

  const containerStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]} pointerEvents="none">
      <Animated.Image
        source={require('../../assets/images/logo2.png')}
        style={[{ width: logoWidth, height: Math.round(logoWidth / 3) }, logoStyle]}
        resizeMode="contain"
        accessibilityLabel="QuickBite"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    zIndex: 100,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
