// Deterministic headline selection.
//
// Cards used to lead with "time in the gym" or "total volume" almost every time,
// because facts were emitted in a fixed authoring order and the first one won.
// This ranks the genuinely-available facts by how interesting they are, so a PR
// or a streak milestone outranks a routine volume number — while staying a pure
// function of the stats object, so the same Wrapped always picks the same
// headline (no Math.random, no Date.now, stable across re-renders).

const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 365];

// Base weights. Rare/impressive facts score high; the two that previously
// dominated (duration, volume) sit deliberately low so they surface only when
// nothing more interesting exists.
const BASE_SCORES = {
  pr: 1000,
  streak: 560,
  // heaviest and volume sit deliberately close together. Which one leads is then
  // decided by MAGNITUDE (below) rather than a fixed ranking — otherwise
  // "heaviest lift" beat "total volume" on literally every strength day, because
  // any non-zero best weight outscored any volume.
  heaviest: 600,
  volume: 580,
  topExercise: 500,
  muscleGroups: 450,
  days: 430,
  reps: 340,
  sets: 300,
  calories: 240,
  distance: 200,
  duration: 150,
  start: 1, // pure fallback for an empty Wrapped
};

// Reference points that map a real value onto a 0–200 "how impressive is this"
// bonus, so a genuinely heavy single beats a routine volume day and a huge
// volume day beats a routine top set.
const IMPRESSIVE_AT = {
  heaviest: 200,   // kg on the bar
  volume: 15000,   // kg moved in the period
  reps: 400,
  sets: 40,
  duration: 150,   // minutes
};

function magnitudeBonus(factId, value) {
  const reference = IMPRESSIVE_AT[factId];
  if (!reference || value <= 0) return 0;
  return Math.min(200, (value / reference) * 200);
}

// Small stable string hash — used only to break ties between candidates that
// are already comparably interesting. Same input always yields the same result,
// so a given Wrapped never changes its headline between renders.
function stableHash(seed) {
  const text = String(seed || '');
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

// Fixed order used to break score ties, so ranking is fully deterministic.
const TIE_BREAK_ORDER = [
  'pr', 'heaviest', 'streak', 'topExercise', 'muscleGroups', 'days',
  'volume', 'reps', 'sets', 'calories', 'distance', 'duration', 'start',
];

function num(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * Bonus applied on top of the base score when the underlying data is unusually
 * impressive. Kept modest so a headline never overstates what happened.
 */
export function scoreFact(factId, stats = {}) {
  const s = stats || {};
  const base = BASE_SCORES[factId];
  if (base === undefined) return 0;

  let score = base;

  switch (factId) {
    case 'pr': {
      const prs = num(s.prs);
      if (prs <= 0) return 0;
      score += Math.min(prs, 5) * 60;
      break;
    }
    case 'streak': {
      const streak = num(s.streak);
      if (streak < 2) return 0; // a 1-day "streak" is not a story
      if (STREAK_MILESTONES.includes(streak)) score += 320;
      score += Math.min(streak, 30) * 4;
      break;
    }
    case 'heaviest': {
      const best = num(s.bestWeight);
      if (best <= 0) return 0;
      score += magnitudeBonus('heaviest', best);
      // A named lift reads far better than a bare number.
      if (s.heaviestName) score += 25;
      break;
    }
    case 'topExercise': {
      if (!s.topExercise) return 0;
      const count = num(s.topExerciseCount);
      if (count < 2) return 0; // "most trained" needs repetition to mean anything
      score += Math.min(count, 10) * 12;
      break;
    }
    case 'muscleGroups': {
      const groups = num(s.uniqueMuscleGroups) || (Array.isArray(s.muscleGroups) ? s.muscleGroups.length : 0);
      if (groups < 3) return 0;
      score += groups * 25;
      break;
    }
    case 'days': {
      const days = num(s.uniqueDays);
      if (days < 2) return 0; // only meaningful on weekly/monthly cards
      score += days * 30;
      break;
    }
    case 'volume': {
      const volume = num(s.totalVolume);
      if (volume <= 0) return 0;
      score += magnitudeBonus('volume', volume);
      break;
    }
    case 'reps': {
      const reps = num(s.totalReps);
      if (reps <= 0) return 0;
      score += magnitudeBonus('reps', reps);
      break;
    }
    case 'sets': {
      const sets = num(s.totalSets);
      if (sets <= 0) return 0;
      score += magnitudeBonus('sets', sets);
      break;
    }
    case 'calories':
      if (num(s.totalVolume) <= 0) return 0;
      break;
    case 'distance':
      if (num(s.totalReps) <= 0) return 0;
      break;
    case 'duration': {
      const duration = num(s.duration);
      if (duration <= 0) return 0;
      score += magnitudeBonus('duration', duration);
      break;
    }
    case 'start':
      break;
    default:
      return 0;
  }

  return score;
}

/**
 * Rank fact ids best-first. Only ids backed by real, non-zero data are returned,
 * so a headline can never show a fabricated or empty statistic.
 */
export function rankFactIds(factIds, stats = {}) {
  const ids = Array.isArray(factIds) ? factIds : [];
  return ids
    .map(id => ({ id, score: scoreFact(id, stats), order: TIE_BREAK_ORDER.indexOf(id) }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aOrder = a.order < 0 ? Number.MAX_SAFE_INTEGER : a.order;
      const bOrder = b.order < 0 ? Number.MAX_SAFE_INTEGER : b.order;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return String(a.id).localeCompare(String(b.id));
    })
    .map(entry => entry.id);
}

// Candidates scoring within this fraction of the leader are treated as equally
// good headlines, so which one leads can vary between Wrappeds.
const TIE_BAND = 0.12;

/**
 * The single best headline fact id, or null when there is no real data.
 *
 * `seed` (the card's periodKey) rotates between candidates that are genuinely
 * close in interest, so a run of similar sessions doesn't show "Heaviest Lift"
 * every single day. It is a pure hash of the seed — the same Wrapped always
 * resolves to the same headline, it never reshuffles on re-render.
 */
export function selectHeadlineFactId(factIds, stats = {}, seed = '') {
  const ranked = rankFactIds(factIds, stats);
  if (ranked.length === 0) return null;
  if (!seed) return ranked[0];

  const topScore = scoreFact(ranked[0], stats);
  const contenders = ranked.filter(id => scoreFact(id, stats) >= topScore * (1 - TIE_BAND));
  if (contenders.length <= 1) return ranked[0];
  return contenders[stableHash(seed) % contenders.length];
}

/**
 * Reorder generated facts so the most interesting one leads.
 * `preferredId` lets a stored headline (snapshotted on the card) win, keeping
 * previously generated cards showing exactly what they showed before.
 */
export function orderFactsByInterest(facts, stats = {}, preferredId = null) {
  if (!Array.isArray(facts) || facts.length === 0) return [];
  const ranked = rankFactIds(facts.map(f => f.id), stats);
  const rankOf = id => {
    const index = ranked.indexOf(id);
    return index < 0 ? Number.MAX_SAFE_INTEGER : index;
  };
  const ordered = [...facts].sort((a, b) => rankOf(a.id) - rankOf(b.id));
  if (!preferredId) return ordered;
  const preferred = ordered.findIndex(f => f.id === preferredId);
  if (preferred <= 0) return ordered;
  return [ordered[preferred], ...ordered.slice(0, preferred), ...ordered.slice(preferred + 1)];
}
