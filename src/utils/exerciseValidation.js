import AsyncStorage from '@react-native-async-storage/async-storage';
import { EXERCISES } from '../data/exercises';
import { EXERCISE_CLASS, DEFAULT_CLASS, CLASS_CAPS, TOTAL_VOLUME_CAP } from '../config/thresholds';
import { getBestExercisesByMuscleGroup } from './calculations';

const LOG_KEY = '@myprs_flagged_entries';

function getClass(name) {
  const mg = EXERCISES.find(e => e.name === name)?.muscleGroup;
  return EXERCISE_CLASS[name] || (mg ? DEFAULT_CLASS[mg] : 'moderate_push');
}

function getCaps(exerciseName) {
  const cls = getClass(exerciseName);
  return CLASS_CAPS[cls] || CLASS_CAPS.moderate_push;
}

export function validateWeight(exerciseName, weight) {
  if (!exerciseName || weight == null || weight <= 0) return { valid: true };
  const caps = getCaps(exerciseName);
  if (weight > caps.weight.max) {
    return {
      valid: false,
      field: 'weight',
      value: weight,
      max: caps.weight.max,
      capped: caps.weight.max,
      message: `That weight seems outside realistic range for a ${caps.label}. Maximum is ${caps.weight.label} kg. Double-check your entry.`,
    };
  }
  return { valid: true };
}

export function validateReps(exerciseName, reps) {
  return { valid: true };
}

export function validateSet(exerciseName, weight, reps, sets) {
  const errors = [];
  if (sets && sets > 15) {
    errors.push({ valid: false, field: 'sets', value: sets, max: 15, message: 'Maximum 15 sets per exercise.' });
  }
  const wv = validateWeight(exerciseName, weight);
  if (!wv.valid) errors.push(wv);
  const rv = validateReps(exerciseName, reps);
  if (!rv.valid) errors.push(rv);

  if (errors.length === 0) return { valid: true };

  return { valid: false, errors };
}

export function computeCappedVolume(exerciseName, weight, reps, sets) {
  const caps = getCaps(exerciseName);
  const w = Math.min(weight || 0, caps.weight.max);
  const r = Math.min(reps || 0, caps.reps.max);
  const s = Math.min(sets || 0, 15);
  return w * r * s;
}

export function computeCappedStats(exercises) {
  let totalVolume = 0;
  let totalReps = 0;
  let bestWeight = 0;
  let heaviestName = '';
  let cappedAny = false;

  for (const ex of exercises) {
    if (ex.muscleGroup === 'Cardio') continue;
    const caps = getCaps(ex.name);
    const w = Math.min(ex.weight || 0, caps.weight.max);
    const r = Math.min(ex.reps || 0, caps.reps.max);
    const s = Math.min(ex.sets || 0, 15);
    const vol = w * r * s;
    if (w < (ex.weight || 0) || r < (ex.reps || 0) || s < (ex.sets || 0)) cappedAny = true;
    totalVolume += vol;
    totalReps += r * s;
    if (w > bestWeight) { bestWeight = w; heaviestName = ex.name; }
  }

  if (totalVolume > TOTAL_VOLUME_CAP) {
    totalVolume = TOTAL_VOLUME_CAP;
    cappedAny = true;
  }

  return { totalVolume, totalReps, bestWeight, heaviestName, cappedAny, bestExercisesByGroup: getBestExercisesByMuscleGroup(exercises) };
}

export function computeCappedCalories(totalVolume, totalReps) {
  const vol = Math.min(totalVolume, TOTAL_VOLUME_CAP);
  return vol > 0 ? Math.round(vol / 20 + totalReps * 0.5) : 0;
}

export async function logFlaggedEntry(exerciseName, field, enteredValue, threshold) {
  try {
    const raw = await AsyncStorage.getItem(LOG_KEY);
    const logs = raw ? JSON.parse(raw) : [];
    logs.push({
      exerciseName,
      field,
      enteredValue,
      threshold,
      timestamp: new Date().toISOString(),
      appVersion: '1.0',
    });
    await AsyncStorage.setItem(LOG_KEY, JSON.stringify(logs));
  } catch (e) {}
}

export async function getFlaggedLogs() {
  try {
    const raw = await AsyncStorage.getItem(LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}
