// ---------------------------------------------------------------------------
// DEV-ONLY workout history simulator.
//
// Builds a realistic training history and then replays it through the SAME
// generators the live app uses (generateDailyWrapped / generateWeeklyWrapped /
// generateMonthlyWrapped / evaluateMedals / computeTotalXp) rather than faking
// card data. That means what you see in the simulator is genuinely what a real
// user would get — if a card looks wrong here, it's wrong in production too.
//
// The replay is chronological and progressive: medals, XP and level are
// recomputed after each simulated day, so early cards snapshot a low level
// (Starter tier) and later cards snapshot higher levels (Grinder → Veteran →
// Elite → Legendary). That's what makes the tier visuals observable.
// ---------------------------------------------------------------------------

import { EXERCISES } from '../data/exercises';
import {
  saveWorkouts,
  saveWrappedCards,
  saveMedals,
  saveXpData,
  getEquippedTitle,
} from './storage';
import {
  generateDailyWrapped,
  generateWeeklyWrapped,
  generateMonthlyWrapped,
} from './wrappedGenerator';
import { evaluateMedals } from './medalEvaluator';
import { computeTotalXp, getLevel, getXpForLevel } from './xpSystem';
import { TESTING_TOOLS_ENABLED } from '../config/testing';

// A simple push/pull/legs split with rest days, keyed by day-of-week.
// 0 = Sunday. Rest days are omitted deliberately so streaks stay realistic.
const SPLIT = {
  1: 'push',
  2: 'pull',
  3: 'legs',
  4: 'push',
  5: 'pull',
  6: 'cardio',
};

const GROUPS_FOR_DAY = {
  push: ['Chest', 'Shoulders', 'Arms'],
  pull: ['Back', 'Arms'],
  legs: ['Legs', 'Core'],
  cardio: ['Cardio'],
};

function pickExercises(muscleGroup, count) {
  const pool = EXERCISES.filter(e => e.muscleGroup === muscleGroup);
  return pool.slice(0, count);
}

// Progressive overload: weights creep up ~1.5% per week so PR detection,
// "improvement" scoring and volume milestones all fire naturally over time.
function progressionFactor(dayIndex) {
  return 1 + (dayIndex / 7) * 0.015;
}

function baseWeightFor(exercise) {
  const g = exercise.muscleGroup;
  if (g === 'Legs') return 90;
  if (g === 'Back') return 70;
  if (g === 'Chest') return 65;
  if (g === 'Shoulders') return 40;
  if (g === 'Arms') return 25;
  if (g === 'Core') return 20;
  return 0;
}

function roundToPlate(kg) {
  return Math.max(2.5, Math.round(kg / 2.5) * 2.5);
}

function buildWorkout(date, dayIndex, idSeed) {
  const kind = SPLIT[date.getDay()];
  if (!kind) return null; // rest day

  const groups = GROUPS_FOR_DAY[kind];
  const exercises = [];
  let cardioMinutes = 0;

  for (const group of groups) {
    const picks = pickExercises(group, group === 'Arms' ? 1 : 2);
    for (const ex of picks) {
      if (ex.muscleGroup === 'Cardio') {
        const mins = 20 + (dayIndex % 3) * 5;
        cardioMinutes += mins;
        exercises.push({
          name: ex.name,
          muscleGroup: 'Cardio',
          duration: mins,
          distance: Math.round(mins / 6),
        });
      } else {
        const base = baseWeightFor(ex);
        if (base <= 0) continue;
        exercises.push({
          name: ex.name,
          muscleGroup: ex.muscleGroup,
          weight: roundToPlate(base * progressionFactor(dayIndex)),
          reps: ex.bodyweight ? 10 : 8,
          sets: 4,
        });
      }
    }
  }

  if (exercises.length === 0) return null;

  const strengthSets = exercises.reduce(
    (s, e) => s + (e.muscleGroup === 'Cardio' ? 0 : (e.sets || 0)),
    0
  );

  return {
    id: `sim_${idSeed}`,
    date: date.toISOString(),
    mood: 3,
    duration: Math.round(strengthSets * 3 + cardioMinutes),
    cardioMinutes,
    exercises,
  };
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function mondayOf(d) {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const m = new Date(d);
  m.setDate(diff);
  m.setHours(0, 0, 0, 0);
  return m;
}

function monthIdOf(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function upsert(cards, card) {
  const i = cards.findIndex(c => c.id === card.id);
  if (i >= 0) {
    const next = [...cards];
    next[i] = card;
    return next;
  }
  return [...cards, card];
}

/**
 * Simulate `days` of training history ending today, then replay it through the
 * real generators. Returns a summary of what was produced.
 */
export async function simulateHistory(days = 30) {
  if (!TESTING_TOOLS_ENABLED) {
    return { success: false, error: 'Simulator is dev-only' };
  }

  const userTitle = await getEquippedTitle();

  const today = startOfDay(new Date());
  const start = new Date(today);
  start.setDate(start.getDate() - (days - 1));

  const workouts = [];
  let cards = [];
  let medals = [];

  for (let i = 0; i < days; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    // Train in the early evening so the day's workouts land inside the day.
    date.setHours(18, 0, 0, 0);

    // A new week began — the previous week is complete, so recap it.
    if (date.getDay() === 1 && i > 0) {
      const prevMonday = new Date(mondayOf(date));
      prevMonday.setDate(prevMonday.getDate() - 7);
      const xp = computeTotalXp(cards, medals);
      const weekly = generateWeeklyWrapped(
        workouts, medals, getLevel(xp), cards, userTitle, prevMonday
      );
      if (weekly) {
        weekly.createdAt = date.toISOString();
        cards = upsert(cards, weekly);
      }
    }

    // A new month began — recap the month that just ended.
    if (date.getDate() === 1 && i > 0) {
      const prevMonth = new Date(date);
      prevMonth.setDate(1);
      prevMonth.setMonth(prevMonth.getMonth() - 1);
      const xp = computeTotalXp(cards, medals);
      const monthly = generateMonthlyWrapped(
        workouts, medals, getLevel(xp), cards, userTitle, monthIdOf(prevMonth)
      );
      if (monthly) {
        monthly.createdAt = date.toISOString();
        cards = upsert(cards, monthly);
      }
    }

    const workout = buildWorkout(date, i, i);
    if (!workout) continue;
    workouts.push(workout);

    // Medals first, so a medal unlocked today is snapshotted onto today's card.
    const evaluated = evaluateMedals(workouts, medals, cards);
    medals = evaluated.updatedMedals;

    const xp = computeTotalXp(cards, medals);
    const daily = generateDailyWrapped(
      workouts, medals, getLevel(xp), cards, userTitle, date
    );
    if (daily) {
      daily.createdAt = date.toISOString();
      cards = upsert(cards, daily);
    }
  }

  // Final pass so medals that depend on total card count settle.
  const finalEval = evaluateMedals(workouts, medals, cards);
  medals = finalEval.updatedMedals;
  const totalXp = computeTotalXp(cards, medals);

  await saveWorkouts(workouts);
  await saveWrappedCards(cards);
  await saveMedals(medals);
  await saveXpData({ totalXp });

  return {
    success: true,
    days,
    workouts: workouts.length,
    daily: cards.filter(c => c.type === 'daily').length,
    weekly: cards.filter(c => c.type === 'weekly').length,
    monthly: cards.filter(c => c.type === 'monthly').length,
    medals: medals.filter(m => m.unlockedAt).length,
    totalXp,
    level: getLevel(totalXp),
  };
}

// One card per visual tier, so the Starter → Legendary frames/effects can be
// reviewed without grinding out the ~3 years of XP that Legendary really needs.
// Stats and layout come from the real generator; only the snapshotted level is
// forced, which is exactly the input that drives tier appearance.
const TIER_SHOWCASE_LEVELS = [3, 10, 22, 40, 60];

export async function simulateTierShowcase() {
  if (!TESTING_TOOLS_ENABLED) {
    return { success: false, error: 'Simulator is dev-only' };
  }

  const userTitle = await getEquippedTitle();
  const today = startOfDay(new Date());

  const workouts = [];
  let cards = [];
  let medals = [];

  // Walk back from today, using only real training days so every tier gets a card.
  const trainingDays = [];
  for (let back = 1; trainingDays.length < TIER_SHOWCASE_LEVELS.length && back < 40; back++) {
    const d = new Date(today);
    d.setDate(d.getDate() - back);
    d.setHours(18, 0, 0, 0);
    if (SPLIT[d.getDay()]) trainingDays.unshift(d);
  }

  TIER_SHOWCASE_LEVELS.forEach((level, idx) => {
    const date = trainingDays[idx];
    if (!date) return;

    // Scale the work so higher-tier cards also show bigger numbers.
    const w = buildWorkout(date, idx * 14, `tier_${level}`);
    if (!w) return;
    workouts.push(w);

    const evaluated = evaluateMedals(workouts, medals, cards);
    medals = evaluated.updatedMedals;

    const card = generateDailyWrapped(workouts, medals, level, cards, userTitle, date);
    if (card) {
      card.createdAt = date.toISOString();
      cards = upsert(cards, card);
    }
  });

  await saveWorkouts(workouts);
  await saveWrappedCards(cards);
  await saveMedals(medals);
  // Give the account enough XP that the header level matches the top card.
  const showcaseXp = getXpForLevel(TIER_SHOWCASE_LEVELS[TIER_SHOWCASE_LEVELS.length - 1]);
  await saveXpData({ totalXp: showcaseXp });

  return {
    success: true,
    showcase: true,
    cards: cards.length,
    levels: TIER_SHOWCASE_LEVELS,
    totalXp: showcaseXp,
    level: getLevel(showcaseXp),
  };
}
