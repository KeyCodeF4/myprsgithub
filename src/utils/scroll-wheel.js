export const WHEEL_ITEM_HEIGHT = 68;

export function getWheelIndexForOffset(offsetY, optionCount) {
  if (optionCount <= 0) return -1;
  const rawIndex = Math.round(Math.max(0, offsetY) / WHEEL_ITEM_HEIGHT) - 1;
  return Math.max(0, Math.min(rawIndex, optionCount - 1));
}
