import { buildTrendData, exerciseEstimated1RM, exerciseVolume } from '../src/utils/trends-data';

describe('trends data', () => {
  test('calculates volume and Epley estimated 1RM', () => {
    const exercise = { name: 'Squat', muscleGroup: 'Legs', weight: 100, reps: 5, sets: 3 };
    expect(exerciseVolume(exercise)).toBe(1500);
    expect(exerciseEstimated1RM(exercise)).toBeCloseTo(116.67, 1);
  });

  test('builds chart buckets, muscle balance, and PR history', () => {
    const workouts = [
      { id: 'a', date: '2026-07-20T12:00:00.000Z', duration: 40, exercises: [{ name: 'Squat', muscleGroup: 'Legs', weight: 80, reps: 5, sets: 3 }] },
      { id: 'b', date: '2026-08-01T12:00:00.000Z', duration: 45, exercises: [{ name: 'Squat', muscleGroup: 'Legs', weight: 100, reps: 5, sets: 3 }] },
    ];
    const result = buildTrendData(workouts, 'month', new Date('2026-08-04T12:00:00.000Z'));
    expect(result.buckets).toHaveLength(5);
    expect(result.summary.workouts).toBe(2);
    expect(result.summary.totalVolume).toBe(2700);
    expect(result.summary.bestE1RM).toBe(117);
    expect(result.muscleGroups[0].name).toBe('Legs');
    expect(result.prs[0].value).toBe(117);
  });
});
