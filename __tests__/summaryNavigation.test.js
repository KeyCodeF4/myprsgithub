import { getFactDeltaForSwipe, getFactDeltaForTap } from '../src/utils/summary-navigation';

describe('summary-card navigation direction', () => {
  test('swiping left advances and swiping right goes back', () => {
    expect(getFactDeltaForSwipe(-100)).toBe(1);
    expect(getFactDeltaForSwipe(100)).toBe(-1);
    expect(getFactDeltaForSwipe(10)).toBe(0);
  });

  test('left-side taps go back and right-side taps advance', () => {
    expect(getFactDeltaForTap(50, 300)).toBe(-1);
    expect(getFactDeltaForTap(250, 300)).toBe(1);
  });
});
