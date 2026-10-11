import {
  normaliseExercise,
  getWorkoutsForCard,
  buildWrappedDetail,
  getDetailComment,
  summarizeSetLines,
} from '../src/utils/wrapped-detail';

const combined = { name: 'Barbell Squat', muscleGroup: 'Legs', weight: 100, reps: 5, sets: 4 };
const individual = {
  name: 'Barbell Squat',
  muscleGroup: 'Legs',
  sets: [
    { weight: 100, reps: 5 },
    { weight: 100, reps: 5 },
    { weight: 100, reps: 5 },
    { weight: 100, reps: 5 },
  ],
};

describe('wrapped detail extraction', () => {
  it('condenses repeated set lines for a readable card back', () => {
    expect(summarizeSetLines(['4 × 8 @ 65 kg', '4 × 8 @ 65 kg'])).toBe('4 × 8 @ 65 kg · 2 entries');
    expect(summarizeSetLines([])).toBe('');
  });

  it('produces identical totals for combined and individual set formats', () => {
    const a = normaliseExercise(combined);
    const b = normaliseExercise(individual);
    expect(a.volume).toBe(2000);
    expect(b.volume).toBe(2000);
    expect(a.totalReps).toBe(20);
    expect(b.totalReps).toBe(20);
    expect(a.setCount).toBe(4);
    expect(b.setCount).toBe(4);
    expect(a.bestWeight).toBe(100);
    expect(b.bestWeight).toBe(100);
  });

  it('renders readable set lines for both formats', () => {
    expect(normaliseExercise(combined).setLines).toEqual(['4 × 5 @ 100 kg']);
    expect(normaliseExercise(individual).setLines).toEqual([
      '100 kg × 5', '100 kg × 5', '100 kg × 5', '100 kg × 5',
    ]);
  });

  it('handles varying weights per set', () => {
    const ex = normaliseExercise({
      name: 'Bench', muscleGroup: 'Chest',
      sets: [{ weight: 60, reps: 10 }, { weight: 70, reps: 8 }, { weight: 80, reps: 5 }],
    });
    expect(ex.volume).toBe(60 * 10 + 70 * 8 + 80 * 5);
    expect(ex.bestWeight).toBe(80);
    expect(ex.totalReps).toBe(23);
  });

  it('treats cardio separately without inventing weight volume', () => {
    const ex = normaliseExercise({ name: 'Treadmill', muscleGroup: 'Cardio', duration: 30, distance: 5 });
    expect(ex.isCardio).toBe(true);
    expect(ex.volume).toBe(0);
    expect(ex.setLines).toEqual(['30 min', '5 km']);
  });

  it('degrades gracefully on missing legacy fields instead of showing fake zeros', () => {
    const ex = normaliseExercise({ name: 'Mystery lift' });
    expect(ex.name).toBe('Mystery lift');
    expect(ex.volume).toBe(0);
    expect(ex.setLines).toEqual([]); // nothing real to show, so nothing is rendered
    expect(normaliseExercise(null)).toBeNull();
    expect(normaliseExercise(undefined)).toBeNull();
  });

  it('selects only the workouts inside a daily card period', () => {
    const card = { type: 'daily', periodKey: '2026-07-30' };
    const workouts = [
      { id: '1', date: '2026-07-30T18:00:00.000Z', exercises: [combined] },
      { id: '2', date: '2026-07-29T18:00:00.000Z', exercises: [combined] },
    ];
    const selected = getWorkoutsForCard(card, workouts);
    expect(selected.map(w => w.id)).toEqual(['1']);
  });

  it('merges repeated exercises across a period into one row', () => {
    const card = { type: 'daily', periodKey: '2026-07-30' };
    const workouts = [
      { id: '1', date: '2026-07-30T10:00:00.000Z', duration: 30, exercises: [combined] },
      { id: '2', date: '2026-07-30T18:00:00.000Z', duration: 30, exercises: [combined] },
    ];
    const detail = buildWrappedDetail(card, workouts);
    expect(detail.workoutCount).toBe(2);
    expect(detail.exerciseCount).toBe(1);
    expect(detail.totalVolume).toBe(4000);
    expect(detail.totalSets).toBe(8);
    expect(detail.duration).toBe(60);
    expect(detail.bestLift).toBe('Barbell Squat');
  });

  it('reports no data rather than fabricating a card with none', () => {
    const detail = buildWrappedDetail({ type: 'daily', periodKey: '2026-01-01' }, []);
    expect(detail.hasData).toBe(false);
    expect(detail.exercises).toEqual([]);
    expect(getDetailComment(detail)).toBeNull();
  });

  it('falls back to the card snapshot when raw workouts are gone', () => {
    const card = {
      type: 'daily',
      periodKey: '2026-01-01',
      stats: { totalVolume: 5000, totalSets: 12, totalReps: 120, duration: 45, bestWeight: 90, heaviestName: 'Deadlift' },
    };
    const detail = buildWrappedDetail(card, []);
    expect(detail.totalVolume).toBe(5000);
    expect(detail.bestLift).toBe('Deadlift');
  });

  it('handles malformed input without throwing', () => {
    expect(() => buildWrappedDetail(null, null)).not.toThrow();
    expect(getWorkoutsForCard(null, [])).toEqual([]);
    expect(getWorkoutsForCard({ type: 'weekly' }, [])).toEqual([]);
  });

  it('only makes claims the data supports', () => {
    expect(getDetailComment({ hasData: true, prs: 2, muscleGroups: [], totalVolume: 0, totalSets: 0, streak: 0 }))
      .toMatch(/PR/i);
    expect(getDetailComment({ hasData: true, prs: 0, totalVolume: 20000, muscleGroups: [], totalSets: 0, streak: 0 }))
      .toMatch(/weight moved/i);
  });
});
