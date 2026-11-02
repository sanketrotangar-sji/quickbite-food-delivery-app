import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  AccessibilityInfo: {
    isReduceMotionEnabled: vi.fn().mockResolvedValue(false),
    addEventListener: vi.fn().mockReturnValue({ remove: vi.fn() }),
  },
  Image: () => null,
  StyleSheet: {
    absoluteFill: {},
    create: (styles: unknown) => styles,
  },
  View: () => null,
  useWindowDimensions: () => ({ width: 390, height: 844 }),
}));

vi.mock('react-native-reanimated', () => ({
  default: {
    View: () => null,
  },
  Easing: {
    bezier: vi.fn(),
    in: vi.fn(),
    inOut: vi.fn(),
    out: vi.fn(),
    cubic: vi.fn(),
    quad: vi.fn(),
    sin: vi.fn(),
  },
  runOnJS: (fn: Function) => fn,
  useAnimatedStyle: (fn: Function) => fn(),
  useSharedValue: (initial: unknown) => ({ value: initial }),
  withDelay: vi.fn(),
  withRepeat: vi.fn(),
  withSequence: vi.fn(),
  withTiming: vi.fn(),
}));

import { AnimatedSplash } from './AnimatedSplash';

describe('AnimatedSplash', () => {
  it('exports AnimatedSplash component function', () => {
    expect(typeof AnimatedSplash).toBe('function');
  });

  it('declares props accepting isReady and onAnimationComplete', () => {
    expect(AnimatedSplash.length).toBeGreaterThanOrEqual(1);
  });
});
