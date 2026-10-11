import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Dimensions, ScrollView, Alert, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, withRepeat, withSequence, runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useSound } from '../context/SoundContext';
import { useWorkouts } from '../context/WorkoutContext';
import { calculateStreak } from '../utils/calculations';
import { getCardTier } from '../config/cardTiers';
import { pluralize } from '../utils/pluralize';
import {
  getHasSeenFirstWrappedHints,
  getReminderSettings,
  getTrendsIntroSeen,
  saveReminderSettings,
  setHasSeenFirstWrappedHints,
  setTrendsIntroSeen,
} from '../utils/storage';
import { registerForPushNotifications, scheduleDailyLogNudge, cancelDailyLogNudge } from '../utils/notificationScheduler';
import { toLocalDateKey } from '../utils/dateUtils';
import { reportError } from '../utils/errorReporter';
import ShareableWrappedCard from './ShareableWrappedCard';
import TitleEarnModal from './TitleEarnModal';
import DevPanel from './DevPanel';
import CustomizationLocker from './customization-locker';
import AccountScreen from './account-screen';
import SpreadDeckItem from './spread-deck-item';
import FlipCard, { flipTo, useReduceMotion } from './flip-card';
import WrappedCardBack from './wrapped-card-back';
import TitleStampCeremony from './title-stamp-ceremony';
import TrendsScreen from './trends-screen';
import FriendChallengeModal from './friend-challenge-modal';
import AnimatedStatIcon from './animated-stat-icon';
import { TESTING_TOOLS_ENABLED } from '../config/testing';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
// The card is a 9:16 portrait rectangle, but it also has to fit underneath the top
// bar + streak/XP status bar and above the FAB — sizing purely from width (as before)
// let it grow taller than the space actually available, causing it to overlap the
// status bar above it. Pick whichever of the width or height budget is tighter.
const CARD_MAX_W = Math.min(SCREEN_W - 32, 380);
// Static fallback used for the very first frame before the deck area is measured.
const CARD_MAX_H = SCREEN_H - 320;
const PH_W = Math.min(CARD_MAX_W, CARD_MAX_H * 9 / 16);
const PH_H = PH_W * 16 / 9;

// Fit a 9:16 portrait card inside the *measured* deck area rather than a fixed
// screen-height guess — the guess made the card too narrow on small phones and
// risked overlap on others. Cap width so it never gets absurdly wide on tablets.
function fitCard(availW, availH) {
  const maxW = Math.min(availW, CARD_MAX_W);
  const maxH = availH - 44; // leave room for the "N / M" position indicator below the deck
  let w = maxW;
  let h = w * 16 / 9;
  if (h > maxH) { h = maxH; w = h * 9 / 16; }
  return { w: Math.round(w), h: Math.round(h) };
}

const DECK_STACK_OFFSET = 16;
const DECK_STACK_SCALE = 0.03;
const DECK_MAX_VISIBLE = 4;
const DECK_SWIPE_THRESHOLD = 64;
const DECK_SWIPE_DISTANCE = 150;
const DECK_MAX_CARDS_PER_SWIPE = 4;
const DECK_VELOCITY_PROJECTION = 1600;
const DECK_SPREAD_GAP = 48;
const DECK_RENDER_BEHIND = 5;

// The wrapped cards themselves are dark/black-themed — a near-white main screen
// (theme.background) clashed with them. This screen uses its own dark palette
// instead of the shared light theme.* colors.
const DARK_FALLBACK = {
  background: '#0D0D0D',
  surface: '#161616',
  surfaceSecondary: '#1F1F1F',
  border: '#262626',
  separator: '#232323',
  textPrimary: '#FFFFFF',
  textSecondary: '#9A9A9A',
  textTertiary: '#5C5C5C',
};

function PlaceholderCard({ width, height, theme, onPress }) {
  const reduceMotion = useReduceMotion();
  const glowAnim = useSharedValue(0.3);
  const textAnim = useSharedValue(0.3);
  const scaleAnim = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const typeScale = Math.max(0.68, Math.min(1, width / 300));

  useEffect(() => {
    if (reduceMotion) {
      glowAnim.value = 0.55;
      textAnim.value = 0.85;
      scaleAnim.value = 1;
      return;
    }
    glowAnim.value = withRepeat(
      withSequence(
        withTiming(0.75, { duration: 300 }),
        withTiming(0.3, { duration: 300 })
      ),
      2
    );
    textAnim.value = withRepeat(
      withSequence(
        withTiming(0.85, { duration: 300 }),
        withTiming(0.3, { duration: 300 })
      ),
      2
    );
    scaleAnim.value = withRepeat(
      withSequence(
        withTiming(1.02, { duration: 300 }),
        withTiming(1, { duration: 300 })
      ),
      2
    );
  }, [reduceMotion, glowAnim, textAnim, scaleAnim]);

  const glowStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(230,57,70,${glowAnim.value})`,
    shadowColor: '#E63946',
    shadowOpacity: glowAnim.value * 0.7,
    shadowRadius: 12 + glowAnim.value * 20,
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textAnim.value,
  }));

  const motionStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotateZ: `${translateX.value / 32}deg` },
      { scale: scaleAnim.value },
    ],
  }));

  const dragGesture = Gesture.Pan()
    .activeOffsetX([-6, 6])
    .activeOffsetY([-6, 6])
    .onUpdate(event => {
      translateX.value = event.translationX;
      translateY.value = event.translationY * 0.45;
    })
    .onEnd(() => {
      translateX.value = withSpring(0, { damping: 15, stiffness: 170 });
      translateY.value = withSpring(0, { damping: 15, stiffness: 170 });
    });

  const tapGesture = Gesture.Tap()
    .maxDistance(8)
    .onEnd((_event, success) => {
      if (success) runOnJS(onPress)();
    });

  const gesture = Gesture.Race(dragGesture, tapGesture);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessible
        accessibilityRole="button"
        accessibilityLabel="Create your first Wrapped. Drag the card or tap to log a workout."
        onAccessibilityTap={onPress}
        style={[
          styles.placeholderCard,
          styles.firstWrappedCard,
          { width, height, padding: Math.max(12, Math.round(20 * typeScale)) },
          glowStyle,
          motionStyle,
        ]}
      >
        <View style={styles.placeholderHeader}>
          <Text style={[styles.placeholderBrand, { fontSize: Math.max(8, 11 * typeScale), letterSpacing: Math.max(1.6, 3 * typeScale) }]}>MYPRS</Text>
          <Text style={[styles.placeholderEdition, { color: theme.textTertiary, fontSize: Math.max(6, 8 * typeScale), letterSpacing: Math.max(0.8, 1.5 * typeScale) }]}>FIRST EDITION</Text>
        </View>
        <View style={[styles.placeholderBody, { paddingHorizontal: Math.max(2, 12 * typeScale), gap: Math.max(8, 12 * typeScale) }]}>
          <Animated.Text
            adjustsFontSizeToFit
            minimumFontScale={0.64}
            numberOfLines={3}
            style={[styles.placeholderTitle, { fontSize: Math.max(16, 26 * typeScale), lineHeight: Math.max(20, 31 * typeScale) }, textStyle]}
          >
            Your first Wrapped is waiting
          </Animated.Text>
          <Text style={[styles.placeholderCopy, { color: theme.textSecondary, fontSize: Math.max(9, 12 * typeScale), lineHeight: Math.max(13, 18 * typeScale) }]} numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.78}>
            Log a session to mint card #001 and start your collection.
          </Text>
          <View style={[styles.placeholderCta, { paddingHorizontal: Math.max(11, 18 * typeScale), paddingVertical: Math.max(7, 10 * typeScale) }]}>
            <Text style={[styles.placeholderCtaText, { fontSize: Math.max(7, 10 * typeScale), letterSpacing: Math.max(0.8, 1.5 * typeScale) }]} numberOfLines={1}>+ LOG FIRST SESSION</Text>
          </View>
        </View>
        <View style={styles.placeholderFooter}>
          <Text style={[styles.placeholderNumber, { fontSize: Math.max(10, 14 * typeScale) }]}>#001</Text>
          <Text style={[styles.placeholderDragHint, { color: theme.textTertiary, fontSize: Math.max(6, 8 * typeScale), letterSpacing: Math.max(0.8, 1.5 * typeScale) }]}>DRAG THE CARD</Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

// Decorative, non-interactive card stacked behind the real deck cards whenever
// there are fewer real cards than the visible stack depth — this lets a user
// with only their first wrapped card still see the "more cards behind" affordance
// and feel out the swipe-left-reveals-older gesture immediately.
function TemplateFillerCard({ theme, offset, scale, zIndex, width, height }) {
  return (
    <View
      style={{ position: 'absolute', top: 0, left: 0, zIndex, transform: [{ translateX: offset }, { scale }] }}
      pointerEvents="none"
    >
      <View style={[styles.placeholderCard, styles.templateFillerCard, { width, height, borderColor: theme.border }]}>
        <Text style={[styles.placeholderText, { color: theme.textTertiary }]}>next wrapped</Text>
      </View>
    </View>
  );
}

function getTodayKey() {
  return toLocalDateKey();
}

export default function HomeScreen({ onOpenWizard, onOpenMedals, onHardReset, challengeToken, onChallengeHandled }) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const theme = useTheme();
  const DARK = theme.home || DARK_FALLBACK;
  const { soundEnabled, setSoundEnabled, resetState: resetSoundState } = useSound();
  const { workouts, wrappedCards, medals, equippedMedals, xpProgress, generateWrapped, newWrappedCard, dismissNewWrapped, deleteTodayEntry, newEarnedTitle, pendingTitleCategory, equipTitle, equippedTitle, createFirstCardTitle, discardTitle, resetState, newUnlock, levelUp, reloadFromStorage, syncIssue } = useWorkouts();
  const [viewingCard, setViewingCard] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showNewWrapped, setShowNewWrapped] = useState(false);
  const [showTodayWrapped, setShowTodayWrapped] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showLocker, setShowLocker] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showChallenge, setShowChallenge] = useState(false);
  const [newWrappedPhase, setNewWrappedPhase] = useState('card');
  const [titleCardOverride, setTitleCardOverride] = useState(null);
  const [deckIndex, setDeckIndex] = useState(0);
  const [cardSize, setCardSize] = useState({ w: PH_W, h: PH_H });
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [trendsVisible, setTrendsVisible] = useState(false);
  const [showTrendsIntro, setShowTrendsIntro] = useState(false);
  const [showCardFlipHint, setShowCardFlipHint] = useState(false);
  const deckPosition = useSharedValue(0);
  const deckGestureStart = useSharedValue(0);
  const cardEntranceScale = useSharedValue(0.92);
  const cardEntranceOpacity = useSharedValue(0);
  const trendsProgress = useSharedValue(0);
  const trendsGestureStart = useSharedValue(0);
  const appendModeRef = useRef(false);
  // Only the active card can be flipped, so a single progress value is enough.
  const cardFlip = useSharedValue(0);
  const [flippedCardId, setFlippedCardId] = useState(null);
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (challengeToken) setShowChallenge(true);
  }, [challengeToken]);

  const handleChallengeClose = useCallback(() => {
    setShowChallenge(false);
    onChallengeHandled?.();
  }, [onChallengeHandled]);

  const requestChallengeOpen = useCallback(() => setShowChallenge(true), []);

  const openAccountFromChallenge = useCallback(() => {
    setShowChallenge(false);
    setShowAccount(true);
  }, []);

  const handleAccountClose = useCallback(() => {
    setShowAccount(false);
    if (challengeToken) setShowChallenge(true);
  }, [challengeToken]);

  // Swiping to another card always returns the deck to the summary face.
  useEffect(() => {
    cardFlip.value = 0;
    setFlippedCardId(null);
  }, [deckIndex]);

  const dismissCardFlipHint = useCallback(() => {
    setShowCardFlipHint(false);
    setHasSeenFirstWrappedHints().catch(error => reportError(error, 'save-card-flip-hint'));
  }, []);

  const handleFlipCard = useCallback((card) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    dismissCardFlipHint();
    setFlippedCardId(prev => {
      const next = prev === card.id ? null : card.id;
      flipTo(cardFlip, next !== null, reduceMotion);
      return next;
    });
  }, [cardFlip, dismissCardFlipHint, reduceMotion]);

  // Measure the actual deck area so the card fits any device correctly.
  const handleDeckLayout = useCallback((e) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      const next = fitCard(width, height);
      setCardSize(prev => (prev.w === next.w && prev.h === next.h ? prev : next));
    }
  }, []);

  // Opens the temporary testing tools sheet. Release preflight blocks launch
  // while the explicit testing flag is enabled.
  const handleTitleEasterEgg = useCallback(() => {
    if (!TESTING_TOOLS_ENABLED) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowResetConfirm(true);
  }, []);

  // The simulator writes straight to storage, so pull the context back in sync
  // and clear any celebration modals its medal unlocks would have queued.
  const handleDevDataChanged = useCallback(async () => {
    await reloadFromStorage?.();
    dismissNewWrapped?.();
    // Sound prefs live in their own context, so a wipe has to clear them too or
    // the in-memory state drifts from the (now empty) storage.
    resetSoundState?.();
  }, [reloadFromStorage, dismissNewWrapped, resetSoundState]);

  const sortedCards = [...wrappedCards].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const ceremonyCard = titleCardOverride || newWrappedCard;
  const hasWorkouts = workouts.length > 0;
  const streak = calculateStreak(workouts);
  const level = xpProgress.level;
  const tier = getCardTier(level);
  const accent = theme.primary;
  const visibleCards = sortedCards.slice(deckIndex, deckIndex + DECK_MAX_VISIBLE);
  const hasMoreCards = sortedCards.length > deckIndex + DECK_MAX_VISIBLE;
  const showTemplateFiller = visibleCards.length < DECK_MAX_VISIBLE;
  const renderStart = Math.max(0, deckIndex - DECK_RENDER_BEHIND);
  const renderEnd = Math.min(sortedCards.length, deckIndex + DECK_MAX_VISIBLE + 1);
  const renderedCards = sortedCards.slice(renderStart, renderEnd);

  // Celebration modals are prioritized so only one native Modal is ever visible at
  // once (medal > level-up > title > new-wrapped congrats) — showing several
  // simultaneously is a known cause of frozen touch handling on iOS.
  const higherPriorityCelebrationActive = !!newUnlock || !!levelUp;

  const dismissTrendsIntro = useCallback(() => {
    setShowTrendsIntro(false);
    setTrendsIntroSeen().catch(error => reportError(error, 'save-trends-intro'));
  }, []);

  const openTrends = useCallback(() => {
    if (!hasWorkouts) return;
    setTrendsVisible(true);
    dismissTrendsIntro();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    trendsProgress.value = withTiming(1, { duration: reduceMotion ? 0 : 200 });
  }, [hasWorkouts, dismissTrendsIntro, trendsProgress, reduceMotion]);

  const finishClosingTrends = useCallback(() => setTrendsVisible(false), []);

  const closeTrends = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    trendsProgress.value = withTiming(0, { duration: reduceMotion ? 0 : 200 }, finished => {
      if (finished) runOnJS(finishClosingTrends)();
    });
  }, [trendsProgress, reduceMotion, finishClosingTrends]);

  useEffect(() => {
    let active = true;
    if (!hasWorkouts) return () => { active = false; };
    getTrendsIntroSeen()
      .then(seen => {
        if (active && !seen) setShowTrendsIntro(true);
      })
      .catch(error => reportError(error, 'load-trends-intro'));
    return () => { active = false; };
  }, [hasWorkouts]);

  useEffect(() => {
    let active = true;
    if (wrappedCards.length !== 1) {
      setShowCardFlipHint(false);
      return () => { active = false; };
    }
    getHasSeenFirstWrappedHints()
      .then(seen => {
        if (active && !seen) setShowCardFlipHint(true);
      })
      .catch(error => reportError(error, 'load-card-flip-hint'));
    return () => { active = false; };
  }, [wrappedCards.length]);

  const verticalPageGesture = Gesture.Pan()
    .enabled(hasWorkouts && !showMenu && !showNewWrapped && !showTodayWrapped && !viewingCard)
    .activeOffsetY([-18, 18])
    .failOffsetX([-22, 22])
    .onStart(() => {
      trendsGestureStart.value = trendsProgress.value;
    })
    .onUpdate(event => {
      const next = trendsGestureStart.value - event.translationY / Math.max(1, screenHeight);
      trendsProgress.value = Math.max(0, Math.min(1, next));
    })
    .onEnd(event => {
      const shouldOpen = trendsProgress.value > 0.35 || event.velocityY < -650;
      const shouldClose = trendsProgress.value < 0.65 || event.velocityY > 650;
      const target = trendsGestureStart.value > 0.5 ? (shouldClose ? 0 : 1) : (shouldOpen ? 1 : 0);
      trendsProgress.value = withTiming(target, { duration: reduceMotion ? 0 : 200 });
      if (target === 1) {
        runOnJS(setTrendsVisible)(true);
        runOnJS(dismissTrendsIntro)();
      } else {
        runOnJS(finishClosingTrends)();
      }
    });

  const mainPageStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -screenHeight * trendsProgress.value }],
  }), [screenHeight]);

  const trendsPageStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: screenHeight * (1 - trendsProgress.value) }],
  }), [screenHeight]);

  const updateDeckIndex = useCallback((newIdx) => {
    setDeckIndex(newIdx);
  }, []);

  const cardEntranceStyle = useAnimatedStyle(() => ({
    opacity: cardEntranceOpacity.value,
    transform: [{ scale: cardEntranceScale.value }],
  }));

  const deckPanGesture = Gesture.Pan()
    .cancelsTouchesInView(false)
    .shouldCancelWhenOutside(false)
    .activeOffsetX([-10, 10])
    .failOffsetY([-15, 15])
    .onStart(() => {
      deckGestureStart.value = deckPosition.value;
    })
    .onUpdate((event) => {
      const startIndex = Math.round(deckGestureStart.value);
      const minPosition = Math.max(0, startIndex - DECK_MAX_CARDS_PER_SWIPE);
      const maxPosition = Math.min(sortedCards.length - 1, startIndex + DECK_MAX_CARDS_PER_SWIPE);
      const nextPosition = deckGestureStart.value - event.translationX / DECK_SWIPE_DISTANCE;
      deckPosition.value = Math.max(minPosition, Math.min(maxPosition, nextPosition));
    })
    .onEnd((event) => {
      const currentIdx = Math.round(deckGestureStart.value);
      const minTarget = Math.max(0, currentIdx - DECK_MAX_CARDS_PER_SWIPE);
      const maxTarget = Math.min(sortedCards.length - 1, currentIdx + DECK_MAX_CARDS_PER_SWIPE);
      const projectedPosition = deckPosition.value - event.velocityX / DECK_VELOCITY_PROJECTION;
      const nearestTarget = Math.max(minTarget, Math.min(maxTarget, Math.round(projectedPosition)));
      const swipedLeft = event.translationX < -DECK_SWIPE_THRESHOLD || event.velocityX < -500;
      const swipedRight = event.translationX > DECK_SWIPE_THRESHOLD || event.velocityX > 500;
      let targetIndex = currentIdx;

      if (swipedLeft) {
        targetIndex = Math.max(currentIdx + 1, nearestTarget);
      } else if (swipedRight) {
        targetIndex = Math.min(currentIdx - 1, nearestTarget);
      }
      targetIndex = Math.max(0, Math.min(sortedCards.length - 1, targetIndex));

      if (targetIndex !== currentIdx) {
        runOnJS(updateDeckIndex)(targetIndex);
      }
      const cardsTravelled = Math.abs(targetIndex - deckPosition.value);
      deckPosition.value = withTiming(targetIndex, {
        duration: Math.min(240, 120 + cardsTravelled * 35),
      });
    });

  // The completed card sits outside the compact deck's original bounds, so it
  // owns a dedicated right-only gesture that pulls it back onto the deck.
  const deckRestoreGesture = Gesture.Pan()
    .cancelsTouchesInView(false)
    .shouldCancelWhenOutside(false)
    .activeOffsetX([-10, 10])
    .failOffsetY([-15, 15])
    .onStart(() => {
      deckGestureStart.value = deckPosition.value;
    })
    .onUpdate((event) => {
      if (event.translationX > 0) {
        const startIndex = Math.round(deckGestureStart.value);
        const minPosition = Math.max(0, startIndex - DECK_MAX_CARDS_PER_SWIPE);
        const nextPosition = deckGestureStart.value - event.translationX / DECK_SWIPE_DISTANCE;
        deckPosition.value = Math.max(minPosition, Math.min(startIndex, nextPosition));
      }
    })
    .onEnd((event) => {
      const currentIdx = Math.round(deckGestureStart.value);
      const minTarget = Math.max(0, currentIdx - DECK_MAX_CARDS_PER_SWIPE);
      const projectedPosition = deckPosition.value - event.velocityX / DECK_VELOCITY_PROJECTION;
      const nearestTarget = Math.max(minTarget, Math.min(currentIdx, Math.round(projectedPosition)));
      const restoring = event.translationX > DECK_SWIPE_THRESHOLD || event.velocityX > 500;
      const targetIndex = restoring
        ? Math.max(0, Math.min(currentIdx - 1, nearestTarget))
        : currentIdx;
      if (targetIndex !== currentIdx) {
        runOnJS(updateDeckIndex)(targetIndex);
      }
      const cardsTravelled = Math.abs(targetIndex - deckPosition.value);
      deckPosition.value = withTiming(targetIndex, {
        duration: Math.min(240, 120 + cardsTravelled * 35),
      });
    });

  // Keep tap, long-press and swipe recognition in one gesture arena. Nested
  // TouchableOpacity presses were swallowed by the parent Pan gesture on web,
  // so desktop clicks never reached the flip handler.
  const deckTapGesture = Gesture.Tap()
    .maxDistance(9)
    .onEnd((_event, success) => {
      const card = sortedCards[deckIndex];
      if (success && card) runOnJS(handleFlipCard)(card);
    });

  const deckGesture = Gesture.Race(deckPanGesture, deckTapGesture);

  const todayKey = getTodayKey();
  const todayWrapped = wrappedCards.find(c => c.periodKey === todayKey && c.type === 'daily' && !c.locked);

  // Determine which card to show in the today wrapped modal
  const todayModalCard = viewingCard && showTodayWrapped ? viewingCard : null;
  const isTodayCard = todayModalCard && todayModalCard.periodKey === todayKey && todayModalCard.type === 'daily' && !todayModalCard.locked;

  useEffect(() => {
    (async () => {
      const reminder = await getReminderSettings();
      setReminderEnabled(reminder.enabled);
    })();
  }, []);

  // Permission is requested only when the user actually turns the reminder on,
  // so we never prompt for notifications the user hasn't asked for.
  const handleToggleReminder = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (reminderEnabled) {
        await cancelDailyLogNudge();
        await saveReminderSettings({ enabled: false, hour: 19, minute: 0 });
        setReminderEnabled(false);
        return;
      }
      const granted = await registerForPushNotifications();
      if (!granted) {
        Alert.alert(
          'Notifications are off',
          'Enable notifications for MyPRS in your device settings to get a daily reminder.'
        );
        return;
      }
      await scheduleDailyLogNudge(19, 0);
      await saveReminderSettings({ enabled: true, hour: 19, minute: 0 });
      setReminderEnabled(true);
    } catch (error) {
      reportError(error, 'toggle-daily-reminder');
      Alert.alert('Reminder not updated', 'We could not change your reminder. Please try again.');
    }
  }, [reminderEnabled]);

  // The wizard's onSave (owned by the parent) always calls generateWrapped('daily')
  // after addWorkout, so this single effect is the source of truth for reacting to it —
  // append mode jumps straight to the updated Today's Wrapped detail view, everything
  // else shows the plain "new wrapped" congrats screen.
  useEffect(() => {
    if (!newWrappedCard) return;
    if (appendModeRef.current) {
      appendModeRef.current = false;
      setViewingCard(newWrappedCard);
      setShowTodayWrapped(true);
    } else {
      setTitleCardOverride(null);
      setNewWrappedPhase('card');
      setShowNewWrapped(true);
    }
  }, [newWrappedCard]);

  const entranceAnimVisible = showNewWrapped && !higherPriorityCelebrationActive && !newEarnedTitle;
  useEffect(() => {
    if (entranceAnimVisible) {
      cardEntranceScale.value = withSpring(1, { damping: 14, stiffness: 150 });
      cardEntranceOpacity.value = withTiming(1, { duration: 250 });
    } else {
      cardEntranceScale.value = 0.92;
      cardEntranceOpacity.value = 0;
    }
  }, [entranceAnimVisible]);

  const handleCreateWrapped = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await generateWrapped('daily');
    } catch (error) {
      reportError(error, 'generate-daily-wrapped');
      Alert.alert('Wrapped not created', 'Your workout is safe, but the Wrapped could not be created. Please try again.');
    }
  }, [generateWrapped]);

  const handleNewWrappedClose = useCallback(() => {
    setShowNewWrapped(false);
    setNewWrappedPhase('card');
    setTitleCardOverride(null);
    if (newWrappedCard) dismissNewWrapped();
  }, [dismissNewWrapped, newWrappedCard]);

  const handleOpenFirstTitle = useCallback(() => {
    const firstCard = [...wrappedCards].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0];
    if (!firstCard) return;
    setShowLocker(false);
    setTitleCardOverride(firstCard);
    setNewWrappedPhase('title');
    setTimeout(() => setShowNewWrapped(true), 200);
  }, [wrappedCards]);

  const handleStampFirstTitle = useCallback((text) => {
    if (!ceremonyCard) return null;
    return createFirstCardTitle(ceremonyCard.id, text);
  }, [ceremonyCard, createFirstCardTitle]);

  const handleCloseCardDetail = useCallback(() => {
    setViewingCard(null);
    setShowTodayWrapped(false);
  }, []);

  const handleMenuAction = useCallback((action) => {
    setShowMenu(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(action, 200);
  }, []);

  // ── Log Workout FAB ──
  // Tapping + always goes straight into the entry wizard — if today's wrapped
  // already exists, this is append mode, so the new exercises merge into that
  // same card instead of showing an intermediate review screen first. The
  // resulting card is still shown afterward via the append-mode effect above.
  const handleFabPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (todayWrapped) {
      appendModeRef.current = true;
    }
    onOpenWizard();
  }, [todayWrapped, onOpenWizard]);

  // ── Add More (append to today's wrapped) ──
  const handleAddMore = useCallback(() => {
    appendModeRef.current = true;
    setShowTodayWrapped(false);
    setViewingCard(null);
    onOpenWizard();
  }, [onOpenWizard]);

  // ── Delete today's wrapped (also clears today's logged workouts, not just the card) ──
  const handleDeleteTodayWrapped = useCallback(async () => {
    if (!todayModalCard) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Warning);
      await deleteTodayEntry(todayModalCard.id);
      setShowDeleteConfirm(false);
      setViewingCard(null);
      setShowTodayWrapped(false);
    } catch (error) {
      reportError(error, 'delete-today');
      Alert.alert('Delete failed', 'Today’s workout data could not be deleted. Nothing has been removed.');
    }
  }, [todayModalCard, deleteTodayEntry]);

  return (
    <View style={[styles.container, { backgroundColor: DARK.background }]}>
      <GestureDetector gesture={verticalPageGesture}>
        <View style={styles.swipeStage}>
          <Animated.View
            style={[styles.trendsLayer, trendsPageStyle]}
            aria-hidden={!trendsVisible}
            pointerEvents={trendsVisible ? 'auto' : 'none'}
            accessibilityElementsHidden={!trendsVisible}
            importantForAccessibility={trendsVisible ? 'yes' : 'no-hide-descendants'}
          >
            <TrendsScreen workouts={workouts} onReturn={closeTrends} topInset={insets.top} />
          </Animated.View>
          <Animated.View
            style={[styles.mainLayer, { backgroundColor: DARK.background, paddingTop: insets.top }, mainPageStyle]}
            aria-hidden={trendsVisible}
            pointerEvents={trendsVisible ? 'none' : 'auto'}
            accessibilityElementsHidden={trendsVisible}
            importantForAccessibility={trendsVisible ? 'no-hide-descendants' : 'yes'}
          >
      {/* Top Bar */}
      <View style={[styles.topBar, { backgroundColor: DARK.surface, borderBottomColor: DARK.separator }]}>
        <TouchableOpacity
          activeOpacity={TESTING_TOOLS_ENABLED ? 0.7 : 1}
          onPress={handleTitleEasterEgg}
          accessibilityRole={TESTING_TOOLS_ENABLED ? 'button' : undefined}
          accessibilityLabel={TESTING_TOOLS_ENABLED ? 'Open developer tools' : undefined}
        >
            <Text style={[styles.appTitle, { color: DARK.textPrimary }]}>MyPRS</Text>
          </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShowMenu(true)}
          style={[styles.menuBtn, { backgroundColor: DARK.surfaceSecondary }]}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel="Open menu"
        >
          <View style={[styles.menuDot, { backgroundColor: DARK.textPrimary }]} />
          <View style={[styles.menuDot, { backgroundColor: DARK.textPrimary }]} />
          <View style={[styles.menuDot, { backgroundColor: DARK.textPrimary }]} />
        </TouchableOpacity>
      </View>

      {syncIssue && (
        <View style={styles.syncBanner}>
          <Text style={styles.syncBannerText}>{syncIssue}</Text>
        </View>
      )}

      {/* Streak + Level/XP status bar */}
      {hasWorkouts && (
        <View style={[styles.statusBar, { borderBottomColor: DARK.separator }]}>
          <View style={styles.statusItem}>
            <AnimatedStatIcon type="streak" size={22} color="#FF5264" accessibilityLabel="Workout streak" />
            <Text style={[styles.statusText, { color: DARK.textSecondary }]}>{streak} {pluralize(streak, 'day')}</Text>
          </View>
          <View style={styles.xpSection}>
            <View style={styles.xpHeaderRow}>
              <Text style={[styles.levelText, { color: accent }]}>Lv.{level}</Text>
              <Text style={[styles.xpSubText, { color: DARK.textTertiary }]}>{xpProgress.xpInLevel} / {xpProgress.xpToNext} XP</Text>
            </View>
            <View style={[styles.xpTrack, { backgroundColor: DARK.surfaceSecondary }]}>
              <View style={[styles.xpFill, { width: `${Math.min(xpProgress.progress * 100, 100)}%`, backgroundColor: accent }]} />
            </View>
          </View>
        </View>
      )}

      {/* Card Deck */}
      <View style={styles.deckArea} onLayout={handleDeckLayout}>
        {sortedCards.length > 0 ? (
          <GestureDetector gesture={deckGesture}>
          <View style={{ width: cardSize.w, height: cardSize.h }}>
            {renderedCards.map((card, i) => {
              const cardIndex = renderStart + i;
              const isCurrent = cardIndex === deckIndex;
              const isPrevious = cardIndex === deckIndex - 1;

              return (
                <SpreadDeckItem
                  key={card.id}
                  cardIndex={cardIndex}
                  deckPosition={deckPosition}
                  width={cardSize.w}
                  height={cardSize.h}
                  stackOffset={DECK_STACK_OFFSET}
                  spreadOffset={cardSize.w + DECK_SPREAD_GAP}
                  stackScale={DECK_STACK_SCALE}
                  isInteractive={isCurrent || isPrevious}
                  gesture={isPrevious ? deckRestoreGesture : null}
                >
                  <View
                    accessible={isCurrent}
                    aria-hidden={!isCurrent}
                    accessibilityElementsHidden={!isCurrent}
                    importantForAccessibility={isCurrent ? 'yes' : 'no-hide-descendants'}
                    accessibilityRole={isCurrent ? 'button' : undefined}
                    accessibilityLabel={
                      isCurrent && flippedCardId === card.id
                        ? 'Wrapped details. Tap to flip back to the summary.'
                        : 'Wrapped summary. Tap to flip for full workout details.'
                    }
                    onAccessibilityTap={() => isCurrent && handleFlipCard(card)}
                    style={{ flex: 1, pointerEvents: isCurrent ? 'auto' : 'none' }}
                  >
                    {isCurrent ? (
                      // Only the active card mounts a back face: keeps the flip
                      // cheap and guarantees no off-screen face can catch touches.
                      <FlipCard
                        flipProgress={cardFlip}
                        isFlipped={flippedCardId === card.id}
                        width={cardSize.w}
                        height={cardSize.h}
                        front={
                          <ShareableWrappedCard
                            variant="hero"
                            heroWidth={cardSize.w}
                            stats={card.stats || card.headlineStat}
                            wrappedCount={sortedCards.filter(c => c.type === card.type && c.createdAt <= card.createdAt).length}
                            cardNumber={card.cardNumber}
                            level={card.level || 1}
                            medals={equippedMedals}
                            userTitle={card.userTitle}
                            headlineFactId={card.headlineFactId}
                          />
                        }
                        back={
                          <WrappedCardBack
                            card={card}
                            workouts={workouts}
                            width={cardSize.w}
                            height={cardSize.h}
                            equippedMedals={equippedMedals}
                            accent={accent}
                          />
                        }
                      />
                    ) : (
                      <ShareableWrappedCard
                        variant="hero"
                        heroWidth={cardSize.w}
                        stats={card.stats || card.headlineStat}
                        wrappedCount={sortedCards.filter(c => c.type === card.type && c.createdAt <= card.createdAt).length}
                        cardNumber={card.cardNumber}
                        level={card.level || 1}
                        medals={equippedMedals}
                        userTitle={card.userTitle}
                        headlineFactId={card.headlineFactId}
                      />
                    )}
                  </View>
                </SpreadDeckItem>
              );
            })}
            {showTemplateFiller && (
              <TemplateFillerCard
                theme={DARK}
                offset={visibleCards.length * DECK_STACK_OFFSET}
                scale={1 - visibleCards.length * DECK_STACK_SCALE}
                zIndex={DECK_MAX_VISIBLE - visibleCards.length}
                width={cardSize.w}
                height={cardSize.h}
              />
            )}
            {hasMoreCards && (
              <View style={styles.deckMore}>
                <Text style={[styles.deckMoreText, { color: DARK.textSecondary, fontFamily: theme.font.semiBold }]}>
                  +{sortedCards.length - deckIndex - DECK_MAX_VISIBLE} more
                </Text>
              </View>
            )}
            {sortedCards.length > 1 && (
              <Text style={[styles.deckPosition, { color: DARK.textTertiary, fontFamily: theme.font.regular }]}>
                {deckIndex + 1} / {sortedCards.length}
              </Text>
            )}
          </View>
          </GestureDetector>
        ) : (
          <PlaceholderCard width={cardSize.w} height={cardSize.h} theme={DARK} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onOpenWizard(); }} />
        )}
      </View>

      {/* Spacer for FAB clearance */}
      <View style={{ height: 80 + insets.bottom, flexShrink: 0 }} />

      {/* FAB - Log Workout */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: accent, bottom: insets.bottom + 16 }]}
        onPress={handleFabPress}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Log workout"
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      {showCardFlipHint && !showNewWrapped && !trendsVisible && !higherPriorityCelebrationActive && !newEarnedTitle && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Flip your Wrapped card to reveal detailed workout statistics"
          onPress={() => {
            const activeCard = sortedCards[deckIndex];
            if (activeCard) handleFlipCard(activeCard);
          }}
          activeOpacity={0.88}
          style={[styles.trendsCoachmark, { bottom: insets.bottom + 82 }]}
        >
          <View style={[styles.trendsCoachmarkArrow, { backgroundColor: accent }]}>
            <AnimatedStatIcon type="layers" size={24} color="#FFFFFF" accessibilityLabel="Card details" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.trendsCoachmarkTitle}>Tap your card to flip it</Text>
            <Text style={styles.trendsCoachmarkText}>The back reveals complete workout stats, exercises and PRs.</Text>
          </View>
          <Text style={styles.trendsCoachmarkAction}>FLIP</Text>
        </TouchableOpacity>
      )}

      {showTrendsIntro && !showCardFlipHint && !showNewWrapped && !trendsVisible && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Open Trends. Swipe up from the cards screen any time."
          onPress={openTrends}
          activeOpacity={0.88}
          style={[styles.trendsCoachmark, { bottom: insets.bottom + 82 }]}
        >
          <View style={styles.trendsCoachmarkArrow}><Text style={styles.trendsCoachmarkArrowText}>↑</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.trendsCoachmarkTitle}>Your trends are ready</Text>
            <Text style={styles.trendsCoachmarkText}>Swipe up to see strength, volume and PR history.</Text>
          </View>
          <Text style={styles.trendsCoachmarkAction}>VIEW</Text>
        </TouchableOpacity>
      )}
          </Animated.View>
        </View>
      </GestureDetector>

      {/* Menu Modal */}
      <Modal visible={showMenu} animationType="fade" transparent onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setShowMenu(false)}>
          <View style={[styles.menuSheet, { backgroundColor: DARK.surface, borderColor: DARK.border }]}>
            <Text style={[styles.menuTitle, { color: DARK.textSecondary }]}>Menu</Text>
            <MenuItem icon="record" label="Medals" onPress={() => handleMenuAction(onOpenMedals)} />
            <MenuItem icon="locker" label="Your Locker" onPress={() => handleMenuAction(() => setShowLocker(true))} />
            <MenuItem icon="battle" label="Challenge a Friend" onPress={() => handleMenuAction(() => setShowChallenge(true))} />
            <MenuItem icon="profile" label="Account & Backup" onPress={() => handleMenuAction(() => setShowAccount(true))} />
            {hasWorkouts && (
              <MenuItem icon="frequency" label="Create Daily Wrapped" onPress={() => { setShowMenu(false); handleCreateWrapped(); }} />
            )}
            <View style={[styles.menuDivider, { backgroundColor: DARK.separator }]} />
            <View style={styles.soundRow}>
              <Text style={[styles.soundLabel, { color: DARK.textPrimary, fontFamily: theme.font.regular }]}>Sound Effects</Text>
              <TouchableOpacity
                style={[styles.soundToggle, { backgroundColor: soundEnabled ? theme.primary : DARK.border }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSoundEnabled(!soundEnabled); }}
                activeOpacity={0.7}
              >
                <View style={[styles.soundKnob, { alignSelf: soundEnabled ? 'flex-end' : 'flex-start', backgroundColor: '#FFF' }]} />
              </TouchableOpacity>
            </View>
            <View style={styles.soundRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={[styles.soundLabel, { color: DARK.textPrimary, fontFamily: theme.font.regular }]}>Daily Reminder</Text>
                <Text style={[styles.reminderHint, { color: DARK.textSecondary, fontFamily: theme.font.regular }]}>
                  {reminderEnabled ? 'Nudges you at 7pm to log your workout' : 'Off — no reminders'}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.soundToggle, { backgroundColor: reminderEnabled ? theme.primary : DARK.border }]}
                onPress={handleToggleReminder}
                activeOpacity={0.7}
                accessibilityRole="switch"
                accessibilityState={{ checked: reminderEnabled }}
                accessibilityLabel="Daily workout reminder"
              >
                <View style={[styles.soundKnob, { alignSelf: reminderEnabled ? 'flex-end' : 'flex-start', backgroundColor: '#FFF' }]} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.menuCloseBtn} onPress={() => setShowMenu(false)} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Close menu">
              <Text style={[styles.menuCloseText, { color: DARK.textSecondary }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Today's Wrapped / Card Detail Modal */}
      <Modal visible={showTodayWrapped || !!viewingCard} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleCloseCardDetail}>
        {todayModalCard && (
          <View style={{ flex: 1, backgroundColor: DARK.background }}>
            {/* Header */}
            <View style={styles.detailHeader}>
              <TouchableOpacity onPress={handleCloseCardDetail} style={{ padding: 8, width: 40 }} accessibilityRole="button" accessibilityLabel="Close Wrapped details">
                <Text style={{ color: DARK.textPrimary, fontSize: 18, fontFamily: theme.font.bold }}>X</Text>
              </TouchableOpacity>
              <Text style={{ color: DARK.textPrimary, fontSize: 18, fontFamily: theme.font.bold }}>
                {isTodayCard ? "Today's Wrapped" : `${todayModalCard.type === 'daily' ? 'Daily' : todayModalCard.type === 'weekly' ? 'Weekly' : 'Monthly'} Wrapped`}
              </Text>
              <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
              <ShareableWrappedCard
                stats={todayModalCard.stats || todayModalCard.headlineStat}
                wrappedCount={wrappedCards.filter(c => c.type === todayModalCard.type && c.createdAt <= todayModalCard.createdAt).length}
                cardNumber={todayModalCard.cardNumber}
                level={todayModalCard.level || 1}
                medals={equippedMedals}
                onSave={handleCloseCardDetail}
                userTitle={todayModalCard.userTitle}
                headlineFactId={todayModalCard.headlineFactId}
              />

              {/* Today-specific actions */}
              {isTodayCard && (
                <View style={styles.todayActions}>
                  <TouchableOpacity
                    style={[styles.todayActionBtn, { backgroundColor: theme.primary }]}
                    onPress={handleAddMore}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.todayActionBtnText}>Add More</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.todayActionBtn, styles.todayDeleteBtn]}
                    onPress={() => setShowDeleteConfirm(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.todayActionBtnText, { color: '#FF3B30' }]}>Delete Today</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* New Wrapped Card Modal */}
      <Modal visible={showNewWrapped && !higherPriorityCelebrationActive && !newEarnedTitle} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleNewWrappedClose}>
        {ceremonyCard && (
          <View style={{ flex: 1, backgroundColor: DARK.background }}>
            <View style={styles.detailHeader}>
              <TouchableOpacity onPress={handleNewWrappedClose} style={{ padding: 8, width: 40 }} accessibilityRole="button" accessibilityLabel="Close Wrapped celebration">
                <Text style={{ color: DARK.textPrimary, fontSize: 18, fontFamily: theme.font.bold }}>X</Text>
              </TouchableOpacity>
              <Text style={{ color: '#E63946', fontSize: 20, fontFamily: theme.font.bold, letterSpacing: 0.5 }}>
                {newWrappedPhase === 'title' ? 'Claim Your Title' : 'Wrapped Complete!'}
              </Text>
              <View style={{ width: 40 }} />
            </View>
            {newWrappedPhase === 'title' ? (
              <TitleStampCeremony
                card={ceremonyCard}
                medals={equippedMedals}
                onStamp={handleStampFirstTitle}
                onDone={handleNewWrappedClose}
                onCancel={handleNewWrappedClose}
              />
            ) : (
              <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }} contentInsetAdjustmentBehavior="automatic">
                <Animated.View style={[cardEntranceStyle]}>
                  <ShareableWrappedCard
                    stats={ceremonyCard.stats || ceremonyCard.headlineStat}
                    wrappedCount={wrappedCards.filter(c => c.type === ceremonyCard.type).length}
                    cardNumber={ceremonyCard.cardNumber}
                    level={ceremonyCard.level || 1}
                    medals={equippedMedals}
                    onSave={handleNewWrappedClose}
                    userTitle={ceremonyCard.userTitle}
                    headlineFactId={ceremonyCard.headlineFactId}
                  />
                </Animated.View>
                {!equippedTitle && wrappedCards.length === 1 && ceremonyCard.type === 'daily' && (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Create and stamp a title onto your first card"
                    onPress={() => setNewWrappedPhase('title')}
                    activeOpacity={0.82}
                    style={[styles.firstTitleButton, { backgroundColor: theme.primary }]}
                  >
                    <Text style={styles.firstTitleButtonText}>Create & stamp my title</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}
          </View>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={showDeleteConfirm} animationType="fade" transparent onRequestClose={() => setShowDeleteConfirm(false)}>
        <View style={styles.deleteOverlay}>
          <View style={[styles.deleteSheet, { backgroundColor: DARK.surface, borderColor: DARK.border }]}>
            <Text style={[styles.deleteTitle, { color: DARK.textPrimary, fontFamily: theme.font.bold }]}>Delete today's wrapped?</Text>
            <Text style={[styles.deleteDesc, { color: DARK.textSecondary, fontFamily: theme.font.regular }]}>
              This clears all logged data for today and cannot be undone. You can start fresh afterwards.
            </Text>
            <View style={styles.deleteActions}>
              <TouchableOpacity
                style={[styles.deleteBtn, { backgroundColor: '#FF3B30' }]}
                onPress={handleDeleteTodayWrapped}
                activeOpacity={0.8}
              >
                <Text style={[styles.deleteBtnText, { color: '#FFF', fontFamily: theme.font.semiBold }]}>Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteBtn, { backgroundColor: DARK.surfaceSecondary }]}
                onPress={() => setShowDeleteConfirm(false)}
                activeOpacity={0.8}
              >
                <Text style={[styles.deleteBtnText, { color: DARK.textPrimary, fontFamily: theme.font.semiBold }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Temporary testing tools — tap the MyPRS title. */}
      {TESTING_TOOLS_ENABLED && (
        <DevPanel
          visible={showResetConfirm}
          onClose={() => setShowResetConfirm(false)}
          onDataChanged={handleDevDataChanged}
        />
      )}

      {/* Title earned modal */}
      <TitleEarnModal
        visible={!!newEarnedTitle && !higherPriorityCelebrationActive}
        title={newEarnedTitle}
        category={pendingTitleCategory}
        onEquip={equipTitle}
        onDiscard={discardTitle}
      />

      <CustomizationLocker visible={showLocker} onClose={() => setShowLocker(false)} onOpenMedals={onOpenMedals} onCreateTitle={handleOpenFirstTitle} />

      <AccountScreen visible={showAccount} onClose={handleAccountClose} />

      <FriendChallengeModal
        visible={showChallenge}
        wrappedCards={wrappedCards}
        incomingToken={challengeToken}
        onClose={handleChallengeClose}
        onRequestOpen={requestChallengeOpen}
        onOpenAccount={openAccountFromChallenge}
      />

    </View>
  );
}

function MenuItem({ icon, label, onPress }) {
  const theme = useTheme();
  const DARK = theme.home || DARK_FALLBACK;
  return (
    <TouchableOpacity style={[styles.menuItem, { borderBottomColor: DARK.separator }]} onPress={onPress} activeOpacity={0.6} accessibilityRole="button" accessibilityLabel={label}>
      <View style={styles.menuItemIcon}><AnimatedStatIcon type={icon} size={22} color={theme.primary} /></View>
      <Text style={[styles.menuItemLabel, { color: DARK.textPrimary }]}>{label}</Text>
      <Text style={[styles.menuItemArrow, { color: DARK.textSecondary }]}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'column' },
  swipeStage: { flex: 1, overflow: 'hidden' },
  mainLayer: { ...StyleSheet.absoluteFillObject, flexDirection: 'column', zIndex: 2 },
  trendsLayer: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
  trendsCoachmark: {
    position: 'absolute',
    left: 14,
    right: 14,
    minHeight: 68,
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: '#202329',
    borderWidth: 1,
    borderColor: '#3B3F48',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
    zIndex: 40,
  },
  trendsCoachmarkArrow: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E63946' },
  trendsCoachmarkArrowText: { color: '#FFF', fontSize: 20, lineHeight: 22, fontFamily: 'Inter_700Bold' },
  trendsCoachmarkTitle: { color: '#FFF', fontSize: 13, fontFamily: 'Inter_700Bold' },
  trendsCoachmarkText: { color: '#A3A6AE', fontSize: 10, lineHeight: 14, marginTop: 2, fontFamily: 'Inter_400Regular' },
  trendsCoachmarkAction: { color: '#FF5B69', fontSize: 9, letterSpacing: 1.2, fontFamily: 'Inter_700Bold' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
    flexShrink: 0,
    zIndex: 20,
  },
  appTitle: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },
  menuBtn: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center', gap: 3,
  },
  menuDot: { width: 4, height: 4, borderRadius: 2 },
  syncBanner: { backgroundColor: '#2A2112', borderBottomWidth: 1, borderBottomColor: '#5C4620', paddingHorizontal: 20, paddingVertical: 7, alignItems: 'center' },
  syncBannerText: { color: '#E8B95A', fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  deckArea: {
    flex: 1, minHeight: 0, alignItems: 'center',
    justifyContent: 'center', paddingHorizontal: 16,
  },
  deckMore: {
    position: 'absolute', bottom: -28, left: 4, alignItems: 'flex-start',
  },
  deckMoreText: { fontSize: 13, letterSpacing: 0.5 },
  deckPosition: {
    position: 'absolute', bottom: -28, right: 4, fontSize: 12, letterSpacing: 0.5,
  },
  placeholderCard: {
    borderWidth: 1.5,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  placeholderText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    letterSpacing: 0.5,
    opacity: 0.5,
  },
  firstWrappedCard: {
    justifyContent: 'space-between',
    alignItems: 'stretch',
    backgroundColor: '#101010',
  },
  placeholderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  placeholderBrand: { color: '#E63946', fontSize: 11, letterSpacing: 3, fontFamily: 'Inter_700Bold' },
  placeholderEdition: { fontSize: 8, letterSpacing: 1.5, fontFamily: 'Inter_700Bold' },
  placeholderBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12, gap: 12 },
  placeholderTitle: {
    color: '#FFFFFF', fontSize: 26, lineHeight: 31, fontFamily: 'Inter_700Bold',
    textAlign: 'center', maxWidth: 280,
  },
  placeholderCopy: { fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular', textAlign: 'center', maxWidth: 250 },
  placeholderCta: {
    marginTop: 4, borderRadius: 999, borderWidth: 1, borderColor: '#E63946',
    backgroundColor: '#E6394618', paddingHorizontal: 18, paddingVertical: 10,
  },
  placeholderCtaText: { color: '#E63946', fontSize: 10, letterSpacing: 1.5, fontFamily: 'Inter_700Bold' },
  placeholderFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  placeholderNumber: { color: '#E63946', fontSize: 14, fontFamily: 'Inter_700Bold' },
  placeholderDragHint: { fontSize: 8, letterSpacing: 1.5, fontFamily: 'Inter_600SemiBold' },
  templateFillerCard: {
    opacity: 0.7,
  },
  statusBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12,
    borderBottomWidth: 1, flexShrink: 0, gap: 16,
  },
  statusItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  xpSection: { flex: 1, maxWidth: 200 },
  xpHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 4,
  },
  xpSubText: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  xpTrack: { height: 5, borderRadius: 3, overflow: 'hidden' },
  xpFill: { height: '100%', borderRadius: 3 },
  levelText: { fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  fab: {
    position: 'absolute', alignSelf: 'center',
    width: 60, height: 60, borderRadius: 30,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12,
    // Defensively above the deck stack (max zIndex DECK_MAX_VISIBLE) so it can
    // never be visually or functionally covered by an oversized card.
    zIndex: 50, elevation: 20,
  },
  fabIcon: { fontSize: 32, color: '#000', fontFamily: 'Inter_700Bold', lineHeight: 34 },
  menuOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end',
  },
  menuSheet: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderWidth: 1, borderBottomWidth: 0,
    paddingTop: 20, paddingBottom: 40, paddingHorizontal: 20,
  },
  menuTitle: {
    fontSize: 11, fontFamily: 'Inter_700Bold',
    letterSpacing: 2, textTransform: 'uppercase',
    marginBottom: 12, marginLeft: 4,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1,
  },
  menuItemIcon: { marginRight: 14, width: 28, alignItems: 'center', justifyContent: 'center' },
  menuItemLabel: { flex: 1, fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  menuItemArrow: { fontSize: 22, fontFamily: 'Inter_400Regular' },
  menuCloseBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 8 },
  menuCloseText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  menuDivider: { height: 1, marginVertical: 8 },
  soundRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: 14,
  },
  soundLabel: { fontSize: 16 },
  reminderHint: { fontSize: 11, marginTop: 3, lineHeight: 15 },
  soundToggle: {
    width: 48, height: 28, borderRadius: 14,
    justifyContent: 'center', padding: 2,
  },
  soundKnob: { width: 24, height: 24, borderRadius: 12 },
  detailHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12,
  },
  todayActions: {
    flexDirection: 'row', gap: 12,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40,
  },
  firstTitleButton: {
    alignSelf: 'center',
    width: '90%',
    maxWidth: 420,
    borderRadius: 16,
    borderCurve: 'continuous',
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 10,
    boxShadow: '0 9px 28px rgba(230,57,70,0.24)',
  },
  firstTitleButtonText: { color: '#080808', fontSize: 15, fontFamily: 'Inter_700Bold' },
  todayActionBtn: {
    flex: 1, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center',
  },
  todayDeleteBtn: {
    backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#FF3B30',
  },
  todayActionBtnText: {
    fontSize: 16, color: '#FFF', fontFamily: 'Inter_700Bold',
  },
  deleteOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', paddingHorizontal: 32,
  },
  deleteSheet: {
    borderRadius: 20, borderWidth: 1, padding: 24,
  },
  deleteTitle: { fontSize: 18, marginBottom: 8, textAlign: 'center' },
  deleteDesc: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  deleteActions: { flexDirection: 'row', gap: 10 },
  deleteBtn: {
    flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  deleteBtnText: { fontSize: 15 },
});
