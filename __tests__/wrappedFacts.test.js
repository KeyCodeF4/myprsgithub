import { generateFacts } from '../src/utils/wrappedFacts';

describe('scale-aware Wrapped comparisons', () => {
  test('small distances never display as 0.0 football fields', () => {
    const distance = generateFacts({ totalReps: 1 }).find(fact => fact.id === 'distance');
    expect(distance.value).toBe('0.5 m');
    expect(distance.subtext).not.toContain('0.0');
    expect(distance.subtext).not.toContain('football field');
    expect(distance.subtext).toContain('eggs');
  });

  test('one estimated calorie uses a genuinely small comparison', () => {
    const calories = generateFacts({ totalVolume: 10, totalReps: 1 }).find(fact => fact.id === 'calories');
    expect(calories.value).toBe('1 cal');
    expect(calories.subtext).toContain('cooked grains of rice');
    expect(calories.subtext).not.toContain('cheeseburger');
  });

  test('large distances graduate to football fields', () => {
    const distance = generateFacts({ totalReps: 200 }).find(fact => fact.id === 'distance');
    expect(distance.value).toBe('100 m');
    expect(distance.subtext).toContain('1 football field');
  });
});
