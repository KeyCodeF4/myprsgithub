import { MEDALS } from '../data/medalsConfig';
import { calculateStreak, checkPersonalRecords, getPersonalRecordExerciseNames } from './calculations';
import { getLocalWeekRange, getWorkoutDateKey } from './dateUtils';

function getWeekRange() {
  return getLocalWeekRange();
}

export function evaluateMedals(workouts, existingMedals, wrappedCards = [], entitlements = {}) {
  if (!workouts) return { newlyUnlocked: [], updatedMedals: existingMedals || [] };

  const sortedDates = [...new Set(workouts.map(getWorkoutDateKey))].sort();
  const totalWorkouts = workouts.length;
  const streak = calculateStreak(workouts);

  let totalVolume = 0;
  let totalExercises = 0;
  let bigSessions = 0;
  let hasEarlyBird = false;
  let hasMidnight = false;
  let hasMarathon = false;
  const weekRange = getWeekRange();
  const weekWorkouts = workouts.filter(w => {
    const d = new Date(w.date);
    return d >= weekRange.start && d < weekRange.end;
  });
  const weeklyMuscleSets = new Set();

  for (const w of workouts) {
    const hour = new Date(w.date).getHours();
    const min = new Date(w.date).getMinutes();
    if (hour === 5) hasEarlyBird = true;
    if (hour === 0 && min >= 0 && min <= 59) hasMidnight = true;
    if ((w.duration || 0) >= 120) hasMarathon = true;
    if (w.exercises.length >= 4) bigSessions++;

    for (const e of w.exercises) {
      totalVolume += (e.weight || 0) * (e.reps || 0) * (e.sets || 0);
      totalExercises++;
    }
  }

  for (const w of weekWorkouts) {
    for (const e of w.exercises) {
      weeklyMuscleSets.add(e.muscleGroup);
    }
  }

  const weeklyMuscleGroups = weeklyMuscleSets.size;
  // "Hit every muscle group" should mean the six actual muscle groups — Cardio
  // is a training type, not a muscle group, and counting it let the medal unlock
  // while a real group (usually Core) was still missing.
  const STRENGTH_GROUPS = ['Chest', 'Back', 'Arms', 'Shoulders', 'Legs', 'Core'];
  const weeklyStrengthGroups = STRENGTH_GROUPS.filter(g => weeklyMuscleSets.has(g)).length;

  const lastWorkout = workouts[workouts.length - 1];
  const prCount = lastWorkout ? checkPersonalRecords(lastWorkout, workouts) : 0;
  const hasPR = prCount > 0;
  const prExerciseNames = lastWorkout && hasPR
    ? getPersonalRecordExerciseNames(lastWorkout, workouts)
    : [];

  const bigThreePR = prExerciseNames.some(name =>
    ['bench press', 'squat', 'deadlift', 'overhead press', 'shoulder press', 'ohp']
      .some(kw => name.toLowerCase().includes(kw))
  );

  // The "Wrapped" milestone medals are about Wrapped cards completed, which is a
  // different number from workouts logged (several workouts can merge into one
  // daily Wrapped). Counting distinct cards keeps those medals honest.
  const totalWrappeds = Array.isArray(wrappedCards) ? wrappedCards.length : 0;

  const ctx = {
    totalWorkouts,
    totalWrappeds,
    streak,
    totalVolume,
    totalExercises,
    bigSessions,
    hasEarlyBird,
    hasMidnight,
    hasMarathon,
    weeklyMuscleGroups,
    weeklyMuscleGroupCount: weeklyStrengthGroups,
    hasPR: bigThreePR,
    prCount,
    founderNumber: entitlements.founderNumber || null,
  };

  const existingMap = {};
  for (const m of (existingMedals || [])) {
    existingMap[m.id] = m;
  }

  const newlyUnlocked = [];
  const updatedMedals = [];

  for (const [id, config] of Object.entries(MEDALS)) {
    const existing = existingMap[id];
    const alreadyUnlocked = existing && existing.unlockedAt;
    const isNowUnlocked = config.condition(ctx);

    const prog = config.progress ? config.progress(ctx) : null;

    const medalState = {
      id,
      unlockedAt: alreadyUnlocked ? existing.unlockedAt : (isNowUnlocked && !alreadyUnlocked ? new Date().toISOString() : null),
      progressCurrent: prog ? prog.current : 0,
      progressTarget: prog ? prog.target : 1,
      pinned: existing ? existing.pinned : false,
      serialNumber: id === 'foundingLifter'
        ? (existing?.serialNumber || ctx.founderNumber || null)
        : undefined,
    };

    if (isNowUnlocked && !alreadyUnlocked) {
      medalState.unlockedAt = new Date().toISOString();
      newlyUnlocked.push({ ...medalState, ...config });
    }

    updatedMedals.push(medalState);
  }

  return { newlyUnlocked, updatedMedals };
}
