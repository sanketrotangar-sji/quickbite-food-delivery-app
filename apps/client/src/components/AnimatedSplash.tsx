import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from './AppText';
import { colors, fonts } from '@/constants/theme';

type AnimatedSplashProps = {
  isReady: boolean;
  onAnimationComplete?: () => void;
};

export function AnimatedSplash({ isReady, onAnimationComplete }: AnimatedSplashProps) {
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const exiting = useRef(false);

  // Entrance shared values
  const logoScale = useSharedValue(0.82);
  const logoOpacity = useSharedValue(0);
  const logoTranslateY = useSharedValue(12);

  const glowScale = useSharedValue(0.8);
  const glowOpacity = useSharedValue(0);

  const pulseScale = useSharedValue(0.6);
  const pulseOpacity = useSharedValue(0);

  const pulse2Scale = useSharedValue(0.5);
  const pulse2Opacity = useSharedValue(0);

  const taglineOpacity = useSharedValue(0);
  const taglineTranslateY = useSharedValue(10);

  const dotsOpacity = useSharedValue(0);

  // Exit shared values
  const containerOpacity = useSharedValue(1);
  const containerScale = useSharedValue(1);

  // Phase 1 & 2: Entrance animations
  useEffect(() => {
    // Ambient warm glow fade & gentle breath
    glowOpacity.value = withTiming(0.8, { duration: 600, easing: Easing.out(Easing.cubic) });
    glowScale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.95, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );

    // Pulse rings
    pulseOpacity.value = withDelay(
      200,
      withRepeat(
        withSequence(
          withTiming(0.55, { duration: 400 }),
          withTiming(0, { duration: 800, easing: Easing.out(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );
    pulseScale.value = withDelay(
      200,
      withRepeat(
        withTiming(1.4, { duration: 1200, easing: Easing.out(Easing.quad) }),
        -1,
        false,
      ),
    );

    pulse2Opacity.value = withDelay(
      500,
      withRepeat(
        withSequence(
          withTiming(0.4, { duration: 400 }),
          withTiming(0, { duration: 800, easing: Easing.out(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );
    pulse2Scale.value = withDelay(
      500,
      withRepeat(
        withTiming(1.5, { duration: 1200, easing: Easing.out(Easing.quad) }),
        -1,
        false,
      ),
    );

    // Logo tactile spring entrance
    logoOpacity.value = withTiming(1, { duration: 450 });
    logoTranslateY.value = withSpring(0, { damping: 14, stiffness: 120 });
    logoScale.value = withSpring(1, { damping: 11, stiffness: 100 });

    // Tagline fade and lift
    taglineOpacity.value = withDelay(480, withTiming(1, { duration: 450 }));
    taglineTranslateY.value = withDelay(
      480,
      withSpring(0, { damping: 15, stiffness: 110 }),
    );

    // Loading indicator dots
    dotsOpacity.value = withDelay(700, withTiming(1, { duration: 400 }));

    // Ensure a minimum display duration of 1100ms for brand presence
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, 1100);

    return () => clearTimeout(timer);
  }, [
    dotsOpacity,
    glowOpacity,
    glowScale,
    logoOpacity,
    logoScale,
    logoTranslateY,
    pulse2Opacity,
    pulse2Scale,
    pulseOpacity,
    pulseScale,
    taglineOpacity,
    taglineTranslateY,
  ]);

  // Phase 4: Cinematic exit when ready and min time elapsed
  useEffect(() => {
    if (isReady && minTimeElapsed && !exiting.current) {
      exiting.current = true;

      const triggerComplete = () => {
        onAnimationComplete?.();
      };

      containerScale.value = withTiming(1.05, {
        duration: 380,
        easing: Easing.in(Easing.cubic),
      });

      containerOpacity.value = withTiming(
        0,
        {
          duration: 380,
          easing: Easing.inOut(Easing.quad),
        },
        (finished) => {
          if (finished) {
            runOnJS(triggerComplete)();
          }
        },
      );
    }
  }, [isReady, minTimeElapsed, containerOpacity, containerScale, onAnimationComplete]);

  const animatedContainerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
    transform: [{ scale: containerScale.value }],
  }));

  const animatedLogoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }, { translateY: logoTranslateY.value }],
  }));

  const animatedGlowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  const animatedPulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
    transform: [{ scale: pulseScale.value }],
  }));

  const animatedPulse2Style = useAnimatedStyle(() => ({
    opacity: pulse2Opacity.value,
    transform: [{ scale: pulse2Scale.value }],
  }));

  const animatedTaglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
    transform: [{ translateY: taglineTranslateY.value }],
  }));

  const animatedDotsStyle = useAnimatedStyle(() => ({
    opacity: dotsOpacity.value,
  }));

  return (
    <Animated.View style={[styles.overlay, animatedContainerStyle]} pointerEvents="none">
      <View style={styles.center}>
        {/* Warm ambient background radial aura */}
        <Animated.View style={[styles.glowDisc, animatedGlowStyle]} />

        {/* Dynamic expanding pulse rings in brand primary */}
        <Animated.View style={[styles.pulseRing, animatedPulseStyle]} />
        <Animated.View style={[styles.pulseRingSecondary, animatedPulse2Style]} />

        {/* Brand Emblem */}
        <Animated.View style={[styles.logoWrapper, animatedLogoStyle]}>
          <Image
            source={require('../../assets/images/logo2.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="QuickBite"
          />
        </Animated.View>

        {/* Tagline */}
        <Animated.View style={[styles.taglineWrapper, animatedTaglineStyle]}>
          <AppText style={styles.tagline}>Cravings, delivered.</AppText>
        </Animated.View>
      </View>

      {/* Subtle bottom brand loader line */}
      <Animated.View style={[styles.bottomBar, animatedDotsStyle]}>
        <View style={styles.indicatorTrack}>
          <View style={styles.indicatorThumb} />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 280,
    height: 280,
  },
  glowDisc: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(241, 90, 36, 0.08)',
  },
  pulseRing: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 2,
    borderColor: 'rgba(241, 90, 36, 0.28)',
  },
  pulseRingSecondary: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 1.5,
    borderColor: 'rgba(241, 90, 36, 0.16)',
  },
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  logo: {
    width: 210,
    height: 76,
  },
  taglineWrapper: {
    marginTop: 18,
    alignItems: 'center',
  },
  tagline: {
    fontFamily: fonts.headingMedium,
    fontSize: 15,
    letterSpacing: 0.6,
    color: colors.forestMuted,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 56,
    alignItems: 'center',
  },
  indicatorTrack: {
    width: 48,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(241, 90, 36, 0.15)',
    overflow: 'hidden',
  },
  indicatorThumb: {
    width: 22,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
});
