import { getWorkoutDateKey } from './dateUtils';

// Builds the detail ("back of card") data for a Wrapped from the workouts that
// actually fall inside that Wrapped's period.
//
// Exercises are stored in two shapes across app versions:
//   combined   { name, muscleGroup, weight, reps, sets }        // sets collapsed
//   individual { name, muscleGroup, sets: [{ weight, reps }] }  // per-set rows
// Both are normalised here so the detail view never has to care, and missing
// legacy fields degrade to "unknown" rather than a misleading zero.

function isIndividualSetFormat(exercise) {
  return Array.isArray(exercise?.sets);
}

function num(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** Normalise one stored exercise into { name, muscleGroup, setCount, totalReps, volume, bestWeight, setLines } */
export function normaliseExercise(exercise) {
  if (!exercise || typeof exercise !== 'object') return null;
  const name = exercise.name || 'Unknown exercise';
  const muscleGroup = exercise.muscleGroup || 'Other';

  if (exercise.muscleGroup === 'Cardio') {
    const duration = num(exercise.duration);
    const distance = num(exercise.distance);
    return {
      name,
      muscleGroup,
      isCardio: true,
      setCount: 0,
      totalReps: 0,
      volume: 0,
      bestWeight: 0,
      duration,
      distance,
      setLines: [
        duration > 0 ? `${duration} min` : null,
        distance > 0 ? `${distance} km` : null,
      ].filter(Boolean),
    };
  }

  if (isIndividualSetFormat(exercise)) {
    const rows = exercise.sets.filter(Boolean);
    let volume = 0;
    let totalReps = 0;
    let bestWeight = 0;
    const setLines = [];
    for (const row of rows) {
      const weight = num(row.weight);
      const reps = num(row.reps);
      volume += weight * reps;
      totalReps += reps;
      if (weight > bestWeight) bestWeight = weight;
      // Only render a line when there is something real to show.
      if (weight > 0 && reps > 0) setLines.push(`${weight} kg × ${reps}`);
      else if (reps > 0) setLines.push(`${reps} reps`);
    }
    return { name, muscleGroup, isCardio: false, setCount: rows.length, totalReps, volume, bestWeight, setLines };
  }

  const sets = num(exercise.sets);
  const reps = num(exercise.reps);
  const weight = num(exercise.weight);
  const setLines = [];
  if (sets > 0 && reps > 0) {
    setLines.push(weight > 0 ? `${sets} × ${reps} @ ${weight} kg` : `${sets} × ${reps}`);
  }
  return {
    name,
    muscleGroup,
    isCardio: false,
    setCount: sets,
    totalReps: sets * reps,
    volume: sets * reps * weight,
    bestWeight: weight,
    setLines,
  };
}

/** Workouts belonging to a Wrapped card's period. */
export function getWorkoutsForCard(card, workouts) {
  if (!card || !Array.isArray(workouts)) return [];
  if (card.type === 'daily' && card.periodKey) {
    return workouts.filter(w => getWorkoutDateKey(w) === card.periodKey);
  }
  const start = card.periodStart ? new Date(card.periodStart) : null;
  const end = card.periodEnd ? new Date(card.periodEnd) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  const startMs = start.getTime();
  const endExclusive = new Date(end);
  endExclusive.setDate(endExclusive.getDate() + 1);
  endExclusive.setHours(0, 0, 0, 0);
  const endMs = endExclusive.getTime();
  return workouts.filter(w => {
    const t = new Date(w.date).getTime();
    return Number.isFinite(t) && t >= startMs && t < endMs;
  });
}

/**
 * Full detail payload for the back of a card. Every number is derived from the
 * supplied workouts — nothing is invented, and absent data is reported as null
 * so the UI can omit the row instead of printing a misleading 0.
 */
export function buildWrappedDetail(card, workouts) {
  const periodWorkouts = getWorkoutsForCard(card, workouts);
  const exercises = [];
  let totalVolume = 0;
  let totalSets = 0;
  let totalReps = 0;
  let totalDuration = 0;
  let bestWeight = 0;
  let bestLift = null;

  for (const workout of periodWorkouts) {
    totalDuration += num(workout.duration);
    for (const raw of workout.exercises || []) {
      const ex = normaliseExercise(raw);
      if (!ex) continue;
      exercises.push(ex);
      totalVolume += ex.volume;
      totalSets += ex.setCount;
      totalReps += ex.totalReps;
      if (ex.bestWeight > bestWeight) {
        bestWeight = ex.bestWeight;
        bestLift = ex.name;
      }
    }
  }

  // Merge repeats of the same exercise inside one period into a single row.
  const merged = new Map();
  for (const ex of exercises) {
    const existing = merged.get(ex.name);
    if (!existing) {
      merged.set(ex.name, { ...ex, setLines: [...ex.setLines] });
      continue;
    }
    existing.setCount += ex.setCount;
    existing.totalReps += ex.totalReps;
    existing.volume += ex.volume;
    existing.bestWeight = Math.max(existing.bestWeight, ex.bestWeight);
    existing.setLines.push(...ex.setLines);
  }

  const stats = card?.stats || {};
  return {
    hasData: periodWorkouts.length > 0,
    workoutCount: periodWorkouts.length,
    exercises: [...merged.values()],
    exerciseCount: merged.size,
    // Prefer values computed from the underlying workouts; fall back to the
    // card snapshot only when the raw workouts are no longer available.
    totalVolume: totalVolume > 0 ? totalVolume : num(stats.totalVolume),
    totalSets: totalSets > 0 ? totalSets : num(stats.totalSets),
    totalReps: totalReps > 0 ? totalReps : num(stats.totalReps),
    duration: totalDuration > 0 ? totalDuration : num(stats.duration),
    bestWeight: bestWeight > 0 ? bestWeight : num(stats.bestWeight),
    bestLift: bestLift || stats.heaviestName || null,
    prs: num(stats.prs),
    streak: num(stats.streak),
    muscleGroups: Array.isArray(stats.muscleGroups) ? stats.muscleGroups : [],
  };
}

const COMMENTS = {
  pr: 'New PR logged. That is going straight on the story.',
  bigVolume: 'That is a serious amount of weight moved.',
  legs: 'Your quads would like a word tomorrow.',
  streak: 'The consistency is doing the heavy lifting here.',
  solid: 'Quiet, consistent work. It all counts.',
  light: 'Short and sharp — showing up is the hard part.',
};

/** A short, accurate comment. Only claims things the data actually supports. */
export function getDetailComment(detail) {
  if (!detail || !detail.hasData) return null;
  if (detail.prs > 0) return COMMENTS.pr;
  if (detail.totalVolume >= 10000) return COMMENTS.bigVolume;
  if (detail.muscleGroups.includes('Legs')) return COMMENTS.legs;
  if (detail.streak >= 3) return COMMENTS.streak;
  if (detail.totalSets >= 12) return COMMENTS.solid;
  return COMMENTS.light;
}

// Period cards can contain the same exercise prescription across several
// sessions. Collapse repeats while preserving how many entries contributed.
export function summarizeSetLines(lines, maxVariants = 2) {
  if (!Array.isArray(lines) || lines.length === 0) return '';
  const counts = new Map();
  lines.filter(Boolean).forEach(line => counts.set(line, (counts.get(line) || 0) + 1));
  const entries = [...counts.entries()];
  const visible = entries.slice(0, maxVariants).map(([line, count]) => (
    count > 1 ? `${line} · ${count} entries` : line
  ));
  if (entries.length > maxVariants) visible.push(`+${entries.length - maxVariants} variants`);
  return visible.join('  ·  ');
}
