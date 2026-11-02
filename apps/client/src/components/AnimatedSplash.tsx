import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Image,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

type AnimatedSplashProps = {
  isReady: boolean;
  onAnimationComplete?: () => void;
};

// Precise brand palette & background matching reference ident
const CHARCOAL_BG = '#08090C';
const AMBER_GLOW = 'rgba(255, 90, 31, 0.05)';
const CRUMB_COLOR = '#FF641A';
const CRUMB_COLOR_LIGHT = '#FF8C38';

const MIN_DISPLAY_MS = 1000;
const MAX_SAFETY_MS = 4500;

export function AnimatedSplash({ isReady, onAnimationComplete }: AnimatedSplashProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const exiting = useRef(false);

  // Proportional sizing respecting safe composition
  const logoWidth = Math.min(Math.round(screenWidth * 0.72), 280);
  const logoHeight = Math.round(logoWidth / 3); // 2172 x 724 -> 3:1 ratio
  const trailWidth = Math.round(Math.max(screenWidth * 1.35, screenHeight * 0.75));
  const trailHeight = Math.round(trailWidth * 0.5615); // 1024 x 575 ratio

  // Shared values - Container & Transition
  const containerOpacity = useSharedValue(1);

  // Shared values - Speed Trails
  const trailTranslateX = useSharedValue(-screenWidth * 0.95);
  const trailTranslateY = useSharedValue(0);
  const trailScaleX = useSharedValue(1.35);
  const trailScaleY = useSharedValue(1);
  const trailOpacity = useSharedValue(0);

  const bgStreakTranslateX = useSharedValue(-50);
  const bgStreakOpacity = useSharedValue(0);

  const fgStreakTranslateX = useSharedValue(-screenWidth * 1.2);
  const fgStreakOpacity = useSharedValue(0);

  // Shared values - Logo Reveal & Directional Slide (No bounce/pulse/glow)
  const logoOpacity = useSharedValue(0);
  const logoTranslateX = useSharedValue(-32);
  const maskTranslateX = useSharedValue(0);

  // Shared values - Living Food Elements (independent organic trajectories)
  const leafX = useSharedValue(-26);
  const leafY = useSharedValue(-18);
  const leafRotate = useSharedValue(-24);
  const leafOpacity = useSharedValue(0);

  const tomatoX = useSharedValue(32);
  const tomatoY = useSharedValue(20);
  const tomatoRotate = useSharedValue(34);
  const tomatoOpacity = useSharedValue(0);

  const steamY = useSharedValue(16);
  const steamX = useSharedValue(0);
  const steamOpacity = useSharedValue(0);

  const flakeY = useSharedValue(18);
  const flakeRotate = useSharedValue(26);
  const flakeOpacity = useSharedValue(0);

  const crumbsOpacity = useSharedValue(0);
  const crumb1Offset = useSharedValue(0);
  const crumb2Offset = useSharedValue(0);
  const crumb3Offset = useSharedValue(0);

  // Check reduced motion preference
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled);
      })
      .catch(() => {});

    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      if (mounted) setReduceMotion(enabled);
    });

    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  // Entrance & Continuous Motion
  useEffect(() => {
    if (reduceMotion) {
      // Accessible reduced motion: gentle fade-in with zero rapid sweeps
      logoOpacity.value = withTiming(1, { duration: 350 });
      logoTranslateX.value = 0;
      maskTranslateX.value = logoWidth + 20;
      trailOpacity.value = withTiming(0.7, { duration: 400 });
      trailTranslateX.value = 0;
      leafOpacity.value = withTiming(1, { duration: 400 });
      tomatoOpacity.value = withTiming(1, { duration: 400 });
      steamOpacity.value = withTiming(0.85, { duration: 400 });
      flakeOpacity.value = withTiming(0.9, { duration: 400 });
      crumbsOpacity.value = withTiming(0.8, { duration: 400 });

      const minTimer = setTimeout(() => setMinTimeElapsed(true), MIN_DISPLAY_MS);
      return () => clearTimeout(minTimer);
    }

    // 1. Entrance: Fast foreground streak whips across
    fgStreakOpacity.value = withSequence(
      withTiming(0.9, { duration: 100 }),
      withDelay(200, withTiming(0, { duration: 250 })),
    );
    fgStreakTranslateX.value = withTiming(screenWidth * 1.3, {
      duration: 380,
      easing: Easing.bezier(0.12, 1, 0.28, 1),
    });

    // 2. Background streaks parallax entrance + slow continuous parallax drift
    bgStreakOpacity.value = withTiming(0.65, { duration: 480 });
    bgStreakTranslateX.value = withTiming(
      0,
      { duration: 480, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) {
          bgStreakTranslateX.value = withRepeat(
            withSequence(
              withTiming(14, { duration: 6700, easing: Easing.inOut(Easing.sin) }),
              withTiming(-14, { duration: 6700, easing: Easing.inOut(Easing.sin) }),
            ),
            -1,
            true,
          );
        }
      },
    );

    // 3. Main flowing speed trail entrance
    trailOpacity.value = withTiming(1, { duration: 320 });
    trailScaleX.value = withTiming(1, {
      duration: 450,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    });
    trailTranslateX.value = withTiming(
      0,
      { duration: 450, easing: Easing.bezier(0.16, 1, 0.3, 1) },
      (finished) => {
        if (finished) {
          // Living motion: irregular curved floating undulation
          trailTranslateY.value = withRepeat(
            withSequence(
              withTiming(6, { duration: 4400, easing: Easing.inOut(Easing.sin) }),
              withTiming(-6, { duration: 4700, easing: Easing.inOut(Easing.sin) }),
            ),
            -1,
            true,
          );
          trailTranslateX.value = withRepeat(
            withSequence(
              withTiming(8, { duration: 5800, easing: Easing.inOut(Easing.sin) }),
              withTiming(-8, { duration: 6100, easing: Easing.inOut(Easing.sin) }),
            ),
            -1,
            true,
          );
          trailScaleY.value = withRepeat(
            withSequence(
              withTiming(1.02, { duration: 3700, easing: Easing.inOut(Easing.sin) }),
              withTiming(0.98, { duration: 3900, easing: Easing.inOut(Easing.sin) }),
            ),
            -1,
            true,
          );
        }
      },
    );

    // 4. Logo Reveal: Precisely timed mask unveil & directional slide (no bounce/pulse/glow)
    logoOpacity.value = withDelay(160, withTiming(1, { duration: 260 }));
    logoTranslateX.value = withDelay(
      160,
      withTiming(0, {
        duration: 380,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      }),
    );
    maskTranslateX.value = withDelay(
      160,
      withTiming(logoWidth + 24, {
        duration: 360,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      }),
    );

    // 5. Food Elements: Staggered entrance followed by organic living motion
    // Herb leaf
    leafOpacity.value = withDelay(240, withTiming(1, { duration: 320 }));
    leafX.value = withDelay(
      240,
      withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) {
          leafX.value = withRepeat(
            withSequence(
              withTiming(7, { duration: 3700, easing: Easing.inOut(Easing.sin) }),
              withTiming(-6, { duration: 4100, easing: Easing.inOut(Easing.sin) }),
            ),
            -1,
            true,
          );
        }
      }),
    );
    leafY.value = withDelay(
      240,
      withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) {
          leafY.value = withRepeat(
            withSequence(
              withTiming(-7, { duration: 4900, easing: Easing.inOut(Easing.sin) }),
              withTiming(5, { duration: 4300, easing: Easing.inOut(Easing.sin) }),
            ),
            -1,
            true,
          );
        }
      }),
    );
    leafRotate.value = withDelay(
      240,
      withTiming(-8, { duration: 420, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) {
          leafRotate.value = withRepeat(
            withSequence(
              withTiming(4, { duration: 4300, easing: Easing.inOut(Easing.sin) }),
              withTiming(-12, { duration: 4600, easing: Easing.inOut(Easing.sin) }),
            ),
            -1,
            true,
          );
        }
      }),
    );

    // Tomato wedge
    tomatoOpacity.value = withDelay(280, withTiming(1, { duration: 340 }));
    tomatoX.value = withDelay(
      280,
      withTiming(0, { duration: 440, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) {
          tomatoX.value = withRepeat(
            withSequence(
              withTiming(-6, { duration: 4600, easing: Easing.inOut(Easing.sin) }),
              withTiming(8, { duration: 5200, easing: Easing.inOut(Easing.sin) }),
            ),
            -1,
            true,
          );
        }
      }),
    );
    tomatoY.value = withDelay(
      280,
      withTiming(0, { duration: 440, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) {
          tomatoY.value = withRepeat(
            withSequence(
              withTiming(6, { duration: 3500, easing: Easing.inOut(Easing.sin) }),
              withTiming(-5, { duration: 3900, easing: Easing.inOut(Easing.sin) }),
            ),
            -1,
            true,
          );
        }
      }),
    );
    tomatoRotate.value = withDelay(
      280,
      withTiming(18, { duration: 440, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) {
          tomatoRotate.value = withRepeat(
            withSequence(
              withTiming(25, { duration: 5300, easing: Easing.inOut(Easing.sin) }),
              withTiming(14, { duration: 4700, easing: Easing.inOut(Easing.sin) }),
            ),
            -1,
            true,
          );
        }
      }),
    );

    // Steam wisps
    steamOpacity.value = withDelay(320, withTiming(0.85, { duration: 360 }, (finished) => {
      if (finished) {
        steamOpacity.value = withRepeat(
          withSequence(
            withTiming(0.95, { duration: 2300, easing: Easing.inOut(Easing.sin) }),
            withTiming(0.68, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          true,
        );
      }
    }));
    steamY.value = withDelay(
      320,
      withTiming(0, { duration: 440, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) {
          steamY.value = withRepeat(
            withSequence(
              withTiming(-9, { duration: 2700, easing: Easing.inOut(Easing.sin) }),
              withTiming(3, { duration: 2900, easing: Easing.inOut(Easing.sin) }),
            ),
            -1,
            true,
          );
        }
      }),
    );
    steamX.value = withRepeat(
      withSequence(
        withTiming(4, { duration: 3300, easing: Easing.inOut(Easing.sin) }),
        withTiming(-4, { duration: 3100, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );

    // Crispy flake
    flakeOpacity.value = withDelay(340, withTiming(0.9, { duration: 340 }));
    flakeY.value = withDelay(
      340,
      withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) {
          flakeY.value = withRepeat(
            withSequence(
              withTiming(-6, { duration: 5100, easing: Easing.inOut(Easing.sin) }),
              withTiming(5, { duration: 4800, easing: Easing.inOut(Easing.sin) }),
            ),
            -1,
            true,
          );
        }
      }),
    );
    flakeRotate.value = withDelay(
      340,
      withTiming(8, { duration: 420, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) {
          flakeRotate.value = withRepeat(
            withSequence(
              withTiming(16, { duration: 3900, easing: Easing.inOut(Easing.sin) }),
              withTiming(-3, { duration: 4300, easing: Easing.inOut(Easing.sin) }),
            ),
            -1,
            true,
          );
        }
      }),
    );

    // Spices & crumbs
    crumbsOpacity.value = withDelay(360, withTiming(0.85, { duration: 300 }));
    crumb1Offset.value = withRepeat(
      withSequence(
        withTiming(4, { duration: 2900, easing: Easing.inOut(Easing.sin) }),
        withTiming(-4, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
    crumb2Offset.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 3400, easing: Easing.inOut(Easing.sin) }),
        withTiming(4, { duration: 3600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
    crumb3Offset.value = withRepeat(
      withSequence(
        withTiming(3, { duration: 4100, easing: Easing.inOut(Easing.sin) }),
        withTiming(-3, { duration: 3800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );

    // Minimum display timer for assured brand impact
    const minTimer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, MIN_DISPLAY_MS);

    return () => clearTimeout(minTimer);
  }, [
    bgStreakOpacity,
    bgStreakTranslateX,
    crumb1Offset,
    crumb2Offset,
    crumb3Offset,
    crumbsOpacity,
    fgStreakOpacity,
    fgStreakTranslateX,
    flakeOpacity,
    flakeRotate,
    flakeY,
    leafOpacity,
    leafRotate,
    leafX,
    leafY,
    logoOpacity,
    logoTranslateX,
    logoWidth,
    maskTranslateX,
    reduceMotion,
    screenWidth,
    steamOpacity,
    steamX,
    steamY,
    tomatoOpacity,
    tomatoRotate,
    tomatoX,
    tomatoY,
    trailOpacity,
    trailScaleX,
    trailScaleY,
    trailTranslateX,
    trailTranslateY,
  ]);

  // Network failsafe: Never trap the user on splash screen if initialization hangs
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, MAX_SAFETY_MS);

    return () => clearTimeout(safetyTimer);
  }, []);

  // Transition: When app is ready (and min duration elapsed), orange trail sweeps across screen into app
  useEffect(() => {
    if (isReady && minTimeElapsed && !exiting.current) {
      exiting.current = true;

      const triggerComplete = () => {
        onAnimationComplete?.();
      };

      if (reduceMotion) {
        containerOpacity.value = withTiming(
          0,
          { duration: 250, easing: Easing.inOut(Easing.quad) },
          (finished) => {
            if (finished) runOnJS(triggerComplete)();
          },
        );
        return;
      }

      // High-speed sweep exit transition: the orange trail swoops forward across the screen
      trailTranslateX.value = withTiming(screenWidth * 1.5, {
        duration: 360,
        easing: Easing.bezier(0.38, 0, 0.2, 1),
      });
      trailScaleX.value = withTiming(1.45, {
        duration: 360,
        easing: Easing.bezier(0.38, 0, 0.2, 1),
      });

      // Foreground streak whips across as transition wipe
      fgStreakOpacity.value = withTiming(1, { duration: 100 });
      fgStreakTranslateX.value = withTiming(screenWidth * 1.6, {
        duration: 360,
        easing: Easing.bezier(0.38, 0, 0.2, 1),
      });

      // Logo & food elements sweep gently in trail's wake
      logoTranslateX.value = withTiming(42, {
        duration: 320,
        easing: Easing.in(Easing.cubic),
      });
      leafX.value = withTiming(48, { duration: 320 });
      tomatoX.value = withTiming(54, { duration: 320 });

      // Smooth alpha blend revealing the app underneath
      containerOpacity.value = withTiming(
        0,
        {
          duration: 340,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
        },
        (finished) => {
          if (finished) {
            runOnJS(triggerComplete)();
          }
        },
      );
    }
  }, [
    containerOpacity,
    fgStreakOpacity,
    fgStreakTranslateX,
    isReady,
    leafX,
    logoTranslateX,
    minTimeElapsed,
    onAnimationComplete,
    reduceMotion,
    screenWidth,
    tomatoX,
    trailScaleX,
    trailTranslateX,
  ]);

  // Animated styles
  const animatedContainerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  const animatedTrailStyle = useAnimatedStyle(() => ({
    opacity: trailOpacity.value,
    transform: [
      { translateX: trailTranslateX.value },
      { translateY: trailTranslateY.value },
      { scaleX: trailScaleX.value },
      { scaleY: trailScaleY.value },
    ],
  }));

  const animatedBgStreakStyle = useAnimatedStyle(() => ({
    opacity: bgStreakOpacity.value,
    transform: [{ translateX: bgStreakTranslateX.value }],
  }));

  const animatedFgStreakStyle = useAnimatedStyle(() => ({
    opacity: fgStreakOpacity.value,
    transform: [{ translateX: fgStreakTranslateX.value }],
  }));

  const animatedLogoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ translateX: logoTranslateX.value }],
  }));

  const animatedMaskStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: maskTranslateX.value }],
  }));

  const animatedLeafStyle = useAnimatedStyle(() => ({
    opacity: leafOpacity.value,
    transform: [
      { translateX: leafX.value },
      { translateY: leafY.value },
      { rotate: `${leafRotate.value}deg` },
    ],
  }));

  const animatedTomatoStyle = useAnimatedStyle(() => ({
    opacity: tomatoOpacity.value,
    transform: [
      { translateX: tomatoX.value },
      { translateY: tomatoY.value },
      { rotate: `${tomatoRotate.value}deg` },
    ],
  }));

  const animatedSteamStyle = useAnimatedStyle(() => ({
    opacity: steamOpacity.value,
    transform: [
      { translateX: steamX.value },
      { translateY: steamY.value },
    ],
  }));

  const animatedFlakeStyle = useAnimatedStyle(() => ({
    opacity: flakeOpacity.value,
    transform: [
      { translateY: flakeY.value },
      { rotate: `${flakeRotate.value}deg` },
    ],
  }));

  const animatedCrumbsStyle = useAnimatedStyle(() => ({
    opacity: crumbsOpacity.value,
  }));

  const animatedCrumb1Style = useAnimatedStyle(() => ({
    transform: [{ translateY: crumb1Offset.value }],
  }));

  const animatedCrumb2Style = useAnimatedStyle(() => ({
    transform: [{ translateY: crumb2Offset.value }],
  }));

  const animatedCrumb3Style = useAnimatedStyle(() => ({
    transform: [{ translateY: crumb3Offset.value }],
  }));

  return (
    <Animated.View style={[styles.overlay, animatedContainerStyle]} pointerEvents="none">
      {/* Background radial atmosphere */}
      <View style={styles.ambientAura} />

      {/* Layer 1: Background speed streaks (depth) */}
      <Animated.View
        style={[
          styles.ribbonLayer,
          { width: trailWidth, height: trailHeight },
          animatedBgStreakStyle,
        ]}>
        <Image
          source={require('../../assets/images/splash/streaks-bg.png')}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Layer 2: Main flowing asymmetrical speed trail */}
      <Animated.View
        style={[
          styles.ribbonLayer,
          { width: trailWidth, height: trailHeight },
          animatedTrailStyle,
        ]}>
        <Image
          source={require('../../assets/images/splash/trail-main.png')}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Layer 3: Central brand stage */}
      <View style={[styles.stage, { width: logoWidth, height: logoHeight }]}>
        {/* Crisp logo reveal container with directional clip and slide */}
        <View style={[styles.logoClipContainer, { width: logoWidth, height: logoHeight }]}>
          <Animated.View
            style={[
              styles.logoInner,
              { width: logoWidth, height: logoHeight },
              animatedLogoStyle,
            ]}>
            <Image
              source={require('../../assets/images/logo2.png')}
              style={{ width: logoWidth, height: logoHeight }}
              resizeMode="contain"
              accessibilityLabel="QuickBite"
            />
          </Animated.View>

          {/* Mask curtain that slides off rightwards in sync with the orange streak */}
          <Animated.View
            style={[
              styles.maskCurtain,
              { width: logoWidth + 24, height: logoHeight + 10 },
              animatedMaskStyle,
            ]}
          />
        </View>

        {/* Layer 4: Food Elements & Seasoning along independent trajectories */}
        {/* Fresh Herb leaf (upper-left) */}
        <Animated.View
          style={[
            styles.leafPosition,
            { left: -logoWidth * 0.16, top: -logoHeight * 1.05 },
            animatedLeafStyle,
          ]}>
          <Image
            source={require('../../assets/images/splash/element-leaf.png')}
            style={styles.leafImage}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Juicy Tomato wedge (lower-right) */}
        <Animated.View
          style={[
            styles.tomatoPosition,
            { right: -logoWidth * 0.22, bottom: -logoHeight * 0.72 },
            animatedTomatoStyle,
          ]}>
          <Image
            source={require('../../assets/images/splash/element-tomato.png')}
            style={styles.tomatoImage}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Steam wisps (upper-right) */}
        <Animated.View
          style={[
            styles.steamPosition,
            { right: -logoWidth * 0.08, top: -logoHeight * 1.35 },
            animatedSteamStyle,
          ]}>
          <Image
            source={require('../../assets/images/splash/element-steam.png')}
            style={styles.steamImage}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Almond / crispy flake (lower-center) */}
        <Animated.View
          style={[
            styles.flakePosition,
            { left: logoWidth * 0.52, bottom: -logoHeight * 0.95 },
            animatedFlakeStyle,
          ]}>
          <Image
            source={require('../../assets/images/splash/element-flake.png')}
            style={styles.flakeImage}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Small seasoning & spice crumbs */}
        <Animated.View style={[StyleSheet.absoluteFill, animatedCrumbsStyle]} pointerEvents="none">
          {/* Near herb leaf */}
          <Animated.View
            style={[
              styles.crumb,
              styles.crumbSmall,
              { left: -logoWidth * 0.24, top: -logoHeight * 0.8 },
              animatedCrumb1Style,
            ]}
          />
          <Animated.View
            style={[
              styles.crumb,
              styles.crumbTiny,
              { left: -logoWidth * 0.12, top: -logoHeight * 1.28 },
              animatedCrumb2Style,
            ]}
          />

          {/* Near steam */}
          <Animated.View
            style={[
              styles.crumb,
              styles.crumbSmall,
              { right: logoWidth * 0.06, top: -logoHeight * 0.95 },
              animatedCrumb3Style,
            ]}
          />

          {/* Near tomato */}
          <Animated.View
            style={[
              styles.crumb,
              styles.crumbTiny,
              { right: -logoWidth * 0.04, bottom: -logoHeight * 0.45 },
              animatedCrumb1Style,
            ]}
          />
          <Animated.View
            style={[
              styles.crumb,
              styles.crumbSmall,
              { right: -logoWidth * 0.12, bottom: -logoHeight * 0.88 },
              animatedCrumb2Style,
            ]}
          />
        </Animated.View>
      </View>

      {/* Layer 5: Fast Foreground motion streak (cinematic foreground speed) */}
      <Animated.View
        style={[
          styles.ribbonLayer,
          { width: trailWidth, height: trailHeight },
          animatedFgStreakStyle,
        ]}>
        <Image
          source={require('../../assets/images/splash/streaks-fg.png')}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: CHARCOAL_BG,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  ambientAura: {
    position: 'absolute',
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: AMBER_GLOW,
  },
  ribbonLayer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  stage: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoClipContainer: {
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  maskCurtain: {
    position: 'absolute',
    left: 0,
    top: -5,
    backgroundColor: CHARCOAL_BG,
    zIndex: 2,
  },
  leafPosition: {
    position: 'absolute',
    zIndex: 3,
  },
  leafImage: {
    width: 44,
    height: 30,
  },
  tomatoPosition: {
    position: 'absolute',
    zIndex: 3,
  },
  tomatoImage: {
    width: 58,
    height: 52,
  },
  steamPosition: {
    position: 'absolute',
    zIndex: 3,
  },
  steamImage: {
    width: 54,
    height: 82,
  },
  flakePosition: {
    position: 'absolute',
    zIndex: 3,
  },
  flakeImage: {
    width: 24,
    height: 23,
  },
  crumb: {
    position: 'absolute',
    backgroundColor: CRUMB_COLOR,
    shadowColor: CRUMB_COLOR_LIGHT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 3,
  },
  crumbSmall: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  crumbTiny: {
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: CRUMB_COLOR_LIGHT,
  },
});
