import AsyncStorage from '@react-native-async-storage/async-storage';
import { toLocalDateKey } from './dateUtils';

const KEYS = {
  WORKOUTS: '@myprs_workouts',
  MEDALS: '@myprs_medals',
  WEEKLY_SUMMARIES: '@myprs_weekly',
  INTRO_SEEN: '@myprs_intro_seen',
  STARTING_STATS: '@myprs_starting_stats',
  XP: '@myprs_xp',
  FRIENDS: '@myprs_friends',
  PROFILE: '@myprs_profile',
  REFERRALS: '@myprs_referrals',
  WRAPPED_CARDS: '@myprs_wrapped_cards',
  SOUND_ENABLED: '@myprs_sound_enabled',
  SOUND_PROMPTED: '@myprs_sound_prompted',
  ARCHIVE_TIP_SEEN: '@myprs_archive_tip_seen',
  SYNC_QUEUE: '@myprs_sync_queue',
  HAS_SEEN_FIRST_WRAPPED_HINTS: '@myprs_has_seen_first_wrapped_hints',
  EQUIPPED_TITLE: '@myprs_equipped_title',
  EARNED_TITLES: '@myprs_earned_titles',
  LAST_EARNED_TITLE: '@myprs_last_earned_title',
  THEME_DATA: '@myprs_theme_data',
  REMINDER: '@myprs_daily_reminder',
  BACKUP_META: '@myprs_backup_meta',
  ANALYTICS_CONSENT: '@myprs_analytics_consent',
  TRENDS_INTRO_SEEN: '@myprs_trends_intro_seen',
};

export const getTrendsIntroSeen = async () => {
  const value = await AsyncStorage.getItem(KEYS.TRENDS_INTRO_SEEN);
  return value === 'true';
};

export const setTrendsIntroSeen = async () => {
  await AsyncStorage.setItem(KEYS.TRENDS_INTRO_SEEN, 'true');
};

export const getAnalyticsConsent = async () => {
  const value = await AsyncStorage.getItem(KEYS.ANALYTICS_CONSENT);
  return value === 'true';
};

export const saveAnalyticsConsent = async (enabled) => {
  await AsyncStorage.setItem(KEYS.ANALYTICS_CONSENT, enabled ? 'true' : 'false');
  return !!enabled;
};

export const getWorkouts = async () => {
  const data = await AsyncStorage.getItem(KEYS.WORKOUTS);
  return data ? JSON.parse(data) : [];
};

export const saveWorkout = async (workout) => {
  const workouts = await getWorkouts();
  workouts.push(workout);
  await AsyncStorage.setItem(KEYS.WORKOUTS, JSON.stringify(workouts));
  return workouts;
};

export const saveWorkouts = async (workouts) => {
  await AsyncStorage.setItem(KEYS.WORKOUTS, JSON.stringify(workouts));
  return workouts;
};

export const updateWorkout = async (workoutId, updates) => {
  const workouts = await getWorkouts();
  const index = workouts.findIndex(workout => workout.id === workoutId);
  if (index < 0) return workouts;
  workouts[index] = { ...workouts[index], ...updates, id: workoutId };
  return saveWorkouts(workouts);
};

export const deleteWorkout = async (workoutId) => {
  const workouts = await getWorkouts();
  return saveWorkouts(workouts.filter(workout => workout.id !== workoutId));
};

export const getMedals = async () => {
  const data = await AsyncStorage.getItem(KEYS.MEDALS);
  return data ? JSON.parse(data) : [];
};

export const saveMedal = async (medal) => {
  const medals = await getMedals();
  const idx = medals.findIndex(m => m.id === medal.id);
  if (idx >= 0) {
    medals[idx] = { ...medals[idx], ...medal };
  } else {
    medals.push(medal);
  }
  await AsyncStorage.setItem(KEYS.MEDALS, JSON.stringify(medals));
  return medals;
};

export const saveMedals = async (medals) => {
  await AsyncStorage.setItem(KEYS.MEDALS, JSON.stringify(medals));
  return medals;
};

export const togglePinMedal = async (medalId) => {
  const medals = await getMedals();
  const idx = medals.findIndex(m => m.id === medalId);
  if (idx < 0) return medals;
  const pinnedCount = medals.filter(m => m.pinned).length;
  const isPinned = medals[idx].pinned;
  if (!isPinned && pinnedCount >= 3) return medals;
  medals[idx].pinned = !isPinned;
  await AsyncStorage.setItem(KEYS.MEDALS, JSON.stringify(medals));
  return medals;
};

export const getWeeklySummaries = async () => {
  const data = await AsyncStorage.getItem(KEYS.WEEKLY_SUMMARIES);
  return data ? JSON.parse(data) : [];
};

export const saveWeeklySummary = async (summary) => {
  const summaries = await getWeeklySummaries();
  summaries.push(summary);
  await AsyncStorage.setItem(KEYS.WEEKLY_SUMMARIES, JSON.stringify(summaries));
  return summaries;
};

export const getIntroSeen = async () => {
  const data = await AsyncStorage.getItem(KEYS.INTRO_SEEN);
  return data === 'true';
};

export const setIntroSeen = async () => {
  await AsyncStorage.setItem(KEYS.INTRO_SEEN, 'true');
};

export const getStartingStats = async () => {
  const data = await AsyncStorage.getItem(KEYS.STARTING_STATS);
  return data ? JSON.parse(data) : null;
};

export const saveStartingStats = async (stats) => {
  await AsyncStorage.setItem(KEYS.STARTING_STATS, JSON.stringify(stats));
  return stats;
};

export const getXpData = async () => {
  const data = await AsyncStorage.getItem(KEYS.XP);
  return data ? JSON.parse(data) : { totalXp: 0 };
};

export const saveXpData = async (xpData) => {
  await AsyncStorage.setItem(KEYS.XP, JSON.stringify(xpData));
  return xpData;
};

export const getWrappedCards = async () => {
  const data = await AsyncStorage.getItem(KEYS.WRAPPED_CARDS);
  return data ? JSON.parse(data) : [];
};

export const saveWrappedCard = async (card) => {
  const cards = await getWrappedCards();
  const idx = cards.findIndex(c => c.id === card.id);
  if (idx >= 0) cards[idx] = card;
  else cards.push(card);
  cards.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  await AsyncStorage.setItem(KEYS.WRAPPED_CARDS, JSON.stringify(cards));
  return cards;
};

export const saveWrappedCards = async (cards) => {
  cards.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  await AsyncStorage.setItem(KEYS.WRAPPED_CARDS, JSON.stringify(cards));
  return cards;
};

export const deleteWrappedCard = async (cardId) => {
  const cards = await getWrappedCards();
  const filtered = cards.filter(c => c.id !== cardId);
  await AsyncStorage.setItem(KEYS.WRAPPED_CARDS, JSON.stringify(filtered));
  return filtered;
};

export const lockDailyWrappedCards = async () => {
  const cards = await getWrappedCards();
  const today = toLocalDateKey();
  let changed = false;
  const updated = cards.map(c => {
    if (c.type === 'daily' && c.periodKey && c.periodKey < today && !c.locked) {
      changed = true;
      return { ...c, locked: true };
    }
    return c;
  });
  if (changed) {
    await AsyncStorage.setItem(KEYS.WRAPPED_CARDS, JSON.stringify(updated));
  }
  return updated;
};

export const getHasSeenFirstWrappedHints = async () => {
  const data = await AsyncStorage.getItem(KEYS.HAS_SEEN_FIRST_WRAPPED_HINTS);
  return data === 'true';
};

export const setHasSeenFirstWrappedHints = async () => {
  await AsyncStorage.setItem(KEYS.HAS_SEEN_FIRST_WRAPPED_HINTS, 'true');
};

export const getEquippedTitle = async () => {
  const data = await AsyncStorage.getItem(KEYS.EQUIPPED_TITLE);
  return data ? JSON.parse(data) : null;
};

export const setEquippedTitle = async (title) => {
  await AsyncStorage.setItem(KEYS.EQUIPPED_TITLE, JSON.stringify(title));
};

export const getEarnedTitles = async () => {
  const data = await AsyncStorage.getItem(KEYS.EARNED_TITLES);
  return data ? JSON.parse(data) : [];
};

export const setEarnedTitles = async (titles) => {
  await AsyncStorage.setItem(KEYS.EARNED_TITLES, JSON.stringify(titles));
};

export const getLastEarnedTitle = async () => {
  const data = await AsyncStorage.getItem(KEYS.LAST_EARNED_TITLE);
  return data ? JSON.parse(data) : null;
};

export const setLastEarnedTitle = async (title) => {
  await AsyncStorage.setItem(KEYS.LAST_EARNED_TITLE, JSON.stringify(title));
};

export const getThemeData = async () => {
  const data = await AsyncStorage.getItem(KEYS.THEME_DATA);
  return data ? JSON.parse(data) : { selectedThemeId: 'iron', unlockedThemeIds: ['iron'] };
};

export const saveThemeData = async (themeData) => {
  await AsyncStorage.setItem(KEYS.THEME_DATA, JSON.stringify(themeData));
  return themeData;
};

// When the last successful cloud backup ran, so the UI can show "Last backed up …".
export const getBackupMeta = async () => {
  const data = await AsyncStorage.getItem(KEYS.BACKUP_META);
  if (!data) return { lastBackupAt: null, counts: null };
  try {
    return JSON.parse(data);
  } catch (e) {
    return { lastBackupAt: null, counts: null };
  }
};

export const saveBackupMeta = async (meta) => {
  await AsyncStorage.setItem(KEYS.BACKUP_META, JSON.stringify(meta));
  return meta;
};

// Daily log-reminder preference, stored as { enabled, hour, minute }.
export const getReminderSettings = async () => {
  const data = await AsyncStorage.getItem(KEYS.REMINDER);
  if (!data) return { enabled: false, hour: 19, minute: 0 };
  try {
    const parsed = JSON.parse(data);
    return {
      enabled: !!parsed.enabled,
      hour: Number.isInteger(parsed.hour) ? parsed.hour : 19,
      minute: Number.isInteger(parsed.minute) ? parsed.minute : 0,
    };
  } catch (e) {
    // Corrupt preference should fall back to "off", never crash startup.
    return { enabled: false, hour: 19, minute: 0 };
  }
};

export const saveReminderSettings = async (settings) => {
  await AsyncStorage.setItem(KEYS.REMINDER, JSON.stringify(settings));
  return settings;
};

export const clearAllData = async () => {
  await AsyncStorage.multiRemove(Object.values(KEYS));
};

export const getSoundEnabled = async () => {
  const data = await AsyncStorage.getItem(KEYS.SOUND_ENABLED);
  return data === 'true';
};

export const setSoundEnabled = async (val) => {
  await AsyncStorage.setItem(KEYS.SOUND_ENABLED, val ? 'true' : 'false');
};

export const getSoundPrompted = async () => {
  const data = await AsyncStorage.getItem(KEYS.SOUND_PROMPTED);
  return data === 'true';
};

export const setSoundPrompted = async () => {
  await AsyncStorage.setItem(KEYS.SOUND_PROMPTED, 'true');
};

export const getArchiveTipSeen = async () => {
  const data = await AsyncStorage.getItem(KEYS.ARCHIVE_TIP_SEEN);
  return data === 'true';
};

export const setArchiveTipSeen = async () => {
  await AsyncStorage.setItem(KEYS.ARCHIVE_TIP_SEEN, 'true');
};
