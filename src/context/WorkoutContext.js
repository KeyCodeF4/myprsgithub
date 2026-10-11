import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { getWorkouts, saveWorkout, saveWorkouts, getMedals, saveMedals, togglePinMedal, getStartingStats, saveStartingStats, getXpData, saveXpData, getWrappedCards, saveWrappedCard, saveWrappedCards, deleteWrappedCard, lockDailyWrappedCards, getEquippedTitle, setEquippedTitle, getEarnedTitles, setEarnedTitles, getLastEarnedTitle, setLastEarnedTitle } from '../utils/storage';
import { evaluateMedals } from '../utils/medalEvaluator';
import { resolveEquippedMedals, MAX_EQUIPPED_MEDALS } from '../utils/equippedMedals';
import { getLevel, getXpProgress, computeXpForWrappedCard } from '../utils/xpSystem';
import { getFriends, saveFriends, addFriend as addFriendStorage, removeFriend as removeFriendStorage, getProfile, saveProfile, claimReferral } from '../utils/friendsData';
import { generateDailyWrapped, generateWeeklyWrapped, generateMonthlyWrapped, checkAndGenerateAuto, formatPeriod } from '../utils/wrappedGenerator';
import { addToSyncQueue, startSyncService, stopSyncService } from '../utils/syncService';
import { supabase } from '../lib/supabase';
import { getCategoryForStats, selectTitle } from '../utils/titleSelector';
import { getWorkoutDateKey, toLocalDateKey } from '../utils/dateUtils';
import { reportError } from '../utils/errorReporter';
import { useAuth } from './AuthContext';
import { trackEvent } from '../utils/product-analytics';
import { getCardTier } from '../config/cardTiers';
import { MEDALS } from '../data/medalsConfig';

const WorkoutContext = createContext();

export const useWorkouts = () => useContext(WorkoutContext);

async function getCurrentUserId() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id;
}

async function maybeQueueSync(table, type, data) {
  try {
    const userId = await getCurrentUserId();
    if (userId) {
      await addToSyncQueue(table, type, data, userId);
    }
  } catch (error) {
    reportError(error, 'queue-cloud-sync', { table, type });
  }
}

function getTodayKey() {
  return toLocalDateKey();
}

export const WorkoutProvider = ({ children }) => {
  const { accountProfile } = useAuth();
  const [workouts, setWorkouts] = useState([]);
  const [medals, setMedals] = useState([]);
  const [startingStats, setStartingStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newUnlock, setNewUnlock] = useState(null);
  const [xpTotal, setXpTotal] = useState(0);
  const [levelUp, setLevelUp] = useState(null);
  const [friends, setFriends] = useState([]);
  const [profile, setProfile] = useState(null);
  const [wrappedCards, setWrappedCards] = useState([]);
  const [newWrappedCard, setNewWrappedCard] = useState(null);
  const [equippedTitle, setEquippedTitleState] = useState(null);
  const [earnedTitles, setEarnedTitlesState] = useState([]);
  const [newEarnedTitle, setNewEarnedTitle] = useState(null);
  const [pendingTitleCategory, setPendingTitleCategory] = useState(null);
  const [syncIssue, setSyncIssue] = useState(null);
  const evaluatedFounderRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    startSyncService(status => {
      if (status.state === 'pending') setSyncIssue(`${status.pending} change${status.pending === 1 ? '' : 's'} waiting to back up`);
      else if (status.state === 'offline') setSyncIssue('Offline · changes will back up automatically');
      else setSyncIssue(null);
    });
    return stopSyncService;
  }, []);

  const loadData = async () => {
    const readSafely = async (reader, fallback, context) => {
      try {
        return await reader();
      } catch (error) {
        reportError(error, context);
        return fallback;
      }
    };

    try {
      const [w, m, s, x, f, p, c, et, eTitles] = await Promise.all([
        readSafely(getWorkouts, [], 'load-workouts'),
        readSafely(getMedals, [], 'load-medals'),
        readSafely(getStartingStats, null, 'load-starting-stats'),
        readSafely(getXpData, { totalXp: 0 }, 'load-xp'),
        readSafely(getFriends, [], 'load-friends'),
        readSafely(getProfile, null, 'load-profile'),
        readSafely(getWrappedCards, [], 'load-wrapped-cards'),
        readSafely(getEquippedTitle, null, 'load-equipped-title'),
        readSafely(getEarnedTitles, [], 'load-earned-titles'),
      ]);

      let normalizedCards = c;
      try {
        const locked = await lockDailyWrappedCards();
        normalizedCards = locked.map(card => {
          if (card.type !== 'weekly' || !card.periodStart || !card.periodEnd) return card;
          const title = formatPeriod('weekly', card.periodStart, card.periodEnd);
          return title === card.title ? card : { ...card, title };
        });
        if (normalizedCards.some((card, index) => card.title !== locked[index]?.title)) {
          await saveWrappedCards(normalizedCards);
        }
      } catch (error) {
        reportError(error, 'normalize-wrapped-cards');
      }

      setWorkouts(w);
      setMedals(m);
      setStartingStats(s);
      setXpTotal(x.totalXp || 0);
      setFriends(f);
      setProfile(p);
      setWrappedCards(normalizedCards);
      setEquippedTitleState(et);
      setEarnedTitlesState(eTitles);
    } catch (error) {
      reportError(error, 'load-workout-data');
    } finally {
      // Never leave a user stuck on the launch screen because one local data
      // bucket is unavailable or malformed. Successful buckets still load.
      setLoading(false);
    }
  };

  const awardWrappedXp = useCallback(async (card, existingCards) => {
    // For daily, only award XP if no other daily for today already earned XP
    if (card.type === 'daily') {
      const todayKey = card.periodKey || getTodayKey();
      const existingDaily = existingCards.filter(c => c.type === 'daily' && c.periodKey === todayKey);
      if (existingDaily.length > 0) return 0;
    }

    const xpGain = computeXpForWrappedCard(card);
    if (xpGain === 0) return 0;

    const xd = await getXpData();
    const newTotal = (xd.totalXp || 0) + xpGain;
    await saveXpData({ totalXp: newTotal });
    setXpTotal(newTotal);
    return xpGain;
  }, []);

  const runEvaluation = useCallback(async (workoutList) => {
    const currentMedals = await getMedals();
    // Wrapped-milestone medals depend on how many Wrapped cards exist, so they
    // have to be evaluated against current card storage, not just workouts.
    const currentCards = await getWrappedCards();
    const { newlyUnlocked, updatedMedals } = evaluateMedals(
      workoutList,
      currentMedals,
      currentCards,
      { founderNumber: accountProfile?.founder_number || null }
    );
    await saveMedals(updatedMedals);
    for (const m of updatedMedals) {
      const existed = currentMedals.some(c => c.id === m.id);
      await maybeQueueSync('medals', existed ? 'update' : 'insert', m);
    }
    setMedals(updatedMedals);

    const xd = await getXpData();
    const oldTotal = xd.totalXp || 0;
    // Add medal XP for newly unlocked medals
    let medalXpGain = 0;
    if (newlyUnlocked.length > 0) {
      const { XP_REWARDS } = await import('../config/xpConfig');
      for (const medal of newlyUnlocked) {
        medalXpGain += XP_REWARDS.medal[medal.tier] || 0;
      }
      const newTotal = oldTotal + medalXpGain;
      await saveXpData({ totalXp: newTotal });
      setXpTotal(newTotal);
    }

    const oldLevel = getLevel(oldTotal);
    const newLevel = getLevel(oldTotal + medalXpGain);

    if (newLevel > oldLevel) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLevelUp({ oldLevel, newLevel, xp: oldTotal + medalXpGain });
    }

    if (newlyUnlocked.length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNewUnlock(newlyUnlocked[0]);
      for (const medal of newlyUnlocked) {
        trackEvent('medal.unlocked', { medal_tier: medal.tier });
      }
    }
  }, [accountProfile?.founder_number]);

  // Account entitlements can arrive after offline workout data has loaded. Run
  // one evaluation when a verified founder serial appears so the medal is
  // awarded immediately, without making the user log another workout.
  useEffect(() => {
    const founderNumber = accountProfile?.founder_number || null;
    if (loading || !founderNumber || evaluatedFounderRef.current === founderNumber) return;
    evaluatedFounderRef.current = founderNumber;
    runEvaluation(workouts).catch(error => reportError(error, 'evaluate-founder-medal'));
  }, [accountProfile?.founder_number, loading, runEvaluation, workouts]);

  // Defined after runEvaluation so it can re-check medals once the auto-generated
  // cards exist — the Wrapped-milestone medals otherwise wouldn't unlock until
  // the user happened to log their next workout.
  const runAutoGenerate = useCallback(async () => {
    const w = await getWorkouts();
    const m = await getMedals();
    const x = await getXpData();
    const level = getLevel(x.totalXp || 0);
    const existing = await getWrappedCards();
    const currentTitle = await getEquippedTitle();
    const autoCards = checkAndGenerateAuto(w, m, level, existing, currentTitle);
    if (autoCards.length > 0) {
      let updated = existing;
      for (const card of autoCards) {
        updated = await saveWrappedCard(card);
        await maybeQueueSync('wrapped_cards', 'insert', card);
        await awardWrappedXp(card, existing);
      }
      setWrappedCards(updated);
      setNewWrappedCard(autoCards[autoCards.length - 1]);
      await runEvaluation(w);
      try {
        const { registerForPushNotifications } = await import('../utils/pushNotifications');
        const uid = await getCurrentUserId();
        if (uid) await registerForPushNotifications(uid);
      } catch (error) {
        reportError(error, 'auto-wrapped-notification');
      }
    }
  }, [awardWrappedXp, runEvaluation]);

  useEffect(() => {
    if (!loading) {
      runAutoGenerate().catch(error => reportError(error, 'auto-generate-wrapped'));
    }
  }, [loading, runAutoGenerate]);

  const handleTitleEarned = useCallback(async (card, existingCards) => {
    // The first title is authored by the user after card #001 is revealed.
    // Achievement titles start on later daily cards once that starter title exists.
    if (earnedTitles.length === 0) return;

    // Only earn titles from first daily wrapped each day
    const todayKey = card.periodKey || getTodayKey();
    const existingDaily = existingCards.filter(c => c.type === 'daily' && c.periodKey === todayKey);
    if (existingDaily.length > 0) return;

    const category = getCategoryForStats(card.stats || {}, workouts);
    const lastTitle = await getLastEarnedTitle();
    const title = selectTitle(category, lastTitle?.id);

    if (title) {
      const updated = [...earnedTitles.filter(earned => earned.id !== title.id), title];
      await setEarnedTitles(updated);
      await setLastEarnedTitle(title);
      setEarnedTitlesState(updated);
      setNewEarnedTitle(title);
      setPendingTitleCategory(category);
    }
  }, [workouts, earnedTitles]);

  const generateWrapped = useCallback(async (type) => {
    const w = await getWorkouts();
    const m = await getMedals();
    const x = await getXpData();
    const level = getLevel(x.totalXp || 0);
    const existing = await getWrappedCards();
    const currentTitle = await getEquippedTitle();

    let card = null;
    if (type === 'daily') card = generateDailyWrapped(w, m, level, existing, currentTitle);
    else if (type === 'weekly') card = generateWeeklyWrapped(w, m, level, existing, currentTitle);
    else if (type === 'monthly') card = generateMonthlyWrapped(w, m, level, existing, currentTitle);

    if (card) {
      const updated = await saveWrappedCard(card);
      const syncType = existing.some(existingCard => existingCard.id === card.id) ? 'update' : 'insert';
      await maybeQueueSync('wrapped_cards', syncType, card);

      const xpGain = await awardWrappedXp(card, existing);

      // If it's a new daily (first today), trigger title earning
      if (card.type === 'daily' && xpGain > 0) {
        await handleTitleEarned(card, existing);
      }

      setWrappedCards(updated);
      setNewWrappedCard(card);

      // Re-evaluate medals now that a Wrapped card exists — the Wrapped-milestone
      // medals (First Wrapped, 10/50/100) can only unlock once the card is saved,
      // and workout-time evaluation runs before that.
      await runEvaluation(w);
      trackEvent('wrapped.created', { card_type: card.type, tier_id: getCardTier(level).id });
    }
    return card;
  }, [awardWrappedXp, handleTitleEarned, runEvaluation]);

  const handleEquipTitle = useCallback(async (title) => {
    await setEquippedTitle(title);
    setEquippedTitleState(title);
    setNewEarnedTitle(null);
    setPendingTitleCategory(null);
  }, []);

  const createCustomTitle = useCallback(async (text) => {
    const trimmed = String(text || '').trim().slice(0, 28);
    if (trimmed.length < 2) return null;
    const customTitle = {
      id: `custom_${Date.now()}`,
      text: trimmed,
      category: 'custom',
      rarity: 'starter',
      custom: true,
      earnedAt: new Date().toISOString(),
    };
    const currentTitles = await getEarnedTitles();
    const updated = [...currentTitles, customTitle];
    await setEarnedTitles(updated);
    await setEquippedTitle(customTitle);
    await setLastEarnedTitle(customTitle);
    setEarnedTitlesState(updated);
    setEquippedTitleState(customTitle);
    return customTitle;
  }, []);

  const createFirstCardTitle = useCallback(async (cardId, text) => {
    const customTitle = await createCustomTitle(text);
    if (!customTitle || !cardId) return customTitle;

    const cards = await getWrappedCards();
    const card = cards.find(item => item.id === cardId);
    if (!card) return customTitle;

    const stampedCard = {
      ...card,
      userTitle: customTitle.text,
      titleStampedAt: new Date().toISOString(),
    };
    const updated = await saveWrappedCard(stampedCard);
    await maybeQueueSync('wrapped_cards', 'update', stampedCard);
    setWrappedCards(updated);
    setNewWrappedCard(current => (current?.id === cardId ? stampedCard : current));
    return customTitle;
  }, [createCustomTitle]);

  const handleDiscardTitle = useCallback(async () => {
    setNewEarnedTitle(null);
    setPendingTitleCategory(null);
  }, []);

  const dismissNewWrapped = useCallback(() => setNewWrappedCard(null), []);

  const addWorkout = useCallback(async (workout) => {
    const newWorkout = { ...workout, id: Date.now().toString(), date: new Date().toISOString() };
    const updated = await saveWorkout(newWorkout);
    await maybeQueueSync('workouts', 'insert', newWorkout);
    setWorkouts(updated);
    await runEvaluation(updated);
    trackEvent('workout.logged', {
      exercise_count: Array.isArray(workout.exercises) ? workout.exercises.length : 0,
      duration_minutes: workout.duration || 0,
    });
    return { newWorkout };
  }, [runEvaluation]);

  // Deleting "today's wrapped" must also remove the workout entries that were
  // logged today — otherwise the data survives in storage and simply gets
  // regenerated into an identical card the next time a wrapped is created,
  // making the delete look like it silently reverted itself. Medals/XP already
  // earned are left as-is (achievements stay earned, matching how the rest of
  // the app treats unlocks as permanent).
  const deleteTodayEntry = useCallback(async (cardId) => {
    const todayKey = getTodayKey();
    const allWorkouts = await getWorkouts();
    const removedWorkouts = allWorkouts.filter(w => getWorkoutDateKey(w) === todayKey);
    const remainingWorkouts = allWorkouts.filter(w => getWorkoutDateKey(w) !== todayKey);
    await saveWorkouts(remainingWorkouts);
    for (const workout of removedWorkouts) {
      await maybeQueueSync('workouts', 'delete', workout);
    }
    setWorkouts(remainingWorkouts);

    if (cardId) {
      const remainingCards = await deleteWrappedCard(cardId);
      await maybeQueueSync('wrapped_cards', 'delete', { id: cardId, type: 'daily' });
      setWrappedCards(remainingCards);
    }
  }, []);

  const updateStartingStats = useCallback(async (stats) => {
    const saved = await saveStartingStats(stats);
    setStartingStats(saved);
  }, []);

  const resetState = useCallback(() => {
    setWorkouts([]);
    setMedals([]);
    setStartingStats(null);
    setXpTotal(0);
    setFriends([]);
    setProfile(null);
    setWrappedCards([]);
    setNewWrappedCard(null);
    setEquippedTitleState(null);
    setEarnedTitlesState([]);
    setNewEarnedTitle(null);
    setPendingTitleCategory(null);
    setNewUnlock(null);
    setLevelUp(null);
  }, []);

  const dismissUnlock = useCallback(() => setNewUnlock(null), []);
  const dismissLevelUp = useCallback(() => setLevelUp(null), []);

  // Returns what actually happened so the UI can distinguish "equipped",
  // "unequipped" and "rejected because all slots are full" instead of silently
  // doing nothing when the user is already at the limit.
  const handleTogglePin = useCallback(async (medalId) => {
    const before = resolveEquippedMedals(medals);
    const wasEquipped = before.some(m => m.id === medalId);
    if (!wasEquipped && before.length >= MAX_EQUIPPED_MEDALS) {
      return { changed: false, reason: 'limit', equipped: false };
    }
    const updated = await togglePinMedal(medalId);
    setMedals(updated);
    const nowEquipped = resolveEquippedMedals(updated).some(m => m.id === medalId);
    if (nowEquipped !== wasEquipped) {
      const medalTier = MEDALS[medalId]?.tier;
      trackEvent('medal.equipped', { equipped: nowEquipped, medal_tier: medalTier || 'unknown' });
    }
    return { changed: nowEquipped !== wasEquipped, reason: null, equipped: nowEquipped };
  }, [medals]);

  // ── Friends ──

  const refreshFriends = useCallback(async () => {
    const f = await getFriends();
    setFriends(f);
  }, []);

  const handleAddFriend = useCallback(async (friendData) => {
    const result = await addFriendStorage(friendData);
    if (result) await refreshFriends();
    return result;
  }, [refreshFriends]);

  const handleRemoveFriend = useCallback(async (friendId) => {
    await removeFriendStorage(friendId);
    await refreshFriends();
  }, [refreshFriends]);

  const handleClaimReferral = useCallback(async (code) => {
    const result = await claimReferral(code);
    if (result.success) {
      const xd = await getXpData();
      const newTotal = (xd.totalXp || 0) + result.bonusXp;
      await saveXpData({ totalXp: newTotal });
      setXpTotal(newTotal);
      const p = await getProfile();
      setProfile(p);
    }
    return result;
  }, []);

  const refreshProfile = useCallback(async () => {
    const p = await getProfile();
    setProfile(p);
  }, []);

  const xpProgress = getXpProgress(xpTotal);

  // Equipping is a live display preference, so cards read this rather than the
  // medal list frozen into each Wrapped snapshot.
  const equippedMedals = useMemo(() => resolveEquippedMedals(medals), [medals]);

  return (
    <WorkoutContext.Provider value={{
      workouts, medals, equippedMedals, startingStats, loading,
      addWorkout, deleteTodayEntry, updateStartingStats,
      // Lets the dev simulator refresh the UI after it writes straight to storage.
      reloadFromStorage: loadData,
      newUnlock, dismissUnlock,
      levelUp, dismissLevelUp,
      togglePin: handleTogglePin,
      xpTotal, xpProgress,
      syncIssue,
      friends, refreshFriends,
      addFriend: handleAddFriend,
      removeFriend: handleRemoveFriend,
      profile, refreshProfile,
      claimReferral: handleClaimReferral,
      wrappedCards, setWrappedCards, generateWrapped, newWrappedCard, dismissNewWrapped,
      equippedTitle, earnedTitles, newEarnedTitle, pendingTitleCategory,
      equipTitle: handleEquipTitle, createCustomTitle, createFirstCardTitle, discardTitle: handleDiscardTitle,
      resetState,
    }}>
      {children}
    </WorkoutContext.Provider>
  );
};
