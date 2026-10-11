import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Modal } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue, withTiming, runOnJS } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { useWorkouts } from '../context/WorkoutContext';
import { getArchiveTipSeen, setArchiveTipSeen } from '../utils/storage';
import { pluralize } from '../utils/pluralize';
import ShareableWrappedCard from './ShareableWrappedCard';
import { daysUntilNextLocalMonth, daysUntilNextLocalWeek } from '../utils/dateUtils';
import SpreadDeckItem from './spread-deck-item';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = Math.min(SCREEN_W - 56, 320);
const CARD_H = CARD_W * 16 / 9;
const STACK_OFFSET = 14;
const STACK_SCALE = 0.03;
const MAX_VISIBLE = 4;
const SWIPE_THRESHOLD = 64;
const SWIPE_DISTANCE = 150;
const MAX_CARDS_PER_SWIPE = 4;
const VELOCITY_PROJECTION = 1600;
const SPREAD_GAP = 48;
const RENDER_BEHIND = 5;

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'daily', label: 'Daily', info: 'Daily wrapped is created by you, anytime.' },
  { key: 'weekly', label: 'Weekly', info: 'Weekly wrapped auto-generates every Sunday night from your logged workouts.' },
  { key: 'monthly', label: 'Monthly', info: 'Monthly wrapped auto-generates on the 1st of each month.' },
];

function daysUntilNextWeekly() {
  return daysUntilNextLocalWeek();
}

function daysUntilNextMonthly() {
  return daysUntilNextLocalMonth();
}

function DeckCard({ card, isFront }) {
  const p = card.tier?.palette || { border: '#E5E5EA', background: '#FAFAFA', primary: '#E63946', secondary: '#E63946', textBright: '#1A1A1A', accent: '#E63946' };
  const frame = card.tier?.frame || { borderRadius: 20, borderWidth: 1 };
  const hs = card.headlineStat || {};

  return (
    <View
      style={[
        styles.deckCard,
        {
          width: CARD_W,
          height: CARD_H,
          borderColor: p.border,
          backgroundColor: p.background,
          borderRadius: frame.borderRadius,
          borderWidth: frame.borderWidth,
          opacity: card.locked ? 0.6 : 1,
        },
      ]}
      pointerEvents={isFront ? 'auto' : 'none'}
    >
      <View style={[styles.cardBadge, { backgroundColor: p.primary + '22' }]}>
        <Text style={[styles.cardBadgeText, { color: p.primary }]}>
          {card.type === 'daily' ? 'D' : card.type === 'weekly' ? 'W' : 'M'}
          {card.locked ? ' 🔒' : ''}
        </Text>
      </View>

      <View style={styles.cardBody}>
        {hs.icon ? <Text style={styles.cardBodyIcon}>{hs.icon}</Text> : null}
        {hs.value ? <Text style={[styles.cardBodyValue, { color: p.textBright }]} numberOfLines={1}>{hs.value}</Text> : null}
        {hs.label ? <Text style={[styles.cardBodyLabel, { color: p.secondary }]} numberOfLines={1}>{hs.label}</Text> : null}
      </View>

      {card.title ? (
        <Text style={[styles.cardDate, { color: p.secondary }]} numberOfLines={1}>{card.title}</Text>
      ) : null}
    </View>
  );
}

export default function WrappedHistory({ wrappedCards, onClose }) {
  const theme = useTheme();
  // Equipped medals are a live preference, so archived cards show the current
  // loadout rather than whatever was pinned the day they were generated.
  const { equippedMedals } = useWorkouts();
  const [tab, setTab] = useState('all');
  const [topIndex, setTopIndex] = useState(0);
  const [viewingCard, setViewingCard] = useState(null);
  const [showTooltip, setShowTooltip] = useState(null);
  const [showContextualTip, setShowContextualTip] = useState(false);
  const tipShownRef = useRef(false);

  const deckPosition = useSharedValue(0);
  const gestureStart = useSharedValue(0);

  const filtered = tab === 'all'
    ? wrappedCards
    : wrappedCards.filter(c => c.type === tab);

  const sorted = [...filtered].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const hasMore = sorted.length > topIndex + MAX_VISIBLE;
  const renderStart = Math.max(0, topIndex - RENDER_BEHIND);
  const renderEnd = Math.min(sorted.length, topIndex + MAX_VISIBLE + 1);
  const rendered = sorted.slice(renderStart, renderEnd);

  const updateTopIndex = useCallback((newIdx) => {
    setTopIndex(newIdx);
  }, []);

  useEffect(() => {
    setTopIndex(0);
    deckPosition.value = 0;
  }, [tab]);

  const panGesture = Gesture.Pan()
    .cancelsTouchesInView(false)
    .shouldCancelWhenOutside(false)
    .activeOffsetX([-10, 10])
    .failOffsetY([-15, 15])
    .onStart(() => {
      gestureStart.value = deckPosition.value;
    })
    .onUpdate((event) => {
      const startIndex = Math.round(gestureStart.value);
      const minPosition = Math.max(0, startIndex - MAX_CARDS_PER_SWIPE);
      const maxPosition = Math.min(sorted.length - 1, startIndex + MAX_CARDS_PER_SWIPE);
      const nextPosition = gestureStart.value - event.translationX / SWIPE_DISTANCE;
      deckPosition.value = Math.max(minPosition, Math.min(maxPosition, nextPosition));
    })
    .onEnd((event) => {
      const currentIdx = Math.round(gestureStart.value);
      const minTarget = Math.max(0, currentIdx - MAX_CARDS_PER_SWIPE);
      const maxTarget = Math.min(sorted.length - 1, currentIdx + MAX_CARDS_PER_SWIPE);
      const projectedPosition = deckPosition.value - event.velocityX / VELOCITY_PROJECTION;
      const nearestTarget = Math.max(minTarget, Math.min(maxTarget, Math.round(projectedPosition)));
      const isSwipingLeft = event.translationX < -SWIPE_THRESHOLD || event.velocityX < -500;
      const isSwipingRight = event.translationX > SWIPE_THRESHOLD || event.velocityX > 500;
      let targetIndex = currentIdx;

      if (isSwipingLeft) {
        targetIndex = Math.max(currentIdx + 1, nearestTarget);
      } else if (isSwipingRight) {
        targetIndex = Math.min(currentIdx - 1, nearestTarget);
      }
      targetIndex = Math.max(0, Math.min(sorted.length - 1, targetIndex));

      if (targetIndex !== currentIdx) {
        runOnJS(updateTopIndex)(targetIndex);
      }
      const cardsTravelled = Math.abs(targetIndex - deckPosition.value);
      deckPosition.value = withTiming(targetIndex, {
        duration: Math.min(240, 120 + cardsTravelled * 35),
      });
    });

  const restoreGesture = Gesture.Pan()
    .cancelsTouchesInView(false)
    .shouldCancelWhenOutside(false)
    .activeOffsetX([-10, 10])
    .failOffsetY([-15, 15])
    .onStart(() => {
      gestureStart.value = deckPosition.value;
    })
    .onUpdate((event) => {
      if (event.translationX > 0) {
        const startIndex = Math.round(gestureStart.value);
        const minPosition = Math.max(0, startIndex - MAX_CARDS_PER_SWIPE);
        const nextPosition = gestureStart.value - event.translationX / SWIPE_DISTANCE;
        deckPosition.value = Math.max(minPosition, Math.min(startIndex, nextPosition));
      }
    })
    .onEnd((event) => {
      const currentIdx = Math.round(gestureStart.value);
      const minTarget = Math.max(0, currentIdx - MAX_CARDS_PER_SWIPE);
      const projectedPosition = deckPosition.value - event.velocityX / VELOCITY_PROJECTION;
      const nearestTarget = Math.max(minTarget, Math.min(currentIdx, Math.round(projectedPosition)));
      const restoring = event.translationX > SWIPE_THRESHOLD || event.velocityX > 500;
      const targetIndex = restoring
        ? Math.max(0, Math.min(currentIdx - 1, nearestTarget))
        : currentIdx;
      if (targetIndex !== currentIdx) {
        runOnJS(updateTopIndex)(targetIndex);
      }
      const cardsTravelled = Math.abs(targetIndex - deckPosition.value);
      deckPosition.value = withTiming(targetIndex, {
        duration: Math.min(240, 120 + cardsTravelled * 35),
      });
    });

  useEffect(() => {
    (async () => {
      const seen = await getArchiveTipSeen();
      if (!seen && !tipShownRef.current) {
        tipShownRef.current = true;
        setTimeout(() => setShowContextualTip(true), 400);
      }
    })();
  }, []);

  const handleOpenCard = useCallback((card) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setViewingCard(card);
  }, []);

  const handleCloseCard = useCallback(() => {
    setViewingCard(null);
  }, []);

  const handleDismissTip = useCallback(async () => {
    setShowContextualTip(false);
    await setArchiveTipSeen();
  }, []);

  const weeklyCountdown = daysUntilNextWeekly();
  const monthlyCountdown = daysUntilNextMonthly();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.separator }]}>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={[styles.closeText, { color: theme.textPrimary, fontFamily: theme.font.bold }]}>X</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.textPrimary, fontFamily: theme.font.bold }]}>Wrapped Archive</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={[styles.tabBar, { borderBottomColor: theme.separator }]}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, t.key === tab && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTab(t.key); setShowTooltip(null); }}
            activeOpacity={0.7}
          >
            <View style={styles.tabLabelRow}>
              <Text style={[styles.tabText, { color: t.key === tab ? theme.textPrimary : theme.textSecondary, fontFamily: theme.font.semiBold }]}>{t.label}</Text>
              {t.info && (
                <TouchableOpacity
                  onPress={() => setShowTooltip(showTooltip === t.key ? null : t.key)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.infoIcon, { color: theme.textTertiary }]}>ⓘ</Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={[styles.countdownRow, { borderBottomColor: theme.separator }]}>
        <Text style={[styles.countdownText, { color: theme.textSecondary, fontFamily: theme.font.regular }]}>
          Next weekly: {weeklyCountdown === 0 ? 'tonight' : `in ${weeklyCountdown} ${pluralize(weeklyCountdown, 'day')}`}
          {' · '}
          Next monthly: {monthlyCountdown === 0 ? 'tonight' : `in ${monthlyCountdown} ${pluralize(monthlyCountdown, 'day')}`}
        </Text>
      </View>

      {sorted.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={[styles.emptyTitle, { color: theme.textPrimary, fontFamily: theme.font.semiBold }]}>No wrapped cards yet</Text>
          <Text style={[styles.emptySub, { color: theme.textSecondary, fontFamily: theme.font.regular }]}>
            {tab === 'all'
              ? 'Log a workout and create a Daily Wrapped to see it here. Weekly and Monthly cards are auto-generated.'
              : `No ${tab} wrapped cards yet. They appear here once generated.`}
          </Text>
        </View>
      ) : (
        <View style={styles.deckArea}>
          <GestureDetector gesture={panGesture}>
          <View style={styles.deckStack}>
            {rendered.map((card, i) => {
              const cardIndex = renderStart + i;
              const isCurrent = cardIndex === topIndex;
              const isPrevious = cardIndex === topIndex - 1;

              return (
                <SpreadDeckItem
                  key={card.id}
                  cardIndex={cardIndex}
                  deckPosition={deckPosition}
                  width={CARD_W}
                  height={CARD_H}
                  stackOffset={STACK_OFFSET}
                  spreadOffset={CARD_W + SPREAD_GAP}
                  stackScale={STACK_SCALE}
                  isInteractive={isCurrent || isPrevious}
                  gesture={isPrevious ? restoreGesture : null}
                >
                  <TouchableOpacity
                    activeOpacity={0.85}
                    disabled={!isCurrent}
                    onPress={() => handleOpenCard(card)}
                    style={{ pointerEvents: isCurrent ? 'auto' : 'none' }}
                  >
                    <DeckCard card={card} isFront={isCurrent} />
                  </TouchableOpacity>
                </SpreadDeckItem>
              );
            })}
          </View>
          </GestureDetector>

          {hasMore && (
            <View style={styles.moreIndicator}>
              <Text style={[styles.moreText, { color: theme.textSecondary, fontFamily: theme.font.semiBold }]}>
                +{sorted.length - topIndex - MAX_VISIBLE} more
              </Text>
            </View>
          )}

          {sorted.length > 1 && (
            <Text style={[styles.positionText, { color: theme.textTertiary, fontFamily: theme.font.regular }]}>
              {topIndex + 1} / {sorted.length}
            </Text>
          )}
        </View>
      )}

      {showTooltip && (
        <View style={[styles.tooltip, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.tooltipText, { color: theme.textPrimary, fontFamily: theme.font.regular }]}>
            {TABS.find(t => t.key === showTooltip)?.info}
          </Text>
          <TouchableOpacity onPress={() => setShowTooltip(null)} activeOpacity={0.7}>
            <Text style={[styles.tooltipClose, { color: theme.primary, fontFamily: theme.font.semiBold }]}>Got it</Text>
          </TouchableOpacity>
        </View>
      )}

      {showContextualTip && (
        <View style={[styles.contextualTip, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.contextualTipTitle, { color: theme.textPrimary, fontFamily: theme.font.bold }]}>How wrapped cards work</Text>
          <Text style={[styles.contextualTipText, { color: theme.textSecondary, fontFamily: theme.font.regular }]}>
            Daily wrapped: you create it anytime by tapping "Log Workout".{'\n'}
            Weekly wrapped: auto-generates every Sunday night.{'\n'}
            Monthly wrapped: auto-generates on the 1st of each month.
          </Text>
          <TouchableOpacity
            style={[styles.contextualTipBtn, { backgroundColor: theme.primary }]}
            onPress={handleDismissTip}
            activeOpacity={0.7}
          >
            <Text style={[styles.contextualTipBtnText, { color: '#FFF', fontFamily: theme.font.semiBold }]}>Got it</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={!!viewingCard} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleCloseCard}>
        {viewingCard && (
          <View style={{ flex: 1, backgroundColor: theme.background }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12 }}>
              <TouchableOpacity onPress={handleCloseCard}>
                <Text style={{ color: theme.textPrimary, fontSize: 18, fontFamily: theme.font.bold }}>X</Text>
              </TouchableOpacity>
              <Text style={{ color: theme.textPrimary, fontSize: 18, fontFamily: theme.font.bold }}>
                {viewingCard.type === 'daily' ? 'Daily' : viewingCard.type === 'weekly' ? 'Weekly' : 'Monthly'} Wrapped
                {viewingCard.locked ? ' 🔒' : ''}
              </Text>
              <View style={{ width: 40 }} />
            </View>
            <ShareableWrappedCard
              stats={viewingCard.stats || viewingCard.headlineStat}
              wrappedCount={wrappedCards.filter(c => c.type === viewingCard.type && c.createdAt <= viewingCard.createdAt).length}
              cardNumber={viewingCard.cardNumber}
              level={viewingCard.level || 1}
              medals={equippedMedals}
              onSave={handleCloseCard}
              userTitle={viewingCard.userTitle}
              headlineFactId={viewingCard.headlineFactId}
            />
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12, borderBottomWidth: 1,
  },
  closeBtn: { padding: 8, width: 40 },
  closeText: { fontSize: 18 },
  title: { fontSize: 18 },

  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tabText: { fontSize: 14 },
  infoIcon: { fontSize: 16 },

  countdownRow: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  countdownText: { fontSize: 11, textAlign: 'center' },

  deckArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 20,
  },
  deckStack: {
    width: CARD_W,
    height: CARD_H,
  },
  deckCard: {
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
    padding: 16,
    justifyContent: 'space-between',
  },
  cardBadge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  cardBadgeText: { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  cardBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  cardBodyIcon: { fontSize: 32, marginBottom: 6 },
  cardBodyValue: { fontSize: 20, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  cardBodyLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  cardDate: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center' },

  moreIndicator: {
    position: 'absolute',
    bottom: 80,
    alignItems: 'center',
  },
  moreText: { fontSize: 13, letterSpacing: 0.5 },
  positionText: {
    position: 'absolute',
    bottom: 56,
    fontSize: 12,
    letterSpacing: 0.5,
  },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, marginBottom: 8 },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 22 },

  tooltip: {
    position: 'absolute', top: 130, left: 16, right: 16,
    borderRadius: 14, borderWidth: 1, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 8,
  },
  tooltipText: { flex: 1, fontSize: 13, lineHeight: 18, marginRight: 12 },
  tooltipClose: { fontSize: 13 },

  contextualTip: {
    position: 'absolute', bottom: 40, left: 16, right: 16,
    borderRadius: 20, borderWidth: 1, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15, shadowRadius: 16, elevation: 10,
  },
  contextualTipTitle: { fontSize: 16, marginBottom: 8, textAlign: 'center' },
  contextualTipText: { fontSize: 13, lineHeight: 20, marginBottom: 14, textAlign: 'center' },
  contextualTipBtn: { borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  contextualTipBtnText: { fontSize: 15 },
});
