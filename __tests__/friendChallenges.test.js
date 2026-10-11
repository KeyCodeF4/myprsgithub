import { buildChallengeSnapshot, getLatestCard, parseChallengeToken, scoreChallenge } from '../src/utils/friend-challenges';

describe('friend challenges', () => {
  test('selects the latest card for a requested period', () => {
    const cards = [{ id: 'old', type: 'daily', createdAt: '2026-08-01' }, { id: 'new', type: 'daily', createdAt: '2026-08-03' }, { id: 'week', type: 'weekly', createdAt: '2026-08-04' }];
    expect(getLatestCard(cards, 'daily').id).toBe('new');
  });

  test('creates a privacy-limited snapshot and scores rounds', () => {
    const left = buildChallengeSnapshot({ id: '1', type: 'daily', userTitle: 'Iron Fox', stats: { totalVolume: 1000, totalDuration: 50, totalReps: 80, bestWeight: 100 } }, 'Alex');
    const right = { ...left, metrics: { ...left.metrics, volume: 900, duration: 60, reps: 70, bestWeight: 90 } };
    expect(left.exercises).toBeUndefined();
    expect(scoreChallenge(left, right).winner).toBe('left');
  });

  test('parses app and web invite links', () => {
    expect(parseChallengeToken('myprs://challenge?token=abc')).toBe('abc');
    expect(parseChallengeToken('https://myprs.app/challenge/?token=xyz')).toBe('xyz');
  });
});
