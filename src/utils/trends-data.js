import { toLocalDateKey } from './dateUtils';

const DAY_MS = 24 * 60 * 60 * 1000;

export const TREND_RANGES = {
  week: { days: 7, buckets: 7 },
  month: { days: 30, buckets: 5 },
  year: { days: 365, buckets: 12 },
};

const validNumber = value => Number.isFinite(Number(value)) ? Number(value) : 0;

export function exerciseVolume(exercise) {
  if (!exercise || exercise.muscleGroup === 'Cardio') return 0;
  if (Array.isArray(exercise.sets)) {
    return exercise.sets.reduce((total, set) => total + validNumber(set.weight) * validNumber(set.reps), 0);
  }
  return validNumber(exercise.weight) * validNumber(exercise.reps) * validNumber(exercise.sets);
}

export function exerciseEstimated1RM(exercise) {
  if (!exercise || exercise.muscleGroup === 'Cardio') return 0;
  const estimates = Array.isArray(exercise.sets)
    ? exercise.sets.map(set => validNumber(set.weight) * (1 + validNumber(set.reps) / 30))
    : [validNumber(exercise.weight) * (1 + validNumber(exercise.reps) / 30)];
  return Math.max(0, ...estimates);
}

function workoutDate(workout) {
  const date = new Date(workout?.date || workout?.createdAt || 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function bucketLabel(date, range) {
  if (range === 'year') return date.toLocaleDateString('en-GB', { month: 'short' }).slice(0, 1);
  return date.toLocaleDateString('en-GB', { weekday: range === 'week' ? 'short' : undefined, day: range === 'month' ? 'numeric' : undefined });
}

function makeBuckets(range, now) {
  const config = TREND_RANGES[range] || TREND_RANGES.month;
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(end.getTime() - (config.days - 1) * DAY_MS);
  start.setHours(0, 0, 0, 0);
  const span = (end.getTime() - start.getTime() + 1) / config.buckets;
  return Array.from({ length: config.buckets }, (_, index) => {
    const bucketStart = new Date(start.getTime() + span * index);
    const bucketEnd = new Date(index === config.buckets - 1 ? end.getTime() : start.getTime() + span * (index + 1) - 1);
    return {
      start: bucketStart,
      end: bucketEnd,
      label: bucketLabel(bucketStart, range),
      volume: 0,
      e1rm: 0,
      workoutDays: new Set(),
    };
  });
}

export function buildTrendData(workouts = [], range = 'month', now = new Date()) {
  const buckets = makeBuckets(range, now);
  const first = buckets[0].start.getTime();
  const last = buckets[buckets.length - 1].end.getTime();
  const inRange = workouts
    .map(workout => ({ workout, date: workoutDate(workout) }))
    .filter(item => item.date && item.date.getTime() >= first && item.date.getTime() <= last)
    .sort((a, b) => a.date - b.date);

  const muscles = {};
  const activeDays = new Set();
  let totalVolume = 0;
  let bestE1RM = 0;
  let totalMinutes = 0;

  inRange.forEach(({ workout, date }) => {
    const bucket = buckets.find(item => date >= item.start && date <= item.end) || buckets[buckets.length - 1];
    const dateKey = toLocalDateKey(date);
    activeDays.add(dateKey);
    bucket.workoutDays.add(dateKey);
    totalMinutes += validNumber(workout.duration);
    (workout.exercises || []).forEach(exercise => {
      const volume = exerciseVolume(exercise);
      const e1rm = exerciseEstimated1RM(exercise);
      totalVolume += volume;
      bucket.volume += volume;
      bucket.e1rm = Math.max(bucket.e1rm, e1rm);
      bestE1RM = Math.max(bestE1RM, e1rm);
      if (exercise.muscleGroup && exercise.muscleGroup !== 'Cardio') {
        muscles[exercise.muscleGroup] = (muscles[exercise.muscleGroup] || 0) + Math.max(volume, validNumber(exercise.sets));
      }
    });
  });

  const lifetimeBest = {};
  const prs = [];
  workouts
    .map(workout => ({ workout, date: workoutDate(workout) }))
    .filter(item => item.date && item.date <= new Date(now))
    .sort((a, b) => a.date - b.date)
    .forEach(({ workout, date }) => {
      (workout.exercises || []).forEach(exercise => {
        const estimate = exerciseEstimated1RM(exercise);
        if (!estimate || estimate <= (lifetimeBest[exercise.name] || 0)) return;
        lifetimeBest[exercise.name] = estimate;
        if (date.getTime() >= first) {
          prs.push({
            id: `${workout.id || date.getTime()}-${exercise.name}`,
            exercise: exercise.name,
            value: Math.round(estimate),
            date: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
          });
        }
      });
    });

  const muscleGroups = Object.entries(muscles)
    .map(([name, score]) => ({ name, score }))
    .sort((a, b) => b.score - a.score);
  const maxMuscleScore = muscleGroups[0]?.score || 1;

  return {
    buckets: buckets.map(bucket => ({
      label: bucket.label,
      volume: Math.round(bucket.volume),
      e1rm: Math.round(bucket.e1rm),
      frequency: bucket.workoutDays.size,
    })),
    summary: {
      workouts: inRange.length,
      activeDays: activeDays.size,
      totalVolume: Math.round(totalVolume),
      bestE1RM: Math.round(bestE1RM),
      totalMinutes: Math.round(totalMinutes),
    },
    muscleGroups: muscleGroups.map(group => ({ ...group, proportion: group.score / maxMuscleScore })),
    prs: prs.slice(-8).reverse(),
  };
}

