import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Alert, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { useSound } from '../context/SoundContext';
import { generateFacts } from '../utils/wrappedFacts';
import { getCardTier } from '../config/cardTiers';
import { captureCardSnapshot, shareSnapshot, SHARE_FORMATS } from '../utils/cardCapture';
import { reportError } from '../utils/errorReporter';
import { getFactDeltaForSwipe, getFactDeltaForTap } from '../utils/summary-navigation';
import { resolveEquippedMedals, MAX_EQUIPPED_MEDALS } from '../utils/equippedMedals';
import {
  ShimmerBorder,
  GlowPulse,
  CornerAccents,
  ParticleEffect,
  AnimatedBorder,
  AnimatedBackground,
  ParticleBurst,
} from './CardEffects';
import AnimatedMedalRing from './animated-medal-ring';
import AnimatedStatIcon, { getStatIconType } from './animated-stat-icon';

function AnimatedCardTitle({ title, shineColor, level = 1 }) {
  const shimmer = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    shimmer.value = reduceMotion ? 0.3 : withRepeat(
      withSequence(
        withTiming(1, { duration: 900 }),
        withTiming(0, { duration: 900 })
      ),
      2,
      true
    );
  }, [shimmer, reduceMotion]);

  const shineStyle = useAnimatedStyle(() => ({
    opacity: 0.18 + shimmer.value * Math.min(0.7, 0.35 + level * 0.008),
    transform: [{ scale: 1 + shimmer.value * 0.025 }],
    textShadowRadius: 3 + shimmer.value * Math.min(14, 5 + level * 0.12),
  }));

  return (
    <View style={styles.animatedTitleWrap}>
      <Text
        style={[styles.userTitle, styles.userTitleBase]}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.72}
        maxFontSizeMultiplier={1.15}
      >
        {title}
      </Text>
      <Animated.Text
        style={[styles.userTitle, styles.userTitleShine, { color: shineColor, textShadowColor: shineColor }, shineStyle]}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.72}
        maxFontSizeMultiplier={1.15}
      >
        {title}
      </Animated.Text>
    </View>
  );
}

export default function ShareableWrappedCard({ stats, wrappedCount, cardNumber, level, medals = [], onSave, variant = 'full', onCardPress, userTitle, heroWidth, headlineFactId = null }) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const theme = useTheme();
  const { playSound } = useSound();
  const isHero = variant === 'hero';
  const tier = getCardTier(level || 1);
  const p = useMemo(() => ({ ...tier.palette, primary: theme.primary, accent: theme.primary }), [tier, theme.primary]);
  // Must recompute when stats change, not just on mount — the deck's front card
  // keeps the same React instance (same card id) when today's wrapped is appended
  // to, so a ref-cached value here would keep showing stale numbers after "+".
  // headlineFactId is snapshotted on the card so an existing Wrapped keeps
  // leading with the fact it was generated with; cards created before this
  // existed just fall back to the deterministic ranking.
  const facts = useMemo(() => generateFacts(stats, headlineFactId), [stats, headlineFactId]);
  // Callers pass the LIVE equipped medals so equipping updates every card at once.
  // Resolving here as well keeps the component safe if it is ever handed raw
  // stored state (which carries no icon/tier) or a legacy/removed medal id.
  const pinnedMedals = useMemo(() => resolveEquippedMedals(medals), [medals]);
  const founderMedal = useMemo(
    () => pinnedMedals.find(medal => medal.tier === 'founder' && medal.serialNumber),
    [pinnedMedals]
  );
  const medalSlots = useMemo(() => {
    const filled = pinnedMedals.slice(0, MAX_EQUIPPED_MEDALS);
    while (filled.length < MAX_EQUIPPED_MEDALS) filled.push(null);
    return filled;
  }, [pinnedMedals]);
  const [factIndex, setFactIndex] = useState(0);
  const fadeAnim = useSharedValue(1);
  const cardRef = useRef(null);
  const timerRef = useRef(null);
  const [sharing, setSharing] = useState(false);
  const [showFormatPicker, setShowFormatPicker] = useState(false);
  const [burstDone, setBurstDone] = useState(false);
  const [celebrated, setCelebrated] = useState(false);

  useEffect(() => {
    if (isHero && !celebrated) {
      setCelebrated(true);
      playSound('celebrate');
    }
  }, [isHero, celebrated, playSound]);

  // HomeScreen measures the available 9:16 deck area. Respect that measured
  // width instead of letting the hero card overflow its animated wrapper on
  // short/wide screens.
  const fullCardWidth = Math.min(screenWidth - 48, 320);
  const heroCardWidth = Math.min(screenWidth - 32, 380);
  const CARD_W = isHero ? (heroWidth || heroCardWidth) : fullCardWidth;
  const CARD_H = isHero ? Math.min(screenHeight * 0.55, 480) : fullCardWidth * 16 / 9;
  const typeScale = Math.max(0.72, Math.min(1, CARD_W / 320));
  const currentFact = facts[factIndex % facts.length];

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fadeAnim.value }));

  const cycleTo = useCallback((idx) => {
    playSound('swoosh');
    fadeAnim.value = withTiming(0, { duration: reduceMotion ? 0 : 120 }, finished => {
      if (!finished) return;
      runOnJS(setFactIndex)(idx);
      fadeAnim.value = withTiming(1, { duration: reduceMotion ? 0 : 200 });
    });
  }, [fadeAnim, playSound, reduceMotion]);

  const cycleFact = useCallback((dir = 1) => {
    cycleTo((factIndex + dir + facts.length) % facts.length);
  }, [factIndex, facts.length, cycleTo]);

  const summarySwipe = useMemo(() => Gesture.Pan()
    .activeOffsetX([-18, 18])
    .failOffsetY([-18, 18])
    .onEnd(event => {
      const delta = getFactDeltaForSwipe(event.translationX);
      if (delta) runOnJS(cycleFact)(delta);
    }), [cycleFact]);

  useEffect(() => {
    if (isHero || reduceMotion) return;
    timerRef.current = setInterval(() => cycleFact(1), 3000);
    return () => clearInterval(timerRef.current);
  }, [cycleFact, isHero, reduceMotion]);

  const handleTapFact = (evt) => {
    if (isHero) return;
    clearInterval(timerRef.current);
    const x = evt.nativeEvent.locationX;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Conventional story controls: left goes back, right advances.
    cycleFact(getFactDeltaForTap(x, CARD_W));
    timerRef.current = setInterval(() => cycleFact(1), 3000);
  };

  const handleShare = async (formatKey) => {
    if (sharing) return;
    setSharing(true);
    setShowFormatPicker(false);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const uri = await captureCardSnapshot(cardRef, formatKey);
      await shareSnapshot(uri, formatKey);
    } catch (e) {
      reportError(e, 'share-wrapped-card', { format: formatKey });
      Alert.alert('Share failed', 'We could not open the share sheet. Please try again.');
    } finally {
      setSharing(false);
    }
  };

  const handleSharePress = () => {
    setShowFormatPicker(true);
  };

  return (
    <View style={isHero ? styles.containerHero : styles.container}>
      {!isHero && (
        <View style={styles.heading}>
          <Text style={[styles.headingTitle, { color: '#E63946', fontFamily: theme.font.bold }]}>Your Daily Wrapped</Text>
          <Text style={[styles.headingSub, { color: theme.textSecondary, fontFamily: theme.font.regular }]}>Tap the card to cycle facts</Text>
        </View>
      )}

      <TouchableOpacity
        activeOpacity={isHero ? 0.85 : 1}
        onPress={isHero ? onCardPress : undefined}
        style={isHero ? { flex: 1 } : undefined}
      >
        <View
          collapsable={false}
          ref={cardRef}
          style={[
            styles.card,
            isHero ? styles.cardHero : {},
            {
              width: CARD_W,
              ...(isHero ? { flex: 1 } : { height: CARD_H }),
              borderRadius: tier.frame.borderRadius,
              borderWidth: tier.frame.borderWidth,
              borderColor: p.border,
              backgroundColor: p.background,
            },
          ]}
        >
          <AnimatedBackground tier={tier} />
          <AnimatedBorder tier={tier} />
          <ParticleEffect tier={tier} />
          {!burstDone && (
            <ParticleBurst tier={tier} cardWidth={CARD_W} cardHeight={CARD_H} onComplete={() => setBurstDone(true)} />
          )}

          <View style={[StyleSheet.absoluteFill, { padding: Math.max(14, Math.round(20 * typeScale)) }]}>
            <ShimmerBorder tier={tier} cardWidth={CARD_W} cardHeight={CARD_H} />
            {tier.frame.cornerAccents && <CornerAccents tier={tier} cardWidth={CARD_W} cardHeight={CARD_H} />}

            <View style={styles.header}>
              <Text style={[styles.badge, { color: p.primary, fontSize: 11 * typeScale }]} numberOfLines={1}>MyPRS</Text>
              <View style={styles.medalRow}>
                {medalSlots.map((m, i) => {
                  if (!m) return <View key={`slot-${i}`} style={styles.medalSlot} />;
                  return <AnimatedMedalRing key={m.id} medal={m} phase={i * 120} />;
                })}
              </View>
            </View>

            {founderMedal && (
              <View style={styles.founderStamp}>
                <Text style={styles.founderStampText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>
                  GENESIS FOUNDER #{String(founderMedal.serialNumber).padStart(3, '0')} / 100
                </Text>
              </View>
            )}

            {userTitle && (
              <View style={styles.titleRow}>
                <AnimatedCardTitle title={userTitle?.text || userTitle} shineColor={p.primary} level={level} />
              </View>
            )}

            <View style={[styles.divider, { backgroundColor: p.surface }]} />

            {!isHero && tier.name !== 'Starter' && (
              <View style={styles.tierArea}>
                {tier.effects.glowPulse && <GlowPulse tier={tier} size={120} />}
                <View style={[styles.tierBadge, { backgroundColor: p.primary + '15', borderColor: p.primary }]}>
                  <Text style={[styles.tierText, { color: p.primary }]}>{tier.name.toUpperCase()}</Text>
                </View>
              </View>
            )}

            {isHero ? (
              <View style={styles.factArea}>
                <Animated.View style={[{ alignItems: 'center', width: '100%', paddingHorizontal: 10 }, fadeStyle]}>
                  <View style={styles.factIconWrap}><AnimatedStatIcon type={getStatIconType(currentFact)} size={52 * typeScale} color={p.primary} accessibilityLabel={`${currentFact.label} icon`} playKey={`${currentFact.id}-${factIndex}`} /></View>
                  <Text
                    style={[styles.factLabel, { color: p.text, fontSize: 12 * typeScale }]}
                    numberOfLines={2}
                    adjustsFontSizeToFit
                    minimumFontScale={0.78}
                  >
                    {currentFact.label}
                  </Text>
                  <Text
                    style={[styles.factValue, { color: p.textBright, fontSize: 28 * typeScale }]}
                    numberOfLines={2}
                    adjustsFontSizeToFit
                    minimumFontScale={0.58}
                    maxFontSizeMultiplier={1.1}
                  >
                    {currentFact.value}
                  </Text>
                  <Text
                    style={[styles.factSubtext, { color: p.secondary, fontSize: 13 * typeScale }]}
                    numberOfLines={4}
                    adjustsFontSizeToFit
                    minimumFontScale={0.76}
                  >
                    {currentFact.subtext}
                  </Text>
                </Animated.View>
              </View>
            ) : (
              <GestureDetector gesture={summarySwipe}>
                <TouchableOpacity style={styles.factArea} onPress={handleTapFact} activeOpacity={1}>
                  <Animated.View style={[{ alignItems: 'center', width: '100%', paddingHorizontal: 10 }, fadeStyle]}>
                    <View style={styles.factIconWrap}><AnimatedStatIcon type={getStatIconType(currentFact)} size={52 * typeScale} color={p.primary} accessibilityLabel={`${currentFact.label} icon`} playKey={`${currentFact.id}-${factIndex}`} /></View>
                    <Text style={[styles.factLabel, { color: p.text, fontSize: 12 * typeScale }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.78}>{currentFact.label}</Text>
                    <Text style={[styles.factValue, { color: p.textBright, fontSize: 28 * typeScale }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.58} maxFontSizeMultiplier={1.1}>{currentFact.value}</Text>
                    <Text style={[styles.factSubtext, { color: p.secondary, fontSize: 13 * typeScale }]} numberOfLines={4} adjustsFontSizeToFit minimumFontScale={0.72}>{currentFact.subtext}</Text>
                  </Animated.View>
                </TouchableOpacity>
              </GestureDetector>
            )}

            {!isHero && (
              <View style={styles.dots}>
                {facts.map((f, i) => (
                  <View key={f.id} style={[styles.dot, { backgroundColor: i === factIndex ? p.primary : p.surface }]} />
                ))}
              </View>
            )}

            {!isHero && (
              <View style={styles.footer}>
                <Text style={[styles.footerNum, { color: p.primary }]}>#{cardNumber || wrappedCount + 1}</Text>
                <Text style={[styles.footerText, { color: p.secondary }]}>myprs</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>

      {!isHero && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: p.primary, borderRadius: 14, paddingVertical: 16, flex: 1, marginRight: 8 }]}
            onPress={onSave}
            activeOpacity={0.7}
          >
            <Text style={[styles.actionBtnText, { color: '#000', fontFamily: theme.font.bold }]}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#1A1A1A', borderRadius: 14, paddingVertical: 16, borderWidth: 1, borderColor: p.primary, flex: 1, marginLeft: 8 }]}
            onPress={handleSharePress}
            activeOpacity={0.7}
            disabled={sharing}
          >
            <Text style={[styles.actionBtnText, { color: p.primary, fontFamily: theme.font.bold }]}>{sharing ? '...' : 'Share'}</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={showFormatPicker} animationType="fade" transparent onRequestClose={() => setShowFormatPicker(false)}>
        <TouchableOpacity style={styles.formatOverlay} activeOpacity={1} onPress={() => setShowFormatPicker(false)}>
          <View style={[styles.formatSheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.formatTitle, { color: theme.textSecondary, fontFamily: theme.font.bold }]}>SHARE AS</Text>
            {Object.values(SHARE_FORMATS).map(fmt => (
              <TouchableOpacity
                key={fmt.key}
                style={styles.formatRow}
                onPress={() => handleShare(fmt.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.formatLabel, { color: theme.textPrimary, fontFamily: theme.font.semiBold }]}>{fmt.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.formatCancel} onPress={() => setShowFormatPicker(false)} activeOpacity={0.7}>
              <Text style={[styles.formatCancelText, { color: theme.textSecondary, fontFamily: theme.font.semiBold }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 8,
    alignItems: 'center',
  },
  containerHero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
    width: '100%',
  },
  heading: {
    alignItems: 'center',
    marginBottom: 20,
  },
  headingTitle: {
    fontSize: 22,
  },
  headingSub: {
    fontSize: 13,
    marginTop: 4,
  },
  card: {
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  cardHero: {
    minHeight: 200,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    fontSize: 11,
    letterSpacing: 3,
    fontFamily: 'Inter_700Bold',
  },
  userTitle: {
    width: '100%',
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
    letterSpacing: 0.8,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  titleRow: { width: '100%', paddingTop: 8, paddingHorizontal: 2 },
  animatedTitleWrap: { width: '100%', alignItems: 'center', justifyContent: 'center', minHeight: 38 },
  userTitleBase: { color: '#FFFFFF' },
  userTitleShine: { position: 'absolute', left: 0, right: 0 },
  medalRow: {
    flexDirection: 'row',
    gap: 4,
    position: 'relative',
    alignItems: 'center',
  },
  medalSlot: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1, borderColor: '#333',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  founderStamp: {
    alignSelf: 'flex-end',
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#74F8FF66',
    backgroundColor: '#74F8FF10',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  founderStampText: {
    color: '#BDFBFF',
    fontSize: 6.5,
    letterSpacing: 1.05,
    fontFamily: 'Inter_700Bold',
  },
  divider: {
    height: 1,
    marginVertical: 10,
  },
  tierArea: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  tierBadge: {
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  tierText: {
    fontSize: 11,
    letterSpacing: 2,
    fontFamily: 'Inter_700Bold',
  },
  factArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  factIconWrap: { marginBottom: 10, alignItems: 'center', justifyContent: 'center' },
  factLabel: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  factValue: {
    fontSize: 28,
    fontFamily: 'Inter_900Black',
    textAlign: 'center',
  },
  factSubtext: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginTop: 6,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerNum: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  footerText: {
    fontSize: 10,
    letterSpacing: 2,
    fontFamily: 'Inter_400Regular',
    textTransform: 'uppercase',
  },
  actions: {
    flexDirection: 'row',
    marginTop: 24,
    width: '100%',
    maxWidth: 320,
  },
  actionBtn: {
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 16,
  },
  formatOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  formatSheet: {
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  formatTitle: {
    fontSize: 11,
    letterSpacing: 3,
    marginBottom: 16,
    textAlign: 'center',
  },
  formatRow: {
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
    alignItems: 'center',
  },
  formatLabel: {
    fontSize: 17,
  },
  formatCancel: {
    paddingVertical: 16,
    marginTop: 8,
    alignItems: 'center',
  },
  formatCancelText: {
    fontSize: 15,
  },
});
