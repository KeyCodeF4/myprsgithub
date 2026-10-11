import { MEDALS } from '../data/medalsConfig';

export const MAX_EQUIPPED_MEDALS = 3;

// Stored medal state is bare bookkeeping — { id, unlockedAt, pinned, progress* } —
// with no icon/name/tier. Card UI needs the presentation fields from MEDALS, so
// every consumer has to merge config in. Doing it in one place also lets us drop
// medal IDs that no longer exist in config (renamed/removed between releases)
// instead of rendering an empty slot or crashing on `config.tier`.
export function hydrateMedal(state) {
  if (!state || typeof state.id !== 'string') return null;
  const config = MEDALS[state.id];
  if (!config) return null;
  return { ...config, ...state, id: state.id };
}

/**
 * Live equipped ("pinned") medals, newest-unlocked order preserved from storage.
 *
 * Equipping is a *display preference*, not history: it is intentionally resolved
 * from the current medal store rather than from a Wrapped card's snapshot, so
 * equipping a medal updates every card immediately. The card snapshot is still
 * kept for "what had I earned at that point" detail rendering.
 */
export function resolveEquippedMedals(medals, limit = MAX_EQUIPPED_MEDALS) {
  if (!Array.isArray(medals)) return [];
  const seen = new Set();
  const equipped = [];
  for (const state of medals) {
    if (!state || !state.pinned || !state.unlockedAt) continue;
    if (seen.has(state.id)) continue; // one medal can never fill two slots
    const hydrated = hydrateMedal(state);
    if (!hydrated) continue;
    seen.add(state.id);
    equipped.push(hydrated);
    if (equipped.length >= limit) break;
  }
  return equipped;
}

// All unlocked medals, hydrated and safe. Used by locker/detail views.
export function resolveUnlockedMedals(medals) {
  if (!Array.isArray(medals)) return [];
  const seen = new Set();
  const out = [];
  for (const state of medals) {
    if (!state || !state.unlockedAt || seen.has(state.id)) continue;
    const hydrated = hydrateMedal(state);
    if (!hydrated) continue;
    seen.add(state.id);
    out.push(hydrated);
  }
  return out;
}

// 1-based slot number for the medal, or 0 when it isn't equipped.
export function getEquippedSlot(medals, medalId) {
  const index = resolveEquippedMedals(medals).findIndex(m => m.id === medalId);
  return index < 0 ? 0 : index + 1;
}

export function isEquipMedalLimitReached(medals) {
  return resolveEquippedMedals(medals).length >= MAX_EQUIPPED_MEDALS;
}
