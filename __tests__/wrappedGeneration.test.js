import {
  generateDailyWrapped,
  generateMonthlyWrapped,
  generateWeeklyWrapped,
  formatPeriod,
} from '../src/utils/wrappedGenerator';
import { computeTotalXp } from '../src/utils/xpSystem';
import { evaluateMedals } from '../src/utils/medalEvaluator';
import { getLocalWeekKey, toDateKeyInTimeZone, toLocalDateKey } from '../src/utils/dateUtils';

const exercise = (weight = 100, sets = 3) => ({
  name: 'Barbell Bench Press', muscleGroup: 'Chest', weight, reps: 5, sets,
});
const workout = (id, date, weight = 100) => ({
  id, date, duration: 45, exercises: [exercise(weight)],
});

test('weekly labels include both months when a week crosses a month boundary', () => {
  expect(formatPeriod('weekly', '2026-07-27T12:00:00', '2026-08-02T12:00:00')).toBe('Week of Jul 27–Aug 2');
});

describe('Wrapped period and deduplication behavior', () => {
  test('local day and week keys remain correct around midnight and Sunday/Monday', () => {
    expect(toLocalDateKey(new Date(2026, 0, 1, 0, 1))).toBe('2026-01-01');
    expect(getLocalWeekKey(new Date(2026, 6, 26, 23, 59))).toBe('2026-07-20');
    expect(getLocalWeekKey(new Date(2026, 6, 27, 0, 1))).toBe('2026-07-27');
  });

  test('an ISO timestamp is assigned to the user’s local day rather than its UTC day', () => {
    const timestamp = '2026-01-01T07:30:00.000Z';
    expect(toDateKeyInTimeZone(timestamp, 'America/Los_Angeles')).toBe('2025-12-31');
    expect(toDateKeyInTimeZone(timestamp, 'Europe/London')).toBe('2026-01-01');
  });

  test('daily generation merges multiple same-day workouts into one updatable card', () => {
    const day = new Date(2026, 6, 30, 12, 0);
    const firstWorkout = workout('one', new Date(2026, 6, 30, 8, 0).toISOString(), 80);
    const first = generateDailyWrapped([firstWorkout], [], 1, [], { name: 'Bench Demon' }, day);
    const secondWorkout = workout('two', new Date(2026, 6, 30, 18, 0).toISOString(), 100);
    const updated = generateDailyWrapped([firstWorkout, secondWorkout], [], 1, [first], { name: 'New Title' }, day);

    expect(updated.id).toBe(first.id);
    expect(updated.stats.totalWorkouts).toBe(2);
    expect(updated.stats.totalVolume).toBeGreaterThan(first.stats.totalVolume);
    // Snapshot semantics: the updated card keeps the title it was created with,
    // never the newly equipped one. Stored as a plain string — persisting the
    // whole title record crashed anything that rendered card.userTitle directly.
    expect(updated.userTitle).toBe('Bench Demon');
  });

  test('weekly Wrapped includes Monday through Sunday and refuses a duplicate', () => {
    const workouts = [
      workout('mon', new Date(2026, 6, 20, 9).toISOString()),
      workout('sun', new Date(2026, 6, 26, 21).toISOString()),
      workout('nextMon', new Date(2026, 6, 27, 9).toISOString()),
    ];
    const card = generateWeeklyWrapped(workouts, [], 1, [], null, '2026-07-20');
    expect(card.stats.totalWorkouts).toBe(2);
    expect(generateWeeklyWrapped(workouts, [], 1, [card], null, '2026-07-20')).toBeNull();
  });

  test('monthly Wrapped handles the December to January year boundary', () => {
    const workouts = [
      workout('dec', new Date(2025, 11, 31, 18).toISOString()),
      workout('jan', new Date(2026, 0, 1, 18).toISOString()),
    ];
    const december = generateMonthlyWrapped(workouts, [], 1, [], null, '2025-12');
    const january = generateMonthlyWrapped(workouts, [], 1, [december], null, '2026-01');
    expect(december.stats.totalWorkouts).toBe(1);
    expect(january.stats.totalWorkouts).toBe(1);
  });

  test('daily XP and medal XP are only counted once', () => {
    const cards = [
      { id: 'a', type: 'daily', periodKey: '2026-07-30' },
      { id: 'b', type: 'daily', periodKey: '2026-07-30' },
    ];
    const workouts = [workout('one', new Date().toISOString())];
    const firstEvaluation = evaluateMedals(workouts, [], cards.slice(0, 1));
    const secondEvaluation = evaluateMedals(workouts, firstEvaluation.updatedMedals, cards.slice(0, 1));

    expect(computeTotalXp(cards, [])).toBe(computeTotalXp(cards.slice(0, 1), []));
    expect(firstEvaluation.newlyUnlocked.length).toBeGreaterThan(0);
    expect(secondEvaluation.newlyUnlocked).toHaveLength(0);
    expect(computeTotalXp([], firstEvaluation.updatedMedals)).toBe(
      computeTotalXp([], secondEvaluation.updatedMedals)
    );
  });
});

describe('user title snapshotting', () => {
  const workout = {
    id: 'w1',
    date: new Date().toISOString(),
    duration: 40,
    exercises: [{ name: 'Barbell Squat', muscleGroup: 'Legs', weight: 100, reps: 5, sets: 4 }],
  };

  it('stores the title as a string even when handed a title record', () => {
    // The context and dev simulator pass the whole record from getEquippedTitle().
    // Storing that object made anything rendering card.userTitle crash React with
    // "Objects are not valid as a React child".
    const titleRecord = { id: 't1', text: 'The Bench Demon', category: 'pr', rarity: 'rare', custom: false, earnedAt: '2026-01-01' };
    const card = generateDailyWrapped([workout], [], 1, [], titleRecord);
    expect(typeof card.userTitle).toBe('string');
    expect(card.userTitle).toBe('The Bench Demon');
  });

  it('accepts a plain string title unchanged', () => {
    const card = generateDailyWrapped([workout], [], 1, [], 'Quad Destroyer');
    expect(card.userTitle).toBe('Quad Destroyer');
  });

  it('records null rather than an empty object when no title is equipped', () => {
    const card = generateDailyWrapped([workout], [], 1, [], null);
    expect(card.userTitle).toBeNull();
  });

  it('keeps the original title when an existing daily card is updated', () => {
    const first = generateDailyWrapped([workout], [], 1, [], { id: 't1', text: 'The Bench Demon' });
    const updated = generateDailyWrapped([workout], [], 1, [first], { id: 't2', text: 'Quad Destroyer' });
    // Snapshot semantics: changing the equipped title must not rewrite history.
    expect(updated.userTitle).toBe('The Bench Demon');
  });
});
