import { EXERCISES } from '../data/exercises';
import { EXERCISE_CLASS, DEFAULT_CLASS, CLASS_CAPS, TOTAL_VOLUME_CAP } from '../config/thresholds';
import { getLocalMonday, getWorkoutDateKey, parseLocalDateKey, toLocalDateKey } from './dateUtils';

function getClass(name) {
  const mg = EXERCISES.find(e => e.name === name)?.muscleGroup;
  return EXERCISE_CLASS[name] || (mg ? DEFAULT_CLASS[mg] : 'moderate_push');
}

function getCaps(name) {
  return CLASS_CAPS[getClass(name)] || CLASS_CAPS.moderate_push;
}

const getStartOfWeek = (date) => {
  return getLocalMonday(date);
};

export const getTodaysWorkout = (workouts) => {
  const today = toLocalDateKey();
  return workouts.find(w => getWorkoutDateKey(w) === today);
};

export const getWeekWorkouts = (workouts) => {
  const weekStart = getStartOfWeek(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  return workouts.filter(w => {
    const d = new Date(w.date);
    return d >= weekStart && d < weekEnd;
  });
};

export const getTodayStats = (workout) => {
  if (!workout) return null;
  let totalVolume = 0;
  let totalReps = 0;
  let totalSets = 0;
  let bestVol = 0;
  let bestName = 'N/A';
  for (const e of workout.exercises) {
    const caps = getCaps(e.name);
    const w = Math.min(e.weight || e.weight === 0 ? e.weight : 0, caps.weight.max);
    const r = Math.min(e.reps || 0, caps.reps.max);
    const s = Math.min(e.sets || 0, 15);
    const vol = w * r * s;
    totalVolume += vol;
    totalReps += r * s;
    totalSets += s;
    if (vol > bestVol) { bestVol = vol; bestName = e.name; }
  }
  totalVolume = Math.min(totalVolume, TOTAL_VOLUME_CAP);
  const uniqueMuscleGroups = [...new Set(workout.exercises.map(e => e.muscleGroup))];
  return {
    totalVolume,
    totalExercises: workout.exercises.length,
    totalSets,
    totalReps,
    uniqueMuscleGroups: uniqueMuscleGroups.length,
    muscleGroups: uniqueMuscleGroups,
    duration: workout.duration,
    cardioMinutes: workout.cardioMinutes || 0,
    bestExercise: bestName,
    bestExercisesByGroup: getBestExercisesByMuscleGroup(workout.exercises),
  };
};

export const getWeeklyStats = (workouts) => {
  if (workouts.length === 0) return null;
  let totalVolume = 0;
  for (const w of workouts) {
    for (const e of w.exercises) {
      const caps = getCaps(e.name);
      const vol = Math.min(e.weight || 0, caps.weight.max) * Math.min(e.reps || 0, caps.reps.max) * Math.min(e.sets || 0, 15);
      totalVolume += vol;
    }
  }
  totalVolume = Math.min(totalVolume, TOTAL_VOLUME_CAP);
  const totalDuration = workouts.reduce((sum, w) => sum + (w.duration || 0), 0);
  const totalCalories = workouts.reduce((sum, w) => sum + (w.caloriesBurned || 0), 0);
  const uniqueDays = [...new Set(workouts.map(getWorkoutDateKey))];
  const allMuscleGroups = [...new Set(workouts.flatMap(w => w.exercises.map(e => e.muscleGroup)))];
  const exerciseFrequency = {};
  workouts.forEach(w => w.exercises.forEach(e => {
    exerciseFrequency[e.name] = (exerciseFrequency[e.name] || 0) + 1;
  }));
  const mostFrequent = Object.entries(exerciseFrequency).sort((a, b) => b[1] - a[1]);
  const bestDay = uniqueDays.map(day => {
    const dayWorkouts = workouts.filter(w => getWorkoutDateKey(w) === day);
    const volume = dayWorkouts.reduce((sum, w) =>
      sum + w.exercises.reduce((s, e) => s + ((e.sets || 0) * (e.reps || 0) * (e.weight || 0)), 0), 0);
    return { day, volume };
  }).sort((a, b) => b.volume - a.volume)[0];
  const allExercises = workouts.flatMap(w => w.exercises);
  return {
    totalWorkouts: workouts.length,
    totalVolume,
    totalDuration,
    totalCalories,
    uniqueDays: uniqueDays.length,
    muscleGroupsHit: allMuscleGroups.length,
    muscleGroups: allMuscleGroups,
    topExercise: mostFrequent[0]?.[0] || 'N/A',
    topExerciseCount: mostFrequent[0]?.[1] || 0,
    bestDay: bestDay?.day || 'N/A',
    avgVolumePerDay: Math.round(totalVolume / uniqueDays.length),
    bestExercisesByGroup: getBestExercisesByMuscleGroup(allExercises),
  };
};

export function getBestExercisesByMuscleGroup(exercises) {
  const groups = {};
  for (const ex of exercises) {
    const mg = ex.muscleGroup || 'Other';
    if (!groups[mg]) groups[mg] = {};
    const key = ex.name;
    if (!groups[mg][key]) groups[mg][key] = { count: 0, volume: 0 };
    groups[mg][key].count += 1;
    groups[mg][key].volume += (ex.weight || 0) * (ex.reps || 0) * (ex.sets || 0);
  }
  const result = {};
  for (const [mg, exercises] of Object.entries(groups)) {
    let best = null;
    let bestScore = -1;
    for (const [name, stats] of Object.entries(exercises)) {
      const score = mg === 'Cardio' ? stats.count : stats.volume;
      if (score > bestScore) {
        bestScore = score;
        best = name;
      }
    }
    result[mg] = best;
  }
  return result;
}

export const calculateStreak = (workouts) => {
  const sorted = [...workouts]
    .map(getWorkoutDateKey)
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort()
    .reverse();
  if (sorted.length === 0) return 0;
  let streak = 0;
  const today = toLocalDateKey();
  let checkDate = parseLocalDateKey(today);
  for (const dateStr of sorted) {
    const expected = toLocalDateKey(checkDate);
    if (dateStr === expected) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (dateStr < expected) {
      break;
    }
  }
  return streak;
};

export const checkPersonalRecords = (workout, allWorkouts) => {
  return getPersonalRecordExerciseNames(workout, allWorkouts).length;
};

export const getPersonalRecordExerciseNames = (workout, allWorkouts) => {
  if (!workout?.exercises?.length) return [];
  const workoutTime = new Date(workout.date).getTime();
  const previousExercises = allWorkouts
    .filter(w => w.id !== workout.id && new Date(w.date).getTime() < workoutTime)
    .flatMap(w => w.exercises || []);

  const currentBestByName = new Map();
  for (const exercise of workout.exercises) {
    const cappedWeight = Math.min(exercise.weight || 0, getCaps(exercise.name).weight.max);
    currentBestByName.set(exercise.name, Math.max(currentBestByName.get(exercise.name) || 0, cappedWeight));
  }

  const records = [];
  for (const [name, currentBest] of currentBestByName) {
    const previous = previousExercises.filter(e => e.name === name);
    const previousBest = previous.length
      ? Math.max(...previous.map(e => Math.min(e.weight || 0, getCaps(e.name).weight.max)))
      : 0;
    if (previousBest > 0 && currentBest > previousBest) records.push(name);
  }
  return records;
};
