import { getXpForLevel, getLevel, getXpProgress } from '../src/utils/xpSystem';
import { getCardTier } from '../src/config/cardTiers';
import { THEME_LIST } from '../src/config/theme-config';

// A committed user: ~26 daily Wrappeds (200 each), ~4 weekly (1000), 1 monthly (4000).
const XP_PER_MONTH = 26 * 200 + 4 * 1000 + 4000;

const monthsToReach = level => getXpForLevel(level) / XP_PER_MONTH;

describe('XP curve pacing', () => {
  it('is monotonically increasing and starts at zero', () => {
    expect(getXpForLevel(1)).toBe(0);
    for (let level = 2; level <= 100; level++) {
      expect(getXpForLevel(level)).toBeGreaterThan(getXpForLevel(level - 1));
    }
  });

  it('getLevel is the exact inverse of getXpForLevel at every boundary', () => {
    for (let level = 2; level <= 60; level++) {
      const required = getXpForLevel(level);
      expect(getLevel(required)).toBe(level);
      expect(getLevel(required - 1)).toBe(level - 1);
    }
  });

  it('reaches every card tier within a realistic timeframe', () => {
    // The whole point of the rebalance: Legendary used to need ~40 months, so
    // the best artwork in the app was unreachable for essentially every user.
    expect(monthsToReach(6)).toBeLessThan(1);    // Grinder
    expect(monthsToReach(16)).toBeLessThan(3);   // Veteran
    expect(monthsToReach(31)).toBeLessThan(7);   // Elite
    expect(monthsToReach(51)).toBeLessThan(18);  // Legendary
  });

  it('still makes Legendary a long-term goal rather than a giveaway', () => {
    expect(monthsToReach(51)).toBeGreaterThan(6);
    expect(monthsToReach(31)).toBeGreaterThan(2);
  });

  it('awards level 2 quickly enough to hook a new user', () => {
    // First workout: daily Wrapped (200) + two bronze medals (50 each).
    expect(getXpForLevel(2)).toBeLessThanOrEqual(1000);
  });

  it('every card tier is reachable by some level', () => {
    const tiersSeen = new Set();
    for (let level = 1; level <= 60; level++) {
      tiersSeen.add(getCardTier(level).id);
    }
    expect(tiersSeen).toEqual(new Set(['starter', 'grinder', 'veteran', 'elite', 'legendary']));
  });

  it('every level-gated theme is reachable within a few months', () => {
    for (const theme of THEME_LIST.filter(item => !item.limited)) {
      expect(monthsToReach(theme.requiredLevel)).toBeLessThan(6);
    }
  });

  it('progress within a level stays in range', () => {
    for (const xp of [0, 500, 4500, 22500, 72000, 180000, 999999]) {
      const progress = getXpProgress(xp);
      expect(progress.progress).toBeGreaterThanOrEqual(0);
      expect(progress.progress).toBeLessThanOrEqual(1);
      expect(progress.xpInLevel).toBeGreaterThanOrEqual(0);
      expect(progress.xpToNext).toBeGreaterThan(0);
      expect(progress.level).toBe(getLevel(xp));
    }
  });
});
