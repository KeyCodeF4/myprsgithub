import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInLeft,
  FadeInRight,
  FadeOutLeft,
  FadeOutRight,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import AnimatedStatIcon from './animated-stat-icon';
import { useReduceMotion } from './flip-card';

const INTRO_DARK_FALLBACK = {
  background: '#0D0D0D',
  surface: '#161616',
  surfaceSecondary: '#1F1F1F',
  border: '#262626',
  textPrimary: '#FFFFFF',
  textSecondary: '#9A9A9A',
};

const SLIDES = [
  {
    eyebrow: '1  ·  LOG',
    iconType: 'strength',
    iconLabel: 'Workout logging',
    title: 'Start with one workout.',
    body: 'Tap the plus button, choose what you trained, then record each exercise.',
    tips: [
      'Add your sets, reps and weight',
      'Check the workout summary',
      'Save to create your Daily Wrapped',
    ],
  },
  {
    eyebrow: '2  ·  EXPLORE',
    iconType: 'progress',
    iconLabel: 'Trends graph',
    title: 'Your progress is one swipe away.',
    body: 'After your first workout, swipe up on the home screen to open Trends.',
    tips: [
      'Track strength, volume and frequency',
      'Switch between week, month and year',
      'Swipe down to return to your cards',
    ],
    note: 'Your first card also unlocks your title, ready to stamp onto the card.',
  },
  {
    eyebrow: '3  ·  MENU',
    iconType: 'menu',
    iconLabel: 'App menu',
    title: 'Everything else has one home.',
    body: 'Tap the three dots in the top-right whenever you need the MyPRS menu.',
    tips: [
      'Medals and Your Locker',
      'Challenge a Friend',
      'Account, backup and settings',
    ],
    note: 'Use the plus button whenever you want to log another workout.',
  },
];

export default function IntroSlides({ onComplete }) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const INTRO_DARK = theme.home || INTRO_DARK_FALLBACK;
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const ctaScale = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    ctaScale.value = 1;
    ctaScale.value = withSequence(
      withTiming(1.025, { duration: 120 }),
      withTiming(1, { duration: 180 })
    );
  }, [ctaScale, reduceMotion, step]);

  const ctaStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ctaScale.value }],
  }));

  const goBack = useCallback(() => {
    if (step === 0) return;
    Haptics.selectionAsync();
    setDirection(-1);
    setStep(current => current - 1);
  }, [step]);

  const goForward = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step === SLIDES.length - 1) {
      onComplete();
      return;
    }
    setDirection(1);
    setStep(current => current + 1);
  }, [onComplete, step]);

  const slide = SLIDES[step];
  const compact = width < 390 || height < 720;
  const entering = reduceMotion ? undefined : direction > 0 ? FadeInRight.duration(200) : FadeInLeft.duration(200);
  const exiting = reduceMotion ? undefined : direction > 0 ? FadeOutLeft.duration(160) : FadeOutRight.duration(160);

  return (
    <View
      accessibilityViewIsModal
      style={[
        styles.container,
        {
          backgroundColor: INTRO_DARK.background,
          paddingTop: insets.top + 18,
          paddingBottom: Math.max(insets.bottom, 18),
        },
      ]}
    >
      <View style={styles.topBar}>
        <Text style={[styles.quickStart, { color: INTRO_DARK.textSecondary, fontFamily: theme.font.semiBold }]}>MYPRS QUICK START</Text>
        <Text style={[styles.stepCount, { color: INTRO_DARK.textSecondary, fontFamily: theme.font.semiBold }]}>{step + 1} / {SLIDES.length}</Text>
      </View>

      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`Onboarding step ${step + 1} of ${SLIDES.length}`}
        accessibilityValue={{ min: 1, max: SLIDES.length, now: step + 1 }}
        style={styles.progressRow}
      >
        {SLIDES.map((item, index) => (
          <View
            key={item.eyebrow}
            style={[
              styles.progressSegment,
              { backgroundColor: index <= step ? theme.primary : INTRO_DARK.border },
            ]}
          />
        ))}
      </View>

      <Animated.View
        key={step}
        entering={entering}
        exiting={exiting}
        style={styles.slide}
      >
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.slideContent, { paddingHorizontal: compact ? 24 : 36 }]}
        >
          <Text style={[styles.eyebrow, { color: theme.primary, fontFamily: theme.font.bold }]}>{slide.eyebrow}</Text>
          <View style={[styles.iconFrame, compact && styles.iconFrameCompact, { borderColor: theme.primary, backgroundColor: theme.primary + '12' }]}>
            <AnimatedStatIcon
              type={slide.iconType}
              size={compact ? 58 : 66}
              color={theme.primary}
              accessibilityLabel={slide.iconLabel}
              playKey={step}
            />
          </View>
          <Text style={[styles.title, compact && styles.titleCompact, { color: INTRO_DARK.textPrimary, fontFamily: theme.font.bold }]}>{slide.title}</Text>
          <Text style={[styles.body, compact && styles.bodyCompact, { color: INTRO_DARK.textSecondary, fontFamily: theme.font.regular }]}>{slide.body}</Text>

          <View style={[styles.tipList, { borderColor: INTRO_DARK.border, backgroundColor: INTRO_DARK.surface }]}>
            {slide.tips.map((tip, index) => (
              <View key={tip} style={styles.tipRow}>
                <View style={[styles.tipNumber, { backgroundColor: theme.primary + '20' }]}>
                  <Text style={[styles.tipNumberText, { color: theme.primary, fontFamily: theme.font.bold }]}>{index + 1}</Text>
                </View>
                <Text style={[styles.tipText, { color: INTRO_DARK.textPrimary, fontFamily: theme.font.semiBold }]}>{tip}</Text>
              </View>
            ))}
          </View>

          {slide.note ? (
            <Text style={[styles.note, { color: INTRO_DARK.textSecondary, fontFamily: theme.font.regular }]}>{slide.note}</Text>
          ) : null}
        </ScrollView>
      </Animated.View>

      <View style={styles.navigation}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Previous onboarding page"
          accessibilityState={{ disabled: step === 0 }}
          disabled={step === 0}
          onPress={goBack}
          activeOpacity={0.72}
          style={[
            styles.backButton,
            { borderColor: INTRO_DARK.border, opacity: step === 0 ? 0.3 : 1 },
          ]}
        >
          <Text style={[styles.backLabel, { color: INTRO_DARK.textPrimary, fontFamily: theme.font.semiBold }]}>Back</Text>
        </TouchableOpacity>

        <Animated.View style={[styles.nextWrap, ctaStyle]}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={step === SLIDES.length - 1 ? 'Log my first workout' : 'Next onboarding page'}
            onPress={goForward}
            activeOpacity={0.82}
            style={[styles.nextButton, { backgroundColor: theme.primary }]}
          >
            <Text style={[styles.nextLabel, { fontFamily: theme.font.bold }]}>
              {step === SLIDES.length - 1 ? 'Start workout' : 'Next'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 28, paddingBottom: 12 },
  quickStart: { fontSize: 10, letterSpacing: 1.9 },
  stepCount: { fontSize: 12, fontVariant: ['tabular-nums'] },
  progressRow: { flexDirection: 'row', gap: 7, paddingHorizontal: 28 },
  progressSegment: { flex: 1, height: 4, borderRadius: 999 },
  slide: { flex: 1 },
  slideContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 22 },
  eyebrow: { fontSize: 10, letterSpacing: 2.8, paddingBottom: 16 },
  iconFrame: {
    width: 96,
    height: 96,
    borderRadius: 28,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    boxShadow: '0 10px 36px rgba(230,57,70,0.16)',
  },
  iconFrameCompact: { width: 82, height: 82, borderRadius: 24, marginBottom: 18 },
  title: { maxWidth: 520, fontSize: 29, lineHeight: 35, textAlign: 'center', letterSpacing: -0.8 },
  titleCompact: { fontSize: 25, lineHeight: 30 },
  body: { maxWidth: 520, fontSize: 15, lineHeight: 22, textAlign: 'center', paddingTop: 12 },
  bodyCompact: { fontSize: 14, lineHeight: 20, paddingTop: 9 },
  tipList: {
    width: '100%',
    maxWidth: 500,
    gap: 12,
    borderWidth: 1,
    borderRadius: 20,
    borderCurve: 'continuous',
    padding: 16,
    marginTop: 20,
  },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tipNumber: { width: 25, height: 25, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  tipNumberText: { fontSize: 11, fontVariant: ['tabular-nums'] },
  tipText: { flex: 1, fontSize: 13, lineHeight: 18 },
  note: { maxWidth: 500, fontSize: 12, lineHeight: 18, textAlign: 'center', paddingTop: 14 },
  navigation: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 22 },
  backButton: {
    minWidth: 104,
    height: 54,
    paddingHorizontal: 17,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  backLabel: { fontSize: 15 },
  nextWrap: { flex: 1 },
  nextButton: {
    height: 54,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    boxShadow: '0 9px 28px rgba(230,57,70,0.28)',
  },
  nextLabel: { color: '#080808', fontSize: 15 },
});
