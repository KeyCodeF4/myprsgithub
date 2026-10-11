import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { Easing, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { reportError } from '../utils/errorReporter';
import {
  CHALLENGE_CARD_TYPES,
  acceptFriendChallenge,
  buildChallengeSnapshot,
  createFriendChallenge,
  getLatestCard,
  getUnseenAcceptedChallenge,
  markChallengeViewed,
  previewFriendChallenge,
  scoreChallenge,
  shareFriendChallenge,
} from '../utils/friend-challenges';

const METRIC_LABELS = {
  volume: 'Volume', duration: 'Gym time', calories: 'Est. calories', bestWeight: 'Best weight', reps: 'Reps', prs: 'PRs',
};
const METRIC_UNITS = { volume: ' kg', duration: ' min', calories: ' kcal', bestWeight: ' kg', reps: '', prs: '' };

function battleFromRow(row) {
  return {
    id: row.id,
    challengerId: row.challenger_id,
    left: row.challenger_snapshot,
    right: row.recipient_snapshot,
  };
}

function BattleArena({ battle, onComplete }) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  const result = useMemo(() => scoreChallenge(battle.left, battle.right), [battle]);
  const loser = result.winner === 'left' ? 'right' : result.winner === 'right' ? 'left' : null;

  useEffect(() => {
    if (reduceMotion) return;
    progress.value = withSequence(
      withTiming(0.5, { duration: 300, easing: Easing.out(Easing.cubic) }),
      withDelay(120, withTiming(1, { duration: 300, easing: Easing.inOut(Easing.cubic) }))
    );
  }, [progress, reduceMotion]);

  const leftStyle = useAnimatedStyle(() => ({
    opacity: loser === 'left' ? interpolate(progress.value, [0.55, 1], [1, 0.22]) : 1,
    transform: [
      { translateX: loser === 'left' ? interpolate(progress.value, [0.55, 0.72, 1], [0, -8, -90]) : 0 },
      { rotateZ: loser === 'left' ? `${interpolate(progress.value, [0.55, 0.72, 1], [0, -4, -13])}deg` : '0deg' },
      { scale: result.winner === 'left' ? interpolate(progress.value, [0.5, 1], [1, 1.05]) : 1 },
    ],
  }));
  const rightStyle = useAnimatedStyle(() => ({
    opacity: loser === 'right' ? interpolate(progress.value, [0.55, 1], [1, 0.22]) : 1,
    transform: [
      { translateX: loser === 'right' ? interpolate(progress.value, [0.55, 0.72, 1], [0, 8, 90]) : 0 },
      { rotateZ: loser === 'right' ? `${interpolate(progress.value, [0.55, 0.72, 1], [0, 4, 13])}deg` : '0deg' },
      { scale: result.winner === 'right' ? interpolate(progress.value, [0.5, 1], [1, 1.05]) : 1 },
    ],
  }));
  const resultStyle = useAnimatedStyle(() => ({ opacity: interpolate(progress.value, [0.65, 1], [0, 1]), transform: [{ scale: interpolate(progress.value, [0.65, 1], [0.88, 1]) }] }));

  return (
    <ScrollView contentContainerStyle={styles.battleContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.battleEyebrow}>FRIEND BATTLE</Text>
      <Text style={styles.battleTitle}>Cards on the line</Text>
      <View style={styles.versusRow}>
        <Animated.View style={[styles.battleCard, result.winner === 'left' && styles.winnerCard, leftStyle]}>
          <Text numberOfLines={1} style={styles.playerName}>{battle.left.displayName}</Text>
          <Text numberOfLines={2} style={styles.playerTitle}>{battle.left.title}</Text>
          <Text style={styles.playerScore}>{result.leftScore}</Text>
          <Text style={styles.roundsWon}>ROUNDS</Text>
        </Animated.View>
        <View style={styles.vsBadge}><Text style={styles.vsText}>VS</Text></View>
        <Animated.View style={[styles.battleCard, result.winner === 'right' && styles.winnerCard, rightStyle]}>
          <Text numberOfLines={1} style={styles.playerName}>{battle.right.displayName}</Text>
          <Text numberOfLines={2} style={styles.playerTitle}>{battle.right.title}</Text>
          <Text style={styles.playerScore}>{result.rightScore}</Text>
          <Text style={styles.roundsWon}>ROUNDS</Text>
        </Animated.View>
      </View>
      <View style={styles.roundList}>
        {result.rounds.map(round => (
          <View key={round.key} style={styles.roundRow}>
            <Text style={[styles.roundValue, round.winner === 'left' && styles.roundWinner]}>{round.leftValue.toLocaleString()}{METRIC_UNITS[round.key]}</Text>
            <Text style={styles.roundLabel}>{METRIC_LABELS[round.key]}</Text>
            <Text style={[styles.roundValue, styles.roundRight, round.winner === 'right' && styles.roundWinner]}>{round.rightValue.toLocaleString()}{METRIC_UNITS[round.key]}</Text>
          </View>
        ))}
      </View>
      <Animated.View style={[styles.resultPanel, resultStyle]}>
        <Text style={styles.resultKicker}>{result.winner === 'tie' ? 'DRAW' : 'WINNER'}</Text>
        <Text style={styles.resultName}>{result.winner === 'left' ? battle.left.title : result.winner === 'right' ? battle.right.title : 'Dead even'}</Text>
        <Text style={styles.resultCopy}>{loser ? 'The losing card has been knocked out.' : 'Run it back with another Wrapped.'}</Text>
      </Animated.View>
      <TouchableOpacity accessibilityRole="button" onPress={onComplete} activeOpacity={0.8} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Collect result</Text></TouchableOpacity>
    </ScrollView>
  );
}

export default function FriendChallengeModal({ visible, wrappedCards, incomingToken, onClose, onRequestOpen, onOpenAccount }) {
  const { user, accountProfile, isAuthenticated } = useAuth();
  const theme = useTheme();
  const [cardType, setCardType] = useState('daily');
  const [mode, setMode] = useState('create');
  const [preview, setPreview] = useState(null);
  const [battle, setBattle] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const selectedCard = useMemo(() => getLatestCard(wrappedCards, cardType), [wrappedCards, cardType]);
  const displayName = accountProfile?.display_name || accountProfile?.username || user?.email?.split('@')[0] || 'You';

  const loadIncoming = useCallback(async token => {
    if (!token || !isAuthenticated) return;
    setBusy(true); setMessage(''); setMode('accept'); setBattle(null);
    try {
      const result = await previewFriendChallenge(token);
      setPreview(result);
      setCardType(result.card_type);
    } catch (error) {
      reportError(error, 'preview-friend-challenge');
      setMessage(error?.message || 'This challenge could not be opened.');
    } finally { setBusy(false); }
  }, [isAuthenticated]);

  useEffect(() => {
    if (visible && incomingToken) loadIncoming(incomingToken);
  }, [visible, incomingToken, loadIncoming]);

  useEffect(() => {
    if (!user?.id || visible) return;
    let active = true;
    getUnseenAcceptedChallenge(user.id)
      .then(row => {
        if (!active || !row) return;
        setBattle(battleFromRow(row));
        setMode('battle');
        onRequestOpen?.();
      })
      .catch(error => reportError(error, 'load-unseen-challenge'));
    return () => { active = false; };
  }, [user?.id, visible, onRequestOpen]);

  const create = useCallback(async () => {
    if (!selectedCard) { setMessage(`You need a ${cardType} Wrapped before you can challenge a friend with it.`); return; }
    setBusy(true); setMessage('');
    try {
      const snapshot = buildChallengeSnapshot(selectedCard, displayName);
      const challenge = await createFriendChallenge({ userId: user.id, cardType, snapshot });
      await shareFriendChallenge(challenge, snapshot);
      setMessage('Challenge link ready. Your friend can accept it for seven days.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      reportError(error, 'create-friend-challenge');
      setMessage(error?.message || 'The challenge link could not be created.');
    } finally { setBusy(false); }
  }, [selectedCard, displayName, user?.id, cardType]);

  const accept = useCallback(async () => {
    const responseCard = getLatestCard(wrappedCards, preview?.card_type);
    if (!responseCard) { setMessage(`You are missing a ${preview?.card_type} Wrapped to compare.`); return; }
    setBusy(true); setMessage('');
    try {
      const snapshot = buildChallengeSnapshot(responseCard, displayName);
      const row = await acceptFriendChallenge(incomingToken, snapshot);
      setBattle(battleFromRow(row));
      setMode('battle');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      reportError(error, 'accept-friend-challenge');
      setMessage(error?.message || 'This challenge could not be accepted.');
    } finally { setBusy(false); }
  }, [wrappedCards, preview, displayName, incomingToken]);

  const completeBattle = useCallback(async () => {
    try {
      await markChallengeViewed(battle.id, user.id, battle.challengerId);
    } catch (error) { reportError(error, 'mark-challenge-viewed'); }
    setBattle(null); setPreview(null); setMode('create'); onClose?.();
  }, [battle, user?.id, onClose]);

  const close = () => { setPreview(null); setMessage(''); if (!battle) setMode('create'); onClose?.(); };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <View><Text style={[styles.headerEyebrow, { color: theme.primary }]}>PRIVATE COMPETITION</Text><Text style={styles.headerTitle}>Challenge a Friend</Text></View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close friend challenge" onPress={close} style={styles.closeButton}><Text style={styles.closeText}>×</Text></TouchableOpacity>
        </View>
        {mode === 'battle' && battle ? <BattleArena battle={battle} onComplete={completeBattle} /> : (
          <ScrollView contentContainerStyle={styles.content}>
            {!isAuthenticated ? (
              <View style={styles.emptyPanel}><Text style={styles.emptyTitle}>Sign in to compete</Text><Text style={styles.emptyCopy}>An account keeps challenge results private and lets both friends replay the battle when they return.</Text><TouchableOpacity onPress={onOpenAccount} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Open account</Text></TouchableOpacity></View>
            ) : busy ? <ActivityIndicator color={theme.primary} size="large" style={{ marginTop: 80 }} /> : mode === 'accept' && preview ? (
              <>
                <Text style={styles.intro}>You have been challenged to a private {preview.card_type} Wrapped battle.</Text>
                <View style={styles.inviteCard}><Text style={styles.inviteLabel}>CHALLENGER</Text><Text style={styles.inviteTitle}>{preview.challenger_snapshot?.title}</Text><Text style={styles.inviteName}>{preview.challenger_snapshot?.displayName}</Text><Text style={styles.inviteStat}>{(preview.challenger_snapshot?.metrics?.volume || 0).toLocaleString()} kg moved</Text></View>
                {!getLatestCard(wrappedCards, preview.card_type) && <Text style={styles.errorText}>You are missing a {preview.card_type} Wrapped to compare. Log enough training to create one, then reopen this link.</Text>}
                <TouchableOpacity disabled={!getLatestCard(wrappedCards, preview.card_type)} onPress={accept} style={[styles.primaryButton, !getLatestCard(wrappedCards, preview.card_type) && styles.disabledButton]}><Text style={styles.primaryButtonText}>Accept battle</Text></TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.intro}>Choose one of your latest cards. Your friend sees only these comparison totals—not your exercise details.</Text>
                <View style={styles.typeRow}>
                  {CHALLENGE_CARD_TYPES.map(type => (
                    <TouchableOpacity key={type} accessibilityRole="button" accessibilityState={{ selected: type === cardType }} onPress={() => { Haptics.selectionAsync(); setCardType(type); setMessage(''); }} style={[styles.typeButton, type === cardType && { backgroundColor: theme.primary, borderColor: theme.primary }]}><Text style={[styles.typeText, type === cardType && styles.typeTextActive]}>{type[0].toUpperCase() + type.slice(1)}</Text></TouchableOpacity>
                  ))}
                </View>
                {selectedCard ? <View style={styles.inviteCard}><Text style={styles.inviteLabel}>YOUR CONTENDER</Text><Text style={styles.inviteTitle}>{selectedCard.userTitle?.text || selectedCard.userTitle || 'The Challenger'}</Text><Text style={styles.inviteName}>{selectedCard.title || selectedCard.periodKey}</Text><Text style={styles.inviteStat}>{(selectedCard.stats?.totalVolume || 0).toLocaleString()} kg moved</Text></View> : <View style={styles.missingCard}><Text style={styles.errorText}>You do not have a {cardType} card yet. Choose another period or create that Wrapped first.</Text></View>}
                <TouchableOpacity disabled={!selectedCard} onPress={create} style={[styles.primaryButton, !selectedCard && styles.disabledButton]}><Text style={styles.primaryButtonText}>Create private challenge link</Text></TouchableOpacity>
                <Text style={styles.privacy}>The invite expires after seven days and can only be accepted once.</Text>
              </>
            )}
            {!!message && <Text style={styles.message}>{message}</Text>}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#090A0D' },
  header: { minHeight: 76, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#272A31' },
  headerEyebrow: { fontSize: 8, letterSpacing: 2, fontFamily: 'Inter_700Bold' },
  headerTitle: { color: '#FFF', fontSize: 22, marginTop: 3, fontFamily: 'Inter_700Bold' },
  closeButton: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#191B20', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#FFF', fontSize: 28, lineHeight: 30, fontFamily: 'Inter_400Regular' },
  content: { padding: 18, paddingBottom: 60, gap: 16 },
  intro: { color: '#B1B3BA', fontSize: 14, lineHeight: 21, fontFamily: 'Inter_400Regular' },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeButton: { flex: 1, height: 44, borderRadius: 13, borderWidth: 1, borderColor: '#33363E', alignItems: 'center', justifyContent: 'center', backgroundColor: '#17191E' },
  typeText: { color: '#9A9DA5', fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  typeTextActive: { color: '#FFF' },
  inviteCard: { minHeight: 210, borderRadius: 24, backgroundColor: '#17191E', borderWidth: 1, borderColor: '#343741', padding: 22, justifyContent: 'center', alignItems: 'center', shadowColor: '#E63946', shadowOpacity: 0.12, shadowRadius: 24 },
  inviteLabel: { color: '#777A83', fontSize: 9, letterSpacing: 2, fontFamily: 'Inter_700Bold' },
  inviteTitle: { color: '#FFF', fontSize: 25, textAlign: 'center', marginTop: 16, fontFamily: 'Inter_700Bold' },
  inviteName: { color: '#94979F', fontSize: 12, marginTop: 8, fontFamily: 'Inter_600SemiBold' },
  inviteStat: { color: '#FF5869', fontSize: 16, marginTop: 20, fontFamily: 'Inter_700Bold' },
  primaryButton: { minHeight: 52, paddingHorizontal: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E63946' },
  primaryButtonText: { color: '#FFF', fontSize: 14, fontFamily: 'Inter_700Bold' },
  disabledButton: { opacity: 0.35 },
  privacy: { color: '#656870', fontSize: 10, lineHeight: 15, textAlign: 'center', fontFamily: 'Inter_400Regular' },
  missingCard: { padding: 18, borderRadius: 16, backgroundColor: '#21151A', borderWidth: 1, borderColor: '#47242C' },
  errorText: { color: '#FF8894', fontSize: 12, lineHeight: 18, fontFamily: 'Inter_600SemiBold' },
  message: { color: '#D2D3D7', fontSize: 12, lineHeight: 18, textAlign: 'center', padding: 12, fontFamily: 'Inter_600SemiBold' },
  emptyPanel: { marginTop: 60, padding: 24, borderRadius: 22, backgroundColor: '#15171B', gap: 16 },
  emptyTitle: { color: '#FFF', fontSize: 24, fontFamily: 'Inter_700Bold' },
  emptyCopy: { color: '#9A9DA5', fontSize: 13, lineHeight: 20, fontFamily: 'Inter_400Regular' },
  battleContent: { padding: 16, paddingBottom: 50, alignItems: 'center' },
  battleEyebrow: { color: '#FF5869', fontSize: 9, letterSpacing: 3, fontFamily: 'Inter_700Bold' },
  battleTitle: { color: '#FFF', fontSize: 28, marginTop: 5, fontFamily: 'Inter_700Bold' },
  versusRow: { width: '100%', marginTop: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  battleCard: { width: '43%', minHeight: 190, padding: 14, borderRadius: 22, backgroundColor: '#17191E', borderWidth: 1, borderColor: '#353841', alignItems: 'center', justifyContent: 'center' },
  winnerCard: { borderColor: '#E63946', shadowColor: '#E63946', shadowOpacity: 0.45, shadowRadius: 18 },
  vsBadge: { width: 42, height: 42, marginHorizontal: -7, zIndex: 5, borderRadius: 21, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  vsText: { color: '#090A0D', fontSize: 11, fontFamily: 'Inter_700Bold' },
  playerName: { color: '#81848D', fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  playerTitle: { color: '#FFF', fontSize: 15, lineHeight: 20, textAlign: 'center', marginTop: 10, minHeight: 40, fontFamily: 'Inter_700Bold' },
  playerScore: { color: '#FF5869', fontSize: 44, lineHeight: 48, marginTop: 12, fontFamily: 'Inter_700Bold' },
  roundsWon: { color: '#666972', fontSize: 8, letterSpacing: 1.5, fontFamily: 'Inter_700Bold' },
  roundList: { width: '100%', marginTop: 22, borderRadius: 18, paddingHorizontal: 14, backgroundColor: '#13151A' },
  roundRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#292C32' },
  roundValue: { width: '35%', color: '#858891', fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  roundRight: { textAlign: 'right' },
  roundWinner: { color: '#FFF', fontFamily: 'Inter_700Bold' },
  roundLabel: { width: '30%', color: '#656870', textAlign: 'center', fontSize: 9, textTransform: 'uppercase', fontFamily: 'Inter_600SemiBold' },
  resultPanel: { width: '100%', marginTop: 18, padding: 20, borderRadius: 20, alignItems: 'center', backgroundColor: '#2A151C', borderWidth: 1, borderColor: '#672936' },
  resultKicker: { color: '#FF5869', fontSize: 9, letterSpacing: 2.5, fontFamily: 'Inter_700Bold' },
  resultName: { color: '#FFF', fontSize: 24, marginTop: 7, textAlign: 'center', fontFamily: 'Inter_700Bold' },
  resultCopy: { color: '#A98D93', fontSize: 11, marginTop: 6, fontFamily: 'Inter_400Regular' },
});

