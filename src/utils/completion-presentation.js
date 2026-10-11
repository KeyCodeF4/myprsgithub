// Which single completion surface to show after a Wrapped is generated.
//
// Saving used to produce TWO identical completion cards: the wizard's final step
// rendered a full ShareableWrappedCard, and then the post-save modal rendered
// the same card again. The wizard's last step is now a review screen, and this
// resolver guarantees the post-save experience is exactly one surface by
// returning a single value rather than independent booleans that could both be
// true at once.
export const COMPLETION_SURFACE = {
  NONE: 'none',
  NEW_WRAPPED: 'new-wrapped',
  TODAY_WRAPPED: 'today-wrapped',
};

/**
 * @param {object|null} newWrappedCard card just produced by generateWrapped
 * @param {boolean} appendMode true when the user added to an existing day
 * @param {boolean} celebrationPending medal/level-up/title modal is queued
 */
export function resolveCompletionSurface({ newWrappedCard, appendMode = false, celebrationPending = false } = {}) {
  if (!newWrappedCard) return COMPLETION_SURFACE.NONE;
  // Celebrations take priority; the Wrapped surface follows once they're cleared,
  // so two native modals are never on screen together.
  if (celebrationPending) return COMPLETION_SURFACE.NONE;
  return appendMode ? COMPLETION_SURFACE.TODAY_WRAPPED : COMPLETION_SURFACE.NEW_WRAPPED;
}
