import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Modal, Alert } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, useReducedMotion, withTiming, withSpring, Easing, runOnJS, withSequence, withRepeat } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useSound } from '../context/SoundContext';
import { getCardTier } from '../config/cardTiers';
import { generateFacts } from '../utils/wrappedFacts';
import { captureCardSnapshot, shareSnapshot } from '../utils/cardCapture';
import { reportError } from '../utils/errorReporter';
import AnimatedStatIcon, { getStatIconType } from './animated-stat-icon';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const AUTO_ADVANCE_MS = 4000;
const OUT_MS = 220;
const IN_MS = 280;
const SEGMENT_GAP = 4;

function CountUpNumber({ value, style }) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(0);
  const rafRef = useRef(null);
  const startRef = useRef(null);

  useEffect(() => {
    if (reduceMotion) { setDisplay(value); return; }
    startRef.current = null;
    const duration = 700;
    const animate = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const p = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(value * eased));
      if (p < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value, reduceMotion]);

  return <Text style={style}>{display.toLocaleString()}</Text>;
}

function parseFactValue(text) {
  const match = text.match(/^([\d,.]+)\s*(.*)/);
  if (!match) return { num: 0, suffix: text };
  return { num: parseInt(match[1].replace(/,/g, ''), 10), suffix: match[2] };
}

function FactSlide({ fact, tier, countKey }) {
  if (!fact) return null;
  const p = tier.palette;
  const parsed = parseFactValue(fact.value);

  return (
    <View style={styles.slideContent}>
      <View style={styles.slideIconWrap}><AnimatedStatIcon type={getStatIconType(fact)} size={70} color={p.primary} accessibilityLabel={`${fact.label} icon`} playKey={countKey} /></View>
      <Text style={[styles.slideLabel, { color: p.secondary }]}>{fact.label}</Text>
      <View style={styles.slideValueRow}>
        {parsed.num > 0 ? (
          <CountUpNumber key={countKey} value={parsed.num} style={[styles.slideValue, { color: p.textBright }]} />
        ) : (
          <Text style={[styles.slideValue, { color: p.textBright }]}>{fact.value}</Text>
        )}
        {parsed.suffix ? (
          <Text style={[styles.slideValueSuffix, { color: p.textBright }]}>{parsed.suffix}</Text>
        ) : null}
      </View>
      <Text style={[styles.slideSubtext, { color: p.secondary }]}>{fact.subtext}</Text>
    </View>
  );
}

function FinalShareSlide({ card, strongestFact, tier, typeLabel }) {
  const shareRef = useRef(null);
  const [sharing, setSharing] = useState(false);
  const p = tier.palette;
  const shareWidth = Math.min(SCREEN_W - 32, (SCREEN_H - 190) * 9 / 16, 360);
  const shareHeight = shareWidth * 16 / 9;
  const title = card?.userTitle?.text || card?.userTitle || 'Gym Wrapped';
  const stats = card?.stats || {};
  const unlockedMedals = (card?.medals || []).filter(medal => medal.unlockedAt);
  const achievement = stats.prs > 0
    ? `${stats.prs} PR${stats.prs === 1 ? '' : 's'} smashed`
    : stats.streak > 0
      ? `${stats.streak}-day streak`
      : unlockedMedals.length > 0
        ? `${unlockedMedals.length} medal${unlockedMedals.length === 1 ? '' : 's'} collected`
        : `${stats.totalWorkouts || 1} workout${stats.totalWorkouts === 1 ? '' : 's'} logged`;

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const uri = await captureCardSnapshot(shareRef, 'story');
      await shareSnapshot(uri, 'story');
    } catch (error) {
      reportError(error, 'share-final-wrapped');
      Alert.alert('Share failed', 'We could not create the share image. Please try again.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <View style={styles.finalSlide}>
      <View
        ref={shareRef}
        collapsable={false}
        style={[styles.shareCanvas, { width: shareWidth, height: shareHeight, backgroundColor: p.background, borderColor: p.border }]}
      >
        <View style={[styles.shareGlow, { backgroundColor: p.primary }]} />
        <Text style={[styles.shareBrand, { color: p.primary }]}>MYPRS · GYM WRAPPED</Text>
        <Text style={[styles.shareType, { color: p.secondary }]}>{typeLabel.toUpperCase()} COMPLETE</Text>
        <Text style={styles.shareTitle}>{title}</Text>
        <View style={[styles.shareDivider, { backgroundColor: p.primary }]} />
        <View style={styles.shareIconWrap}><AnimatedStatIcon type={getStatIconType(strongestFact)} size={46} color={p.primary} accessibilityLabel={`${strongestFact?.label || 'Workout'} icon`} /></View>
        <Text style={[styles.shareLabel, { color: p.secondary }]}>{strongestFact?.label || 'WORKOUT COMPLETE'}</Text>
        <Text style={styles.shareValue}>{strongestFact?.value || `${stats.totalWorkouts || 1} workout`}</Text>
        <Text style={[styles.shareComparison, { color: p.secondary }]}>{strongestFact?.subtext || 'Another session in the bank.'}</Text>
        <View style={[styles.achievementPill, { borderColor: p.primary, backgroundColor: `${p.primary}22` }]}>
          <Text style={[styles.achievementText, { color: p.primary }]}>✦ {achievement}</Text>
        </View>
        <Text style={styles.shareFooter}>BUILT, NOT GIVEN · MYPRS</Text>
      </View>
      <TouchableOpacity style={[styles.shareCta, { backgroundColor: p.primary }]} onPress={handleShare} disabled={sharing} activeOpacity={0.75}>
        <Text style={styles.shareCtaText}>{sharing ? 'Preparing…' : 'Share to TikTok / Instagram'}</Text>
      </TouchableOpacity>
      <Text style={styles.shareHint}>Opens your phone’s share sheet</Text>
    </View>
  );
}

const HINT_ARROW_SIZE = 36;

function HintArrows() {
  const reduceMotion = useReducedMotion();
  const arrowOpacity = useSharedValue(0.5);

  useEffect(() => {
    if (reduceMotion) { arrowOpacity.value = 0.5; return; }
    arrowOpacity.value = withSequence(
      withRepeat(withSequence(withTiming(0.85, { duration: 250 }), withTiming(0.35, { duration: 250 })), 2, true),
      withTiming(0.5, { duration: 120 }),
    );
  }, [arrowOpacity, reduceMotion]);

  const arrowStyle = useAnimatedStyle(() => ({
    opacity: arrowOpacity.value,
  }));

  return (
    <>
      <Animated.View style={[styles.hintArrow, styles.hintArrowLeft, arrowStyle]}>
        <Text style={styles.hintArrowText}>◀</Text>
      </Animated.View>
      <Animated.View style={[styles.hintArrow, styles.hintArrowRight, arrowStyle]}>
        <Text style={styles.hintArrowText}>▶</Text>
      </Animated.View>
    </>
  );
}

function ShimmerSweep() {
  const shimmerX = useSharedValue(-Dimensions.get('window').width);

  useEffect(() => {
    shimmerX.value = withTiming(Dimensions.get('window').width, {
      duration: 900,
      easing: Easing.inOut(Easing.ease),
    });
  }, []);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }],
  }));

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        sweepStyle,
        {
          width: Dimensions.get('window').width * 0.45,
          height: '100%',
          backgroundColor: 'rgba(255,255,255,0.07)',
        },
      ]}
      pointerEvents="none"
    />
  );
}

export default function WrappedStoryViewer({ visible, card, onClose, wrappedCards = [], showHints = false }) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { playSound } = useSound();

  const statFacts = useMemo(() => generateFacts(card ? (card.stats || card.headlineStat) : null), [card]);
  const facts = useMemo(() => [...statFacts, { id: 'final-share' }], [statFacts]);
  const tier = getCardTier(card?.level || 1);
  const bg = tier.palette.background;

  const wrappedNumber = card ? (card.cardNumber || wrappedCards.filter(c => c.type === card.type && c.createdAt <= card.createdAt).length) : 0;

  const [factIndex, setFactIndex] = useState(0);
  const [prevFact, setPrevFact] = useState(null);
  const [showPrev, setShowPrev] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);
  const [showShimmer, setShowShimmer] = useState(false);

  const outScale = useSharedValue(1);
  const outOpacity = useSharedValue(1);
  const inScale = useSharedValue(1);
  const inOpacity = useSharedValue(1);
  const entranceScale = useSharedValue(1.3);
  const entranceOpacity = useSharedValue(0);
  const timerRef = useRef(null);

  const currentFact = facts[factIndex];
  const parsed = useMemo(() => parseFactValue(currentFact?.value || ''), [currentFact?.value]);
  const countKey = currentFact ? `${factIndex}-${parsed.num}` : '0-0';

  // Refs to avoid stale closures in worklet callbacks
  const factIndexRef = useRef(factIndex);
  factIndexRef.current = factIndex;
  const transitioningRef = useRef(transitioning);
  transitioningRef.current = transitioning;
  const factsLenRef = useRef(facts.length);
  factsLenRef.current = facts.length;

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (reduceMotion) return;
    timerRef.current = setInterval(() => {
      if (!transitioningRef.current) {
        const next = (factIndexRef.current + 1) % factsLenRef.current;
        goToRef.current(next);
      }
    }, AUTO_ADVANCE_MS);
  }, [reduceMotion]);

  const goTo = useCallback((target) => {
    if (transitioningRef.current) return;
    const len = factsLenRef.current;
    if (len === 0) return;
    const clamped = ((target % len) + len) % len;
    if (clamped === factIndexRef.current) return;
    if (reduceMotion) {
      setFactIndex(clamped);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }

    setTransitioning(true);
    setPrevFact(facts[factIndexRef.current]);
    setShowPrev(true);
    playSound('swoosh');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (timerRef.current) clearInterval(timerRef.current);

    outScale.value = withTiming(1.15, { duration: OUT_MS, easing: Easing.in(Easing.ease) });
    outOpacity.value = withTiming(0, { duration: OUT_MS, easing: Easing.in(Easing.ease) }, (finished) => {
      if (!finished) return;
      inScale.value = 1.1;
      inOpacity.value = 0;
      inScale.value = withSpring(1, { damping: 14, stiffness: 160 });
      inOpacity.value = withTiming(1, { duration: IN_MS, easing: Easing.out(Easing.ease) }, (f2) => {
        if (f2) runOnJS(onInDone)(clamped === len - 1);
      });
      runOnJS(onOutDone)(clamped);
    });
  }, [facts, playSound, reduceMotion]);

  const onOutDone = (idx) => {
    setFactIndex(idx);
    setShowPrev(false);
  };

  const triggerFinalBounce = useCallback(() => {
    inScale.value = withSequence(
      withSpring(1.08, { damping: 8, stiffness: 100 }),
      withSpring(1, { damping: 12, stiffness: 150 }),
    );
  }, []);

  const onInDone = (isLastSlide) => {
    setTransitioning(false);
    outScale.value = 1;
    outOpacity.value = 1;
    if (isLastSlide) triggerFinalBounce();
    else startTimer();
  };

  // Ref-based callers for timer
  const goToRef = useRef(goTo);
  goToRef.current = goTo;

  const goNext = useCallback(() => goTo(factIndex + 1), [goTo, factIndex]);
  const goBack = useCallback(() => goTo(factIndex - 1), [goTo, factIndex]);

  // Entrance animation on first reveal of this card
  useEffect(() => {
    if (!visible) return;
    setHasEntered(false);
    setShowShimmer(false);
    setFactIndex(0);
    setPrevFact(null);
    setShowPrev(false);
    setTransitioning(false);
    outScale.value = 1;
    outOpacity.value = 1;
    inScale.value = 1;
    inOpacity.value = 1;
    entranceScale.value = reduceMotion ? 1 : 1.3;
    entranceOpacity.value = reduceMotion ? 1 : 0;

    // Entrance spring
    entranceScale.value = reduceMotion ? 1 : withSpring(1, { damping: 11, stiffness: 130 });
    entranceOpacity.value = withTiming(1, { duration: reduceMotion ? 0 : 250 }, (f) => {
      if (f) runOnJS(onEntranceDone)();
    });
    startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [visible, card, reduceMotion, startTimer]);

  const onEntranceDone = useCallback(() => {
    setHasEntered(true);
    setShowShimmer(true);
    // Trigger final bounce if the only fact is also the last
    if (facts.length === 1) triggerFinalBounce();
  }, [facts.length]);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const typeLabel = card?.type === 'daily' ? 'Daily' : card?.type === 'weekly' ? 'Weekly' : 'Monthly';

  const outAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: outScale.value }],
    opacity: outOpacity.value,
  }));

  const inAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: inScale.value }],
    opacity: inOpacity.value,
  }));

  const entranceAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: entranceScale.value }],
    opacity: entranceOpacity.value,
  }));

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: bg }]}>
        {/* Progress bar */}
        <View style={[styles.progressRow, { paddingTop: insets.top + 16 }]}>
          {facts.map((f, i) => (
            <View key={f.id} style={[styles.progressSegment, { width: (SCREEN_W - 32 - (facts.length - 1) * SEGMENT_GAP) / facts.length }]}>
              <View style={[styles.progressFill, { backgroundColor: i <= factIndex ? '#FFF' : 'rgba(255,255,255,0.25)' }]} />
            </View>
          ))}
        </View>

        {/* Close button */}
        <TouchableOpacity style={[styles.closeBtn, { top: insets.top + 16 }]} onPress={onClose} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Close Wrapped story">
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>

        {/* Slide area */}
        <View style={styles.slideArea}>
          {/* Entrance scale-bounce overlay (first reveal only) */}
          {!hasEntered && (
            <Animated.View style={[styles.slideLayer, entranceAnimatedStyle]}>
              {currentFact?.id === 'final-share'
                ? <FinalShareSlide card={card} strongestFact={statFacts[0]} tier={tier} typeLabel={typeLabel} />
                : <FactSlide fact={currentFact} tier={tier} countKey={countKey} />}
            </Animated.View>
          )}

          {/* Shimmer sweep on first reveal */}
          {showShimmer && <ShimmerSweep />}

          {hasEntered && (
            <>
              {showPrev && prevFact && (
                <Animated.View style={[styles.slideLayer, outAnimatedStyle]}>
                  {prevFact?.id === 'final-share'
                    ? <FinalShareSlide card={card} strongestFact={statFacts[0]} tier={tier} typeLabel={typeLabel} />
                    : <FactSlide fact={prevFact} tier={tier} countKey={`prev-${factIndex}`} />}
                </Animated.View>
              )}
              <Animated.View style={[styles.slideLayer, inAnimatedStyle]}>
                {currentFact?.id === 'final-share'
                  ? <FinalShareSlide card={card} strongestFact={statFacts[0]} tier={tier} typeLabel={typeLabel} />
                  : <FactSlide fact={currentFact} tier={tier} countKey={countKey} />}
              </Animated.View>
            </>
          )}

          {/* Hint arrows (first wrapped only) */}
          {showHints && hasEntered && (
            <>
              <View style={styles.hintArrowsContainer} pointerEvents="none">
                <HintArrows />
              </View>
            </>
          )}
        </View>

        {/* Tap zones — only outer 30% each side, leaves center free for buttons */}
        <View style={styles.tapZoneRow}>
          <TouchableOpacity style={styles.tapEdge} onPress={goBack} activeOpacity={1} accessibilityRole="button" accessibilityLabel="Previous Wrapped page" />
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={styles.tapEdge} onPress={goNext} activeOpacity={1} accessibilityRole="button" accessibilityLabel="Next Wrapped page" />
        </View>

        {/* Bottom info */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 24 }]}>
          <Text style={styles.bottomType}>{typeLabel} Wrapped</Text>
          <Text style={styles.bottomNum}>#{wrappedNumber} · {statFacts.length} facts + share card</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  progressRow: {
    flexDirection: 'row', gap: SEGMENT_GAP,
    paddingHorizontal: 16, zIndex: 10,
  },
  progressSegment: { height: 3, borderRadius: 2, overflow: 'hidden' },
  progressFill: { flex: 1, borderRadius: 2 },
  closeBtn: {
    position: 'absolute', right: 16, zIndex: 20,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },
  closeBtnText: { color: '#FFF', fontSize: 16, fontFamily: 'Inter_700Bold' },
  slideArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  slideLayer: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  slideContent: { alignItems: 'center', paddingHorizontal: 40 },
  slideIconWrap: { marginBottom: 20, alignItems: 'center', justifyContent: 'center' },
  slideLabel: { fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', fontFamily: 'Inter_600SemiBold', marginBottom: 12, textAlign: 'center' },
  slideValueRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', justifyContent: 'center' },
  slideValue: { fontSize: 48, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  slideValueSuffix: { fontSize: 24, fontFamily: 'Inter_700Bold', marginLeft: 6 },
  slideSubtext: { fontSize: 15, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 16, lineHeight: 22, paddingHorizontal: 20 },
  tapZoneRow: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 80,
    flexDirection: 'row',
  },
  tapEdge: { width: '30%' },
  bottomBar: {
    alignItems: 'center', paddingTop: 16, paddingHorizontal: 20,
  },
  bottomType: { color: 'rgba(255,255,255,0.6)', fontSize: 11, letterSpacing: 2, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', marginBottom: 4 },
  bottomNum: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontFamily: 'Inter_400Regular' },
  hintArrowsContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
  },
  hintArrow: {
    position: 'absolute',
    top: '45%',
    width: HINT_ARROW_SIZE,
    height: HINT_ARROW_SIZE,
    borderRadius: HINT_ARROW_SIZE / 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hintArrowLeft: { left: 12 },
  hintArrowRight: { right: 12 },
  hintArrowText: { color: '#FFF', fontSize: 14 },
  finalSlide: { flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%', paddingTop: 20 },
  shareCanvas: { borderWidth: 1.5, borderRadius: 24, overflow: 'hidden', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 28 },
  shareGlow: { position: 'absolute', width: 240, height: 240, borderRadius: 120, opacity: 0.13, top: -110, right: -80 },
  shareBrand: { fontSize: 10, letterSpacing: 2.6, fontFamily: 'Inter_700Bold' },
  shareType: { fontSize: 9, letterSpacing: 2, fontFamily: 'Inter_600SemiBold', marginTop: 18 },
  shareTitle: { color: '#FFF', fontSize: 25, lineHeight: 30, fontFamily: 'Inter_700Bold', textAlign: 'center', marginTop: 8 },
  shareDivider: { width: 38, height: 3, borderRadius: 2, marginTop: 18 },
  shareIconWrap: { marginTop: 24, alignItems: 'center', justifyContent: 'center' },
  shareLabel: { fontSize: 10, letterSpacing: 1.8, fontFamily: 'Inter_600SemiBold', marginTop: 12, textAlign: 'center' },
  shareValue: { color: '#FFF', fontSize: 35, fontFamily: 'Inter_700Bold', textAlign: 'center', marginTop: 5 },
  shareComparison: { fontSize: 13, lineHeight: 19, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 10 },
  achievementPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 15, paddingVertical: 8, marginTop: 20 },
  achievementText: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.4 },
  shareFooter: { position: 'absolute', bottom: 22, color: 'rgba(255,255,255,0.45)', fontSize: 8, letterSpacing: 1.8, fontFamily: 'Inter_600SemiBold' },
  shareCta: { marginTop: 12, paddingHorizontal: 24, paddingVertical: 13, borderRadius: 14, minWidth: 260, alignItems: 'center', zIndex: 50 },
  shareCtaText: { color: '#FFF', fontSize: 14, fontFamily: 'Inter_700Bold' },
  shareHint: { color: 'rgba(255,255,255,0.45)', fontSize: 10, marginTop: 6, fontFamily: 'Inter_400Regular' },
});
