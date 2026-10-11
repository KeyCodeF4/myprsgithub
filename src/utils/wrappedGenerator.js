import { getTodayStats, getWeeklyStats, calculateStreak, checkPersonalRecords, getBestExercisesByMuscleGroup } from './calculations';
import { scoreCandidateStats, getHeadlineStats, getFallbackStats } from './statScorer';
import { generateFacts } from './wrappedFacts';
import { selectHeadlineFactId } from './headline-selector';
import { getCardTier } from '../config/cardTiers';
import { getLocalMonday, getLocalMonthKey, getLocalMonthRange, getLocalWeekKey, getWorkoutDateKey, parseLocalDateKey, startOfLocalDay, toLocalDateKey } from './dateUtils';

function getMonday(date) {
  return getLocalMonday(date);
}

// Callers pass the equipped title inconsistently — the wizard hands over a
// string, while the context and dev simulator hand over the whole title record.
// Cards must snapshot a plain string, otherwise anything that renders
// card.userTitle directly crashes with "Objects are not valid as a React child".
function titleText(title) {
  if (!title) return null;
  if (typeof title === 'string') return title;
  // `text` is the current field; `name` is tolerated for older//alternate records.
  if (typeof title.text === 'string') return title.text;
  if (typeof title.name === 'string') return title.name;
  return null;
}

export function getCurrentWeekId() {
  return weekIdOf(new Date());
}

export function getCurrentMonthId() {
  return getLocalMonthKey();
}

// Period keys are built from LOCAL calendar dates. Using toISOString() here would
// convert local midnight to UTC and, for anyone west of UTC, name the week after
// the preceding Sunday — which then parses back to the wrong week entirely.
function parseDateKey(key) {
  return parseLocalDateKey(key);
}

function weekIdOf(date) {
  return getLocalWeekKey(date);
}

function monthIdOf(date) {
  return getLocalMonthKey(date);
}

function getPreviousWeekMonday() {
  const m = getMonday(new Date());
  m.setDate(m.getDate() - 7);
  return m;
}

function getPreviousMonthId() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return monthIdOf(d);
}

export function getCurrentPeriodKey(type) {
  if (type === 'daily') return toLocalDateKey();
  if (type === 'weekly') return getCurrentWeekId();
  if (type === 'monthly') return getCurrentMonthId();
  return '';
}

export function formatPeriod(type, periodStart, periodEnd) {
  if (type === 'daily') {
    return new Date(periodStart).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  }
  if (type === 'weekly') {
    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endLabel = end.toLocaleDateString('en-US', {
      ...(start.getMonth() !== end.getMonth() ? { month: 'short' } : {}),
      day: 'numeric',
    });
    return `Week of ${startLabel}–${endLabel}`;
  }
  if (type === 'monthly') {
    const d = new Date(periodStart);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  return '';
}

function getWeekEnd(monday) {
  const d = new Date(monday);
  d.setDate(d.getDate() + 6);
  return d;
}

function getMonthRange(year, month) {
  return getLocalMonthRange(`${year}-${String(month).padStart(2, '0')}`);
}

function filterWorkoutsByRange(workouts, start, end) {
  const s = start.getTime();
  const endExclusive = new Date(end);
  endExclusive.setDate(endExclusive.getDate() + 1);
  endExclusive.setHours(0, 0, 0, 0);
  const e = endExclusive.getTime();
  return workouts.filter(w => {
    const t = new Date(w.date).getTime();
    return t >= s && t < e;
  });
}

function computePeriodStats(workouts, periodStart, periodEnd) {
  const filtered = filterWorkoutsByRange(workouts, periodStart, periodEnd);
  if (filtered.length === 0) return null;

  let totalVolume = 0;
  let totalSets = 0;
  let totalReps = 0;
  let bestWeight = 0;
  let heaviestName = '';
  const muscleSet = new Set();
  let totalDuration = 0;
  let prCount = 0;

  for (const w of filtered) {
    totalDuration += w.duration || 0;
    for (const e of w.exercises) {
      const s = e.sets || 0;
      const r = e.reps || 0;
      const vol = s * r * (e.weight || 0);
      totalVolume += vol;
      totalSets += s;
      totalReps += s * r;
      if (e.muscleGroup) muscleSet.add(e.muscleGroup);
      const weight = e.weight || 0;
      if (weight > bestWeight) {
        bestWeight = weight;
        heaviestName = e.name;
      }
    }
  }

  const streak = calculateStreak(workouts);

  for (const w of filtered) {
    prCount += checkPersonalRecords(w, workouts);
  }

  const uniqueDays = new Set(filtered.map(getWorkoutDateKey)).size;
  const allExercises = filtered.flatMap(w => w.exercises);

  return {
    totalWorkouts: filtered.length,
    totalVolume,
    totalSets,
    totalReps,
    bestWeight,
    heaviestName,
    muscleGroups: [...muscleSet],
    uniqueMuscleGroups: muscleSet.size,
    duration: totalDuration,
    streak,
    prs: prCount,
    uniqueDays,
    allTimeWorkouts: workouts.length,
    bestExercisesByGroup: getBestExercisesByMuscleGroup(allExercises),
    allTimeVolume: workouts.reduce((sum, w) => sum + w.exercises.reduce((s, e) => s + (e.sets || 0) * (e.reps || 0) * (e.weight || 0), 0), 0),
    allTimeSets: workouts.reduce((sum, w) => sum + w.exercises.reduce((s, e) => s + (e.sets || 0), 0), 0),
    allTimeReps: workouts.reduce((sum, w) => sum + w.exercises.reduce((s, e) => s + (e.sets || 0) * (e.reps || 0), 0), 0),
  };
}

function computePreviousPeriod(workouts, periodStart, periodEnd, type) {
  const currentStart = new Date(periodStart);
  const currentEnd = new Date(periodEnd);
  const span = currentEnd.getTime() - currentStart.getTime();
  const prevStart = new Date(currentStart.getTime() - span - 1);
  const prevEnd = new Date(currentStart.getTime() - 1);
  return computePeriodStats(workouts, prevStart, prevEnd) || {};
}

// targetDate lets a daily card be produced for a past day (used by the dev
// simulator to build a realistic history). Live usage passes nothing and keeps
// the existing "today" behaviour untouched.
export function generateDailyWrapped(workouts, medals, level, existingCards, userTitle, targetDate) {
  const now = targetDate ? new Date(targetDate) : new Date();
  const todayStart = startOfLocalDay(now);
  const todayEnd = new Date(todayStart);

  const periodKey = targetDate ? toLocalDateKey(todayStart) : getCurrentPeriodKey('daily');
  const existing = existingCards.find(c => c.periodKey === periodKey && c.type === 'daily' && !c.locked);

  const stats = computePeriodStats(workouts, todayStart, todayEnd);
  if (!stats) return null;

  const previousDay = new Date(todayStart);
  previousDay.setDate(previousDay.getDate() - 1);
  const prevStats = computePeriodStats(workouts, previousDay, previousDay);

  const ranked = scoreCandidateStats({
    currentStats: stats,
    previousStats: prevStats,
    medals,
  });

  const headline = getHeadlineStats(ranked, 2);
  const fallback = getFallbackStats(stats);

  if (existing) {
    return {
      ...existing,
      stats,
      headlineStat: headline.length > 0 ? headline[0] : fallback[0],
      secondaryStats: headline.slice(1),
      rankedStats: ranked,
      medals: medals.filter(m => m.unlockedAt),
      level,
      tier: getCardTier(level),
      workoutCount: stats.totalWorkouts,
      totalVolume: stats.totalVolume,
      createdAt: new Date().toISOString(),
      // Snapshot the leading fact so this card always reproduces the same headline.
      headlineFactId: selectHeadlineFactId(generateFacts(stats).map(f => f.id), stats, periodKey),
      userTitle: titleText(existing.userTitle) || titleText(userTitle) || null,
    };
  }

  return {
    id: `daily_${periodKey}`,
    periodKey,
    type: 'daily',
    cardNumber: existingCards.filter(c => c.type === 'daily').length + 1,
    title: formatPeriod('daily', todayStart, todayEnd),
    periodStart: todayStart.toISOString(),
    periodEnd: todayEnd.toISOString(),
    stats,
    headlineStat: headline.length > 0 ? headline[0] : fallback[0],
    secondaryStats: headline.slice(1),
    rankedStats: ranked,
    medals: medals.filter(m => m.unlockedAt),
    level,
    tier: getCardTier(level),
    workoutCount: stats.totalWorkouts,
    totalVolume: stats.totalVolume,
    createdAt: new Date().toISOString(),
    // Snapshot the leading fact so this card always reproduces the same headline.
    headlineFactId: selectHeadlineFactId(generateFacts(stats).map(f => f.id), stats, periodKey),
    userTitle: titleText(userTitle) || null,
  };
}

// Weekly/monthly Wrappeds summarise a period that has FINISHED. Passing an
// explicit period lets the auto-generator back-fill periods that were missed
// because the app happened not to be opened on the boundary day.
export function generateWeeklyWrapped(workouts, medals, level, existingCards, userTitle, targetMonday) {
  const monday = targetMonday
    ? getMonday(typeof targetMonday === 'string' ? parseDateKey(targetMonday) : new Date(targetMonday))
    : getPreviousWeekMonday();
  const periodKey = weekIdOf(monday);
  if (existingCards.some(c => c.periodKey === periodKey && c.type === 'weekly')) return null;

  const sunday = getWeekEnd(monday);

  const stats = computePeriodStats(workouts, monday, sunday);
  if (!stats || stats.totalWorkouts === 0) return null;

  const prevStart = new Date(monday);
  prevStart.setDate(prevStart.getDate() - 7);
  const prevEnd = new Date(sunday);
  prevEnd.setDate(prevEnd.getDate() - 7);
  const prevStats = computePeriodStats(workouts, prevStart, prevEnd);

  const ranked = scoreCandidateStats({
    currentStats: stats,
    previousStats: prevStats || {},
    medals,
  });

  const headline = getHeadlineStats(ranked, 2);
  const fallback = getFallbackStats(stats);

  return {
    id: `weekly_${periodKey}`,
    periodKey,
    type: 'weekly',
    cardNumber: existingCards.filter(c => c.type === 'weekly').length + 1,
    title: formatPeriod('weekly', monday, sunday),
    periodStart: monday.toISOString(),
    periodEnd: sunday.toISOString(),
    stats,
    headlineStat: headline.length > 0 ? headline[0] : fallback[0],
    secondaryStats: headline.slice(1),
    rankedStats: ranked,
    medals: medals.filter(m => m.unlockedAt),
    level,
    tier: getCardTier(level),
    workoutCount: stats.totalWorkouts,
    totalVolume: stats.totalVolume,
    createdAt: new Date().toISOString(),
    // Snapshot the leading fact so this card always reproduces the same headline.
    headlineFactId: selectHeadlineFactId(generateFacts(stats).map(f => f.id), stats, periodKey),
    userTitle: titleText(userTitle) || null,
  };
}

export function generateMonthlyWrapped(workouts, medals, level, existingCards, userTitle, targetMonthId) {
  const periodKey = targetMonthId || getPreviousMonthId();
  if (existingCards.some(c => c.periodKey === periodKey && c.type === 'monthly')) return null;

  const [year, month] = periodKey.split('-').map(Number);
  const { start, end } = getMonthRange(year, month);

  const stats = computePeriodStats(workouts, start, end);
  if (!stats || stats.totalWorkouts === 0) return null;

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const { start: prevStart, end: prevEnd } = getMonthRange(prevYear, prevMonth);
  const prevStats = computePeriodStats(workouts, prevStart, prevEnd);

  const ranked = scoreCandidateStats({
    currentStats: stats,
    previousStats: prevStats || {},
    medals,
  });

  const headline = getHeadlineStats(ranked, 2);
  const fallback = getFallbackStats(stats);

  return {
    id: `monthly_${periodKey}`,
    periodKey,
    type: 'monthly',
    cardNumber: existingCards.filter(c => c.type === 'monthly').length + 1,
    title: formatPeriod('monthly', start, end),
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    stats,
    headlineStat: headline.length > 0 ? headline[0] : fallback[0],
    secondaryStats: headline.slice(1),
    rankedStats: ranked,
    medals: medals.filter(m => m.unlockedAt),
    level,
    tier: getCardTier(level),
    workoutCount: stats.totalWorkouts,
    totalVolume: stats.totalVolume,
    createdAt: new Date().toISOString(),
    // Snapshot the leading fact so this card always reproduces the same headline.
    headlineFactId: selectHeadlineFactId(generateFacts(stats).map(f => f.id), stats, periodKey),
    userTitle: titleText(userTitle) || null,
  };
}

// Cap how far back we'll catch up, so a user returning after a long break gets a
// couple of recent recaps rather than a wall of cards.
const MAX_BACKFILL = 3;

// Completed periods that contain workouts but have no Wrapped card yet. This
// replaces the old "only run on Sunday / the 1st" checks, which silently skipped
// the period forever if the app wasn't opened on that exact day.
export function getMissingWeeklyPeriods(workouts, existingCards) {
  const currentWeekId = weekIdOf(new Date());
  const done = new Set(existingCards.filter(c => c.type === 'weekly').map(c => c.periodKey));
  const ids = new Set();
  for (const w of workouts) {
    const id = weekIdOf(new Date(w.date));
    if (id !== currentWeekId && !done.has(id)) ids.add(id);
  }
  return [...ids].sort().slice(-MAX_BACKFILL);
}

export function getMissingMonthlyPeriods(workouts, existingCards) {
  const currentMonthId = monthIdOf(new Date());
  const done = new Set(existingCards.filter(c => c.type === 'monthly').map(c => c.periodKey));
  const ids = new Set();
  for (const w of workouts) {
    const id = monthIdOf(new Date(w.date));
    if (id !== currentMonthId && !done.has(id)) ids.add(id);
  }
  return [...ids].sort().slice(-MAX_BACKFILL);
}

export function checkAndGenerateAuto(workouts, medals, level, existingCards, userTitle) {
  const results = [];
  // Track cards as we go so a batch run can't produce duplicates for one period.
  let seen = [...existingCards];

  for (const weekId of getMissingWeeklyPeriods(workouts, existingCards)) {
    const card = generateWeeklyWrapped(workouts, medals, level, seen, userTitle, weekId);
    if (card) { results.push(card); seen = [...seen, card]; }
  }

  for (const monthId of getMissingMonthlyPeriods(workouts, existingCards)) {
    const card = generateMonthlyWrapped(workouts, medals, level, seen, userTitle, monthId);
    if (card) { results.push(card); seen = [...seen, card]; }
  }

  return results;
}
