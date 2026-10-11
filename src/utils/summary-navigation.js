export function getFactDeltaForSwipe(translationX, threshold = 42) {
  'worklet';
  if (Math.abs(translationX) < threshold) return 0;
  return translationX < 0 ? 1 : -1;
}

export function getFactDeltaForTap(locationX, cardWidth) {
  'worklet';
  return locationX < cardWidth / 2 ? -1 : 1;
}
