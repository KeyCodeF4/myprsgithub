import {
  scoreFact,
  rankFactIds,
  selectHeadlineFactId,
  orderFactsByInterest,
} from '../src/utils/headline-selector';
import { generateFacts } from '../src/utils/wrappedFacts';

const ALL_IDS = ['volume', 'calories', 'distance', 'duration', 'sets', 'muscleGroups', 'pr', 'heaviest', 'days', 'streak', 'topExercise'];

describe('deterministic headline selection', () => {
  it('never selects a statistic with no real data behind it', () => {
    const emptyStats = { totalVolume: 0, totalReps: 0, totalSets: 0, duration: 0, prs: 0, streak: 0 };
    expect(rankFactIds(ALL_IDS, emptyStats)).toEqual([]);
    expect(selectHeadlineFactId(ALL_IDS, emptyStats)).toBeNull();

    // Individually, each zero-valued stat scores 0 and is therefore unselectable.
    expect(scoreFact('volume', { totalVolume: 0 })).toBe(0);
    expect(scoreFact('duration', { duration: 0 })).toBe(0);
    expect(scoreFact('pr', { prs: 0 })).toBe(0);
    expect(scoreFact('heaviest', { bestWeight: 0 })).toBe(0);
  });

  it('is stable across repeated calls with the same stats', () => {
    const stats = { totalVolume: 5000, totalReps: 200, totalSets: 20, duration: 60, prs: 1, streak: 4, bestWeight: 100, heaviestName: 'Barbell Squat' };
    const first = rankFactIds(ALL_IDS, stats);
    for (let i = 0; i < 25; i++) {
      expect(rankFactIds(ALL_IDS, stats)).toEqual(first);
    }
    expect(selectHeadlineFactId(ALL_IDS, stats)).toBe(first[0]);
  });

  it('leads with a PR over routine volume or duration', () => {
    const stats = { totalVolume: 9000, duration: 90, totalReps: 300, totalSets: 30, prs: 2 };
    expect(selectHeadlineFactId(ALL_IDS, stats)).toBe('pr');
  });

  it('lets the data decide between heaviest lift and total volume', () => {
    // A heavy single on a low-volume day should lead with the lift...
    const heavyDay = { totalVolume: 3000, duration: 45, bestWeight: 180, heaviestName: 'Deadlift' };
    expect(selectHeadlineFactId(ALL_IDS, heavyDay)).toBe('heaviest');

    // ...and a huge-volume day with a routine top set should lead with volume.
    const volumeDay = { totalVolume: 22000, duration: 45, bestWeight: 70, heaviestName: 'Bench Press' };
    expect(selectHeadlineFactId(ALL_IDS, volumeDay)).toBe('volume');
  });

  it('rotates between comparably interesting stats across different Wrappeds', () => {
    // Same shape of session on many days: previously this showed "heaviest"
    // every single time. The seed (periodKey) spreads it across close scorers
    // without ever inventing a statistic.
    const stats = { totalVolume: 6000, bestWeight: 80, heaviestName: 'Bench Press', totalReps: 120, totalSets: 16, duration: 48 };
    const picks = new Set();
    for (let day = 1; day <= 20; day++) {
      picks.add(selectHeadlineFactId(ALL_IDS, stats, `2026-03-${String(day).padStart(2, '0')}`));
    }
    expect(picks.size).toBeGreaterThan(1);
    // Whatever it picks must still be a real, non-zero statistic.
    for (const id of picks) {
      expect(scoreFact(id, stats)).toBeGreaterThan(0);
    }
  });

  it('gives the same Wrapped the same headline every time despite rotation', () => {
    const stats = { totalVolume: 6000, bestWeight: 80, heaviestName: 'Bench Press', totalReps: 120, totalSets: 16 };
    const first = selectHeadlineFactId(ALL_IDS, stats, '2026-03-04');
    for (let i = 0; i < 30; i++) {
      expect(selectHeadlineFactId(ALL_IDS, stats, '2026-03-04')).toBe(first);
    }
  });

  it('never rotates away from a clear standout like a PR', () => {
    const stats = { totalVolume: 9000, bestWeight: 140, heaviestName: 'Deadlift', prs: 2, totalReps: 200 };
    for (let day = 1; day <= 15; day++) {
      expect(selectHeadlineFactId(ALL_IDS, stats, `2026-05-${String(day).padStart(2, '0')}`)).toBe('pr');
    }
  });

  it('does not treat a one-day streak or single-session exercise as a story', () => {
    expect(scoreFact('streak', { streak: 1 })).toBe(0);
    expect(scoreFact('streak', { streak: 2 })).toBeGreaterThan(0);
    expect(scoreFact('topExercise', { topExercise: 'Bench', topExerciseCount: 1 })).toBe(0);
    expect(scoreFact('topExercise', { topExercise: 'Bench', topExerciseCount: 3 })).toBeGreaterThan(0);
  });

  it('rewards streak milestones above ordinary streaks', () => {
    expect(scoreFact('streak', { streak: 7 })).toBeGreaterThan(scoreFact('streak', { streak: 6 }));
  });

  it('demotes duration so it only leads when nothing better exists', () => {
    const onlyDuration = { duration: 75 };
    expect(selectHeadlineFactId(ALL_IDS, onlyDuration)).toBe('duration');

    const withVolume = { duration: 75, totalVolume: 4000 };
    expect(selectHeadlineFactId(ALL_IDS, withVolume)).toBe('volume');
  });

  it('orders real generated facts so the strongest one leads', () => {
    const stats = {
      totalVolume: 8000, totalReps: 240, totalSets: 24, duration: 72,
      prs: 3, streak: 5, bestWeight: 120, heaviestName: 'Barbell Squat',
      muscleGroups: ['Chest', 'Back', 'Legs'], uniqueMuscleGroups: 3,
    };
    const facts = generateFacts(stats);
    expect(facts.length).toBeGreaterThan(1);
    expect(facts[0].id).toBe('pr');
    // Deterministic: same input, same leading fact every time.
    expect(generateFacts(stats)[0].id).toBe('pr');
  });

  it('honours a snapshotted headline so existing cards keep their fact', () => {
    const stats = { totalVolume: 8000, totalReps: 240, duration: 72, prs: 3 };
    const withStored = generateFacts(stats, 'duration');
    expect(withStored[0].id).toBe('duration');
    // and still contains the rest of the facts exactly once
    const ids = withStored.map(f => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('pr');
  });

  it('ignores an unknown stored headline id rather than breaking ordering', () => {
    const stats = { totalVolume: 8000, prs: 2 };
    const facts = generateFacts(stats, 'no_such_fact');
    expect(facts[0].id).toBe('pr');
  });

  it('orderFactsByInterest tolerates empty and malformed input', () => {
    expect(orderFactsByInterest([], {})).toEqual([]);
    expect(orderFactsByInterest(null, {})).toEqual([]);
    expect(orderFactsByInterest(undefined, {})).toEqual([]);
  });
});
