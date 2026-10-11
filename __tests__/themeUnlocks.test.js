import {
  APP_THEMES,
  DEFAULT_THEME_ID,
  THEME_LIST,
  isThemeUnlocked,
  getUnlockedThemeIds,
  resolveSafeThemeId,
} from '../src/config/theme-config';

describe('level-gated themes', () => {
  it('only the default theme is available at level 1', () => {
    expect(getUnlockedThemeIds(1)).toEqual([DEFAULT_THEME_ID]);
    expect(isThemeUnlocked(DEFAULT_THEME_ID, 1)).toBe(true);
  });

  it('every non-default theme has an increasing level requirement above 1', () => {
    const gated = THEME_LIST.filter(t => t.id !== DEFAULT_THEME_ID && !t.limited);
    expect(gated.length).toBeGreaterThan(0);
    for (const theme of gated) {
      expect(theme.requiredLevel).toBeGreaterThan(1);
    }
    const levels = gated.map(t => t.requiredLevel);
    expect([...levels].sort((a, b) => a - b)).toEqual(levels);
  });

  it('unlocks themes progressively as level rises', () => {
    expect(isThemeUnlocked('electric', 4)).toBe(false);
    expect(isThemeUnlocked('electric', 5)).toBe(true);
    expect(isThemeUnlocked('champion', 27)).toBe(false);
    expect(isThemeUnlocked('champion', 28)).toBe(true);
    expect(getUnlockedThemeIds(10)).toEqual(expect.arrayContaining(['iron', 'electric', 'toxic']));
    expect(getUnlockedThemeIds(10)).not.toContain('royal');
  });

  it('locked themes cannot be treated as equippable', () => {
    // resolveSafeThemeId is what the provider uses before applying a palette.
    expect(resolveSafeThemeId('champion', 1)).toBe(DEFAULT_THEME_ID);
    expect(resolveSafeThemeId('royal', 5)).toBe(DEFAULT_THEME_ID);
    expect(resolveSafeThemeId('electric', 5)).toBe('electric');
  });

  it('falls back to the default for unknown or legacy theme ids', () => {
    expect(resolveSafeThemeId('theme_from_old_build', 99)).toBe(DEFAULT_THEME_ID);
    expect(resolveSafeThemeId(undefined, 99)).toBe(DEFAULT_THEME_ID);
    expect(resolveSafeThemeId(null, 99)).toBe(DEFAULT_THEME_ID);
    expect(isThemeUnlocked('nope', 99)).toBe(false);
  });

  it('honours explicitly granted themes below their level requirement', () => {
    // Keeps the door open for achievement-based unlocks later.
    expect(isThemeUnlocked('champion', 2, ['champion'])).toBe(true);
    expect(resolveSafeThemeId('champion', 2, ['champion'])).toBe('champion');
  });

  it('every theme exposes a complete palette so equipping cannot break the UI', () => {
    for (const theme of THEME_LIST) {
      expect(typeof theme.primary).toBe('string');
      expect(theme.home).toBeTruthy();
      expect(typeof theme.home.background).toBe('string');
      expect(typeof theme.home.surface).toBe('string');
      expect(typeof theme.unlockDescription).toBe('string');
      expect(APP_THEMES[theme.id]).toBe(theme);
    }
  });
});
