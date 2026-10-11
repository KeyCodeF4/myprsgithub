import { pluralize } from './pluralize';
import { orderFactsByInterest } from './headline-selector';

const COMPARISON_OBJECTS = [
  { singular: 'a Boeing 737', plural: 'Boeing 737s', weightKg: 50000 },
  { singular: 'a space shuttle', plural: 'space shuttles', weightKg: 75000 },
  { singular: 'a blue whale', plural: 'blue whales', weightKg: 150000 },
  { singular: 'a shipping container', plural: 'shipping containers', weightKg: 25000 },
  { singular: 'a school bus', plural: 'school buses', weightKg: 20000 },
  { singular: 'a T-Rex', plural: 'T-Rexes', weightKg: 8000 },
  { singular: 'an African elephant', plural: 'African elephants', weightKg: 10000 },
  { singular: 'a rhinoceros', plural: 'rhinoceroses', weightKg: 6000 },
  { singular: 'a hippopotamus', plural: 'hippopotamuses', weightKg: 4000 },
  { singular: 'a small car', plural: 'small cars', weightKg: 3000 },
  { singular: 'a polar bear', plural: 'polar bears', weightKg: 1000 },
  { singular: 'a grand piano', plural: 'grand pianos', weightKg: 400 },
  { singular: 'a grizzly bear', plural: 'grizzly bears', weightKg: 300 },
  { singular: 'a vending machine', plural: 'vending machines', weightKg: 400 },
  { singular: 'a baby elephant', plural: 'baby elephants', weightKg: 500 },
  { singular: 'a motorcycle', plural: 'motorcycles', weightKg: 200 },
  { singular: 'a lion', plural: 'lions', weightKg: 200 },
  { singular: 'a dolphin', plural: 'dolphins', weightKg: 300 },
  { singular: 'a refrigerator', plural: 'refrigerators', weightKg: 150 },
  { singular: 'a kangaroo', plural: 'kangaroos', weightKg: 85 },
  { singular: 'a cement bag', plural: 'cement bags', weightKg: 50 },
  { singular: 'a human skeleton', plural: 'human skeletons', weightKg: 15 },
  { singular: 'a medium dog', plural: 'medium dogs', weightKg: 25 },
  { singular: 'a newborn baby', plural: 'newborn babies', weightKg: 3.5 },
  { singular: 'a bag of groceries', plural: 'bags of groceries', weightKg: 5 },
  { singular: 'a large pizza', plural: 'large pizzas', weightKg: 1.5 },
  { singular: 'a gallon of milk', plural: 'gallons of milk', weightKg: 3.8 },
  { singular: 'a watermelon', plural: 'watermelons', weightKg: 5 },
  { singular: 'a brick', plural: 'bricks', weightKg: 2.5 },
  { singular: 'an average adult male', plural: 'average adult males', weightKg: 70 },
];

// All-time RAW (unequipped) records. Keep these accurate and sourced — a wrong
// record makes every comparison wrong, and users will fact-check a number this
// prominent. Only add a lift here if the record is verifiable.
//   bench    — Julius Maddox, 355 kg / 782.6 lb, WRPF Hybrid Showdown III, 2021
//   squat    — Ray Williams, 490 kg / 1080 lb, raw, 2019
//   deadlift — Hafthor Bjornsson, 501 kg / 1104 lb, deadlift-only event, 2020
// Overhead press is deliberately omitted: the "record" varies by implement
// (barbell / axle / log) and no single figure is cleanly verifiable, so per
// product policy we show no comparison rather than a fabricated one.
const WORLD_RECORDS = {
  bench: { name: 'Bench Press', recordKg: 355, holder: 'Julius Maddox', year: 2021 },
  squat: { name: 'Squat', recordKg: 490, holder: 'Ray Williams', year: 2019 },
  deadlift: { name: 'Deadlift', recordKg: 501, holder: 'Hafthor Bjornsson', year: 2020 },
};

// Picking purely by smallest rounding error produced technically-accurate but
// useless comparisons like "1168 bags of groceries". A good comparison is one you
// can actually picture, so prefer small counts and score the error relative to
// the count rather than in absolute kilograms.
const MAX_COMPARISON_COUNT = 40;
const IDEAL_COMPARISON_COUNT = 15;

const DISTANCE_OBJECTS = [
  { singular: 'grain of rice', plural: 'grains of rice', metres: 0.007 },
  { singular: 'egg', plural: 'eggs', metres: 0.055 },
  { singular: 'dumbbell handle', plural: 'dumbbell handles', metres: 0.14 },
  { singular: 'banana', plural: 'bananas', metres: 0.18 },
  { singular: 'gym bench', plural: 'gym benches', metres: 1.2 },
  { singular: 'double-decker bus', plural: 'double-decker buses', metres: 11.2 },
  { singular: 'football field', plural: 'football fields', metres: 100 },
];

const CALORIE_OBJECTS = [
  { singular: 'cooked grain of rice', plural: 'cooked grains of rice', calories: 0.2 },
  { singular: 'blueberry', plural: 'blueberries', calories: 0.8 },
  { singular: 'strawberry', plural: 'strawberries', calories: 4 },
  { singular: 'almond', plural: 'almonds', calories: 7 },
  { singular: 'gummy bear', plural: 'gummy bears', calories: 8 },
  { singular: 'teaspoon of sugar', plural: 'teaspoons of sugar', calories: 16 },
  { singular: 'egg', plural: 'eggs', calories: 72 },
  { singular: 'banana', plural: 'bananas', calories: 105 },
  { singular: 'cheeseburger', plural: 'cheeseburgers', calories: 300 },
];

function pickScaleComparison(value, objects, unitKey, maxCount = 30) {
  let best = null;
  let bestScore = Infinity;
  for (const obj of objects) {
    const rawCount = value / obj[unitKey];
    const count = Math.round(rawCount);
    if (count < 1 || count > maxCount) continue;
    const error = Math.abs(rawCount - count) / Math.max(rawCount, 1);
    const countPenalty = count > 15 ? (count - 15) * 0.015 : 0;
    const score = error + countPenalty;
    if (score < bestScore) {
      best = { obj, count };
      bestScore = score;
    }
  }

  if (best) return best;
  const sorted = [...objects].sort((a, b) => a[unitKey] - b[unitKey]);
  const fallback = value < sorted[0][unitKey] ? sorted[0] : sorted[sorted.length - 1];
  return { obj: fallback, count: Math.max(1, Math.round(value / fallback[unitKey])) };
}

function comparisonText({ obj, count }) {
  return `${count} ${count === 1 ? obj.singular : obj.plural}`;
}

function getComparison(totalVolume) {
  if (!totalVolume || totalVolume <= 0) return null;

  let best = null;
  let bestScore = Infinity;

  for (const obj of COMPARISON_OBJECTS) {
    const count = totalVolume / obj.weightKg;
    const rounded = Math.round(count);
    if (rounded < 1 || rounded > MAX_COMPARISON_COUNT) continue;

    const relativeError = Math.abs(count - rounded) / count;
    const tooManyPenalty = rounded <= IDEAL_COMPARISON_COUNT
      ? 0
      : (rounded - IDEAL_COMPARISON_COUNT) * 0.02;
    const score = relativeError + tooManyPenalty;

    if (score < bestScore) {
      bestScore = score;
      best = { obj, count: rounded };
    }
  }

  // Nothing landed in range — fall back to the heaviest object for huge totals,
  // or the lightest for very small ones.
  if (!best) {
    const heaviest = COMPARISON_OBJECTS.reduce((a, b) => (a.weightKg >= b.weightKg ? a : b));
    const lightest = COMPARISON_OBJECTS.reduce((a, b) => (a.weightKg <= b.weightKg ? a : b));
    const obj = totalVolume >= heaviest.weightKg ? heaviest : lightest;
    best = { obj, count: Math.max(1, Math.round(totalVolume / obj.weightKg)) };
  }

  return best;
}

function getWorldRecordComparison(exerciseName, weight) {
  if (!weight || weight <= 0) return null;

  const lower = exerciseName?.toLowerCase() || '';
  // Only barbell variations map to a record — a dumbbell/machine/smith press is
  // not comparable to a raw barbell world record, so those get no comparison.
  // Romanian/stiff-leg deadlifts and split squats are different lifts, not lighter
  // versions of the record lift, so they get no comparison either.
  const excluded = [
    'dumbbell', 'db ', 'machine', 'smith', 'cable', 'hack',
    'romanian', 'stiff', 'bulgarian', 'split', 'goblet',
  ];
  if (excluded.some(x => lower.includes(x))) return null;

  const matches = {
    bench: ['bench press', 'bench'],
    squat: ['back squat', 'front squat', 'squat'],
    deadlift: ['conventional deadlift', 'sumo deadlift', 'deadlift'],
  };

  let matchedKey = null;
  for (const [key, names] of Object.entries(matches)) {
    if (names.some(n => lower.includes(n))) {
      matchedKey = key;
      break;
    }
  }

  if (!matchedKey) return null;
  const record = WORLD_RECORDS[matchedKey];
  if (!record) return null;

  const pct = ((weight / record.recordKg) * 100).toFixed(1);
  const diff = (record.recordKg - weight).toFixed(1);

  return {
    lift: record.name,
    recordKg: record.recordKg,
    holder: record.holder,
    year: record.year,
    percentage: pct,
    difference: diff,
  };
}

/**
 * @param rawStats period stats
 * @param preferredHeadlineId optional stored headline id, so an existing card
 *   keeps leading with the fact it was generated with
 */
export function generateFacts(rawStats, preferredHeadlineId = null) {
  const stats = rawStats || {};
  const { totalVolume = 0, totalReps = 0, totalSets = 0, bestWeight = 0, heaviestName = '', duration = 0 } = stats || {};
  const tv = totalVolume ?? 0;
  const tr = totalReps ?? 0;
  const ts = totalSets ?? 0;
  const dur = duration ?? 0;
  const facts = [];

  if (tv > 0) {
    const comp = getComparison(tv);
    const eq = comp.count === 1 ? comp.obj.singular : `${comp.count} ${comp.obj.plural}`;
    facts.push({
      id: 'volume',
      icon: '🏋️',
      label: 'Total Volume Lifted',
      value: `${tv.toLocaleString()} kg`,
      subtext: `Equivalent to lifting ${eq}!`,
    });

    const estCalories = Math.round((tv / 20) + (tr * 0.5));
    const calorieComparison = pickScaleComparison(estCalories, CALORIE_OBJECTS, 'calories');
    facts.push({
      id: 'calories',
      icon: '🔥',
      label: 'Estimated Energy Burn',
      value: `${estCalories.toLocaleString()} cal`,
      subtext: `A rough workout estimate — about ${comparisonText(calorieComparison)}.`,
    });
  }

  if (tr > 0) {
    const distMoved = tr * 0.5;
    const distanceComparison = pickScaleComparison(distMoved, DISTANCE_OBJECTS, 'metres');
    facts.push({
      id: 'distance',
      icon: '📏',
      label: 'Total Bar Distance',
      value: `${distMoved < 10 ? Number(distMoved.toFixed(1)) : Math.round(distMoved)} m`,
      subtext: `About ${comparisonText(distanceComparison)} laid end to end.`,
    });
  }

  if (dur > 0) {
    const hours = dur / 60;
    const movies = Math.round(dur / 150);
    facts.push({
      id: 'duration',
      icon: '⏱️',
      // Estimated from logged sets + cardio, not directly timed — so it's
      // labelled as approximate rather than presented as a measured figure.
      label: 'Time In The Gym (approx)',
      value: `${dur} min`,
      subtext: hours >= 2
        ? `That's ${movies} ${pluralize(movies, 'movie', 'movies')}. Could've watched The Rock's whole filmography.`
        : hours >= 1
          ? `About ${hours.toFixed(1)} ${pluralize(Math.round(hours), 'hour', 'hours')}. No pain no gain!`
          : `${dur} ${pluralize(dur, 'minute', 'minutes')} of pure grind.`,
    });
  }

  if (ts > 0) {
    facts.push({
      id: 'sets',
      icon: '📊',
      label: 'Total Sets Performed',
      value: `${ts.toLocaleString()}`,
      subtext: ts >= 50
        ? `Your poor central nervous system. Respect.`
        : ts >= 20
          ? `That's a lot of reps in the bank.`
          : `Every set counts!`,
    });
  }

  if (stats.muscleGroups?.length > 0) {
    const count = stats.muscleGroups.length;
    facts.push({
      id: 'muscleGroups',
      icon: '🎯',
      label: 'Muscle Groups Hit',
      value: `${count}`,
      subtext: count >= 5
        ? 'Full body domination!'
        : count >= 3
          ? 'Hitting the major movers.'
          : 'Focused on what matters.',
    });
  }

  if (stats.prs && stats.prs > 0) {
    facts.push({
      id: 'pr',
      icon: '📈',
      label: 'Personal Records',
      value: `${stats.prs} new ${pluralize(stats.prs, 'PR')}`,
      subtext: stats.prs >= 5
        ? 'You are on fire! Every session counts.'
        : 'Progress never stops!',
    });
  }

  if (bestWeight > 0) {
    const wr = getWorldRecordComparison(heaviestName, bestWeight);
    let heaviestSub;
    if (wr) {
      // bestWeight is a working-set weight, not a tested 1RM, so this is framed
      // as an approximate "how you stack up" line rather than a real ranking.
      const pct = Math.round(Number(wr.percentage));
      heaviestSub = bestWeight >= wr.recordKg
        ? `${heaviestName} — that is at or past the ${wr.recordKg} kg all-time raw record. Get that verified!`
        : `${heaviestName} — roughly ${pct}% of the ${wr.recordKg} kg all-time raw record (${wr.holder}, ${wr.year})`;
    } else {
      heaviestSub = heaviestName || 'Strong work!';
    }
    facts.push({
      id: 'heaviest',
      icon: '💪',
      label: 'Heaviest Lift',
      value: `${bestWeight} kg`,
      subtext: heaviestSub,
    });
  }

  if (stats.uniqueDays && stats.uniqueDays > 0) {
    facts.push({
      id: 'days',
      icon: '📅',
      label: 'Days Trained',
      value: `${stats.uniqueDays} ${pluralize(stats.uniqueDays, 'day')}`,
      subtext: stats.uniqueDays >= 5
        ? 'A near-perfect week. Your consistency is elite.'
        : stats.uniqueDays >= 3
          ? 'Consistent and steady. That\'s how gains happen.'
          : 'Quality over quantity. Every session matters.',
    });
  }

  if (stats.streak && stats.streak > 0) {
    facts.push({
      id: 'streak',
      icon: '🔥',
      label: 'Longest Streak',
      value: `${stats.streak} ${pluralize(stats.streak, 'day')}`,
      subtext: stats.streak >= 30
        ? 'Unstoppable. You are a machine!'
        : stats.streak >= 14
          ? 'Two weeks straight. The results are coming.'
          : 'Building the habit. Keep showing up!',
    });
  }

  if (stats.topExercise) {
    facts.push({
      id: 'topExercise',
      icon: '⭐',
      label: 'Most Trained Exercise',
      value: stats.topExercise,
      subtext: `Done ${stats.topExerciseCount || ''} ${pluralize(stats.topExerciseCount || 0, 'time', 'times')}. Leg day energy!`,
    });
  }

  if (tv === 0 && !stats.streak && !stats.prs) {
    facts.push({
      id: 'start',
      icon: '🚀',
      label: 'Getting Started',
      value: 'First steps',
      subtext: 'Every champion starts somewhere! Your journey begins now.',
    });
  }

  // Every fact above is emitted only when its underlying value is real and
  // non-zero, so reordering can never surface a fabricated statistic — it just
  // decides which genuine one leads.
  return orderFactsByInterest(facts, stats, preferredHeadlineId);
}
