import { getWheelIndexForOffset } from '../src/utils/scroll-wheel';

describe('desktop scroll-wheel selection', () => {
  test('maps the centered first option to index zero', () => {
    expect(getWheelIndexForOffset(68, 10)).toBe(0);
  });

  test('selects later values while scrolling and clamps either end', () => {
    expect(getWheelIndexForOffset(68 * 4, 10)).toBe(3);
    expect(getWheelIndexForOffset(-200, 10)).toBe(0);
    expect(getWheelIndexForOffset(99999, 10)).toBe(9);
  });

  test('handles an empty option list', () => {
    expect(getWheelIndexForOffset(68, 0)).toBe(-1);
  });
});
