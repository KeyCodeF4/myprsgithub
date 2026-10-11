import { evaluateMedals } from '../src/utils/medalEvaluator';
import { isThemeUnlocked } from '../src/config/theme-config';

describe('founder entitlement', () => {
  test('awards the numbered founder medal without requiring a workout', () => {
    const result = evaluateMedals([], [], [], { founderNumber: 7 });
    const founder = result.updatedMedals.find(medal => medal.id === 'foundingLifter');

    expect(founder.unlockedAt).toBeTruthy();
    expect(founder.serialNumber).toBe(7);
    expect(result.newlyUnlocked.find(medal => medal.id === 'foundingLifter')).toBeTruthy();
  });

  test('does not award an out-of-range serial', () => {
    const result = evaluateMedals([], [], [], { founderNumber: 101 });
    const founder = result.updatedMedals.find(medal => medal.id === 'foundingLifter');

    expect(founder.unlockedAt).toBeNull();
  });

  test('unlocks the founder-only theme only with the verified grant', () => {
    expect(isThemeUnlocked('founder', 99, [])).toBe(false);
    expect(isThemeUnlocked('founder', 1, ['founder'])).toBe(true);
  });
});
