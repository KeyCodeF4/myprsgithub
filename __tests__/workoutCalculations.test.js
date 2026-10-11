import { checkPersonalRecords, getTodayStats, getWeeklyStats } from '../src/utils/calculations';

const exercise = (overrides = {}) => ({
  name: 'Barbell Bench Press',
  muscleGroup: 'Chest',
  weight: 100,
  reps: 5,
  sets: 1,
  ...overrides,
});

const workout = (id, date, exercises) => ({ id, date, duration: 45, exercises });

describe('workout calculations', () => {
  test('individual set rows and one combined set row produce identical totals', () => {
    const combined = workout('combined', '2026-07-30T10:00:00.000Z', [exercise({ sets: 3 })]);
    const individual = workout('individual', '2026-07-30T10:00:00.000Z', [exercise(), exercise(), exercise()]);

    const combinedStats = getTodayStats(combined);
    const individualStats = getTodayStats(individual);
    expect(individualStats.totalVolume).toBe(combinedStats.totalVolume);
    expect(individualStats.totalSets).toBe(combinedStats.totalSets);
    expect(individualStats.totalReps).toBe(combinedStats.totalReps);
  });

  test('multiple workouts on the same day are all included but count as one active day', () => {
    const workouts = [
      workout('morning', '2026-07-30T08:00:00.000Z', [exercise({ weight: 80, sets: 2 })]),
      workout('evening', '2026-07-30T18:00:00.000Z', [exercise({ weight: 90, sets: 2 })]),
    ];
    const stats = getWeeklyStats(workouts);
    expect(stats.totalWorkouts).toBe(2);
    expect(stats.uniqueDays).toBe(1);
    expect(stats.totalVolume).toBe(1700);
  });

  test('a PR is counted once when an exercise is represented by individual sets', () => {
    const previous = workout('previous', '2026-07-29T10:00:00.000Z', [exercise({ weight: 90, sets: 3 })]);
    const current = workout('current', '2026-07-30T10:00:00.000Z', [
      exercise({ weight: 95 }),
      exercise({ weight: 100 }),
      exercise({ weight: 100 }),
    ]);
    expect(checkPersonalRecords(current, [previous, current])).toBe(1);
  });

  test('future workouts do not prevent an earlier workout from being recognised as a PR', () => {
    const baseline = workout('baseline', '2026-07-28T10:00:00.000Z', [exercise({ weight: 80 })]);
    const current = workout('current', '2026-07-29T10:00:00.000Z', [exercise({ weight: 90 })]);
    const future = workout('future', '2026-07-30T10:00:00.000Z', [exercise({ weight: 100 })]);
    expect(checkPersonalRecords(current, [baseline, current, future])).toBe(1);
  });
});
