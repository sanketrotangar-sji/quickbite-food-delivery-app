import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { colors } from '@/constants/theme';

export function LogoLoader() {
  const scale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0.92, duration: 700, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.55, duration: 700, useNativeDriver: true }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, scale]);

  return (
    <View style={styles.fill}>
      <Animated.Image
        source={require('../../assets/images/logo.png')}
        resizeMode="contain"
        accessibilityLabel="QuickBite"
        style={[styles.logo, { opacity, transform: [{ scale }] }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  logo: { width: 168, height: 72 },
});
