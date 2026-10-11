import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

const MIN_DISPLAY_MS = 900;

function BenchPressLogo() {
  const reduceMotion = useReducedMotion();
  const rep = useSharedValue(reduceMotion ? 0.45 : 0);

  useEffect(() => {
    if (!reduceMotion) {
      rep.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 430, easing: Easing.inOut(Easing.cubic) }),
          withTiming(0, { duration: 430, easing: Easing.inOut(Easing.cubic) })
        ),
        -1,
        false
      );
    }
    return () => cancelAnimation(rep);
  }, [reduceMotion, rep]);

  const barStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(rep.value, [0, 1], [0, 32]) }],
  }));
  const highArmsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(rep.value, [0, 0.42, 0.75], [1, 0.65, 0], 'clamp'),
  }));
  const lowArmsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(rep.value, [0.25, 0.62, 1], [0, 0.7, 1], 'clamp'),
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(rep.value, [0, 1], [0.18, 0.48]),
    transform: [{ scaleX: interpolate(rep.value, [0, 1], [0.82, 1]) }],
  }));

  return (
    <View style={styles.lifterStage} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.logoGlow, glowStyle]} />

      <Svg width="100%" height="100%" viewBox="0 0 300 220" style={StyleSheet.absoluteFill}>
        <Line x1="58" y1="174" x2="238" y2="174" stroke="#343434" strokeWidth="8" strokeLinecap="round" />
        <Line x1="82" y1="174" x2="82" y2="204" stroke="#343434" strokeWidth="7" strokeLinecap="round" />
        <Line x1="220" y1="174" x2="220" y2="204" stroke="#343434" strokeWidth="7" strokeLinecap="round" />
        <Circle cx="224" cy="145" r="13" fill="#171717" stroke="#F7F7F7" strokeWidth="4" />
        <Path d="M207 151 L117 151 L86 166" fill="none" stroke="#F7F7F7" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M117 151 L82 184 L54 187 M82 184 L65 206" fill="none" stroke="#F7F7F7" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx="54" cy="187" r="5" fill="#E63946" />
        <Circle cx="65" cy="206" r="5" fill="#E63946" />
      </Svg>

      <Animated.View style={[StyleSheet.absoluteFill, highArmsStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 300 220">
          <Path d="M132 150 L119 103 L108 62 M179 150 L184 103 L192 62" fill="none" stroke="#F7F7F7" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx="108" cy="62" r="5" fill="#E63946" />
          <Circle cx="192" cy="62" r="5" fill="#E63946" />
        </Svg>
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, lowArmsStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 300 220">
          <Path d="M132 150 L105 123 L108 94 M179 150 L195 123 L192 94" fill="none" stroke="#F7F7F7" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx="108" cy="94" r="5" fill="#E63946" />
          <Circle cx="192" cy="94" r="5" fill="#E63946" />
        </Svg>
      </Animated.View>

      <Animated.View style={[styles.logoBar, barStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 280 64" style={StyleSheet.absoluteFill}>
          <Line x1="10" y1="32" x2="270" y2="32" stroke="#F7F7F7" strokeWidth="4" strokeLinecap="round" />
          <Rect x="12" y="15" width="9" height="34" rx="3" fill="#E63946" />
          <Rect x="24" y="10" width="11" height="44" rx="3" fill="#FF5264" />
          <Rect x="245" y="10" width="11" height="44" rx="3" fill="#FF5264" />
          <Rect x="259" y="15" width="9" height="34" rx="3" fill="#E63946" />
          <Rect x="64" y="4" width="152" height="56" rx="16" fill="#111111" stroke="#E63946" strokeWidth="3" />
        </Svg>
        <Text style={styles.logoWordmark}>MyPRS</Text>
      </Animated.View>
    </View>
  );
}

export default function AppLaunchScreen({ ready, children }) {
  const [visible, setVisible] = useState(true);
  const mountedAt = useRef(Date.now());
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (typeof SplashScreen.hideAsync === 'function') {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!ready || !visible) return undefined;
    const remaining = Math.max(0, MIN_DISPLAY_MS - (Date.now() - mountedAt.current));
    const timer = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) }, finished => {
        if (finished) runOnJS(setVisible)(false);
      });
    }, remaining);
    return () => clearTimeout(timer);
  }, [opacity, ready, visible]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View style={styles.root}>
      <View
        style={styles.root}
        aria-hidden={visible}
        accessibilityElementsHidden={visible}
        importantForAccessibility={visible ? 'no-hide-descendants' : 'yes'}
      >
        {children}
      </View>
      {visible && (
        <Animated.View
          accessibilityRole="progressbar"
          accessibilityLabel="Loading MyPRS"
          style={[styles.overlay, fadeStyle]}
        >
          <BenchPressLogo />
          <Text style={styles.loadingLabel}>LOADING YOUR PRS</Text>
          <View style={styles.loadingLine} />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    backgroundColor: '#0D0D0D',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  lifterStage: {
    width: '100%',
    maxWidth: 360,
    aspectRatio: 300 / 220,
  },
  logoGlow: {
    position: 'absolute',
    top: '17%',
    left: '22%',
    right: '22%',
    height: 58,
    borderRadius: 29,
    backgroundColor: '#E63946',
    boxShadow: '0 0 34px rgba(230,57,70,0.65)',
  },
  logoBar: {
    position: 'absolute',
    top: '13%',
    left: '11%',
    width: '78%',
    aspectRatio: 280 / 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWordmark: {
    color: '#FFFFFF',
    fontFamily: 'Inter_900Black',
    fontSize: 27,
    letterSpacing: -1,
  },
  loadingLabel: {
    color: '#747474',
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 3.2,
    marginTop: 12,
  },
  loadingLine: {
    width: 34,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#E63946',
    marginTop: 14,
  },
});
