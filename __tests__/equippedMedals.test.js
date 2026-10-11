import {
  resolveEquippedMedals,
  resolveUnlockedMedals,
  hydrateMedal,
  getEquippedSlot,
  isEquipMedalLimitReached,
  MAX_EQUIPPED_MEDALS,
} from '../src/utils/equippedMedals';
import { MEDALS } from '../src/data/medalsConfig';

const state = (id, overrides = {}) => ({
  id,
  unlockedAt: '2026-01-01T00:00:00.000Z',
  progressCurrent: 1,
  progressTarget: 1,
  pinned: false,
  ...overrides,
});

describe('equipped medal resolution', () => {
  it('hydrates presentation fields that stored state does not carry', () => {
    // Stored medal state is bare bookkeeping; the card needs icon/name/tier.
    const hydrated = hydrateMedal(state('firstPump', { pinned: true }));
    expect(hydrated.icon).toBe(MEDALS.firstPump.icon);
    expect(hydrated.name).toBe(MEDALS.firstPump.name);
    expect(hydrated.tier).toBe(MEDALS.firstPump.tier);
    expect(hydrated.id).toBe('firstPump');
  });

  it('returns only medals that are both unlocked and equipped', () => {
    const equipped = resolveEquippedMedals([
      state('firstPump', { pinned: true }),
      state('weekStreak', { pinned: false }),
      state('firstWrapped', { pinned: true, unlockedAt: null }),
    ]);
    expect(equipped.map(m => m.id)).toEqual(['firstPump']);
  });

  it('every equipped medal exposes an icon so slots never render blank', () => {
    const equipped = resolveEquippedMedals([
      state('firstPump', { pinned: true }),
      state('weekStreak', { pinned: true }),
    ]);
    expect(equipped).toHaveLength(2);
    for (const medal of equipped) {
      expect(typeof medal.icon).toBe('string');
      expect(medal.icon.length).toBeGreaterThan(0);
    }
  });

  it('drops legacy or renamed medal ids instead of crashing', () => {
    const equipped = resolveEquippedMedals([
      state('some_removed_medal_v1', { pinned: true }),
      state('firstPump', { pinned: true }),
    ]);
    expect(equipped.map(m => m.id)).toEqual(['firstPump']);
  });

  it('survives malformed, null and non-array input', () => {
    expect(resolveEquippedMedals(null)).toEqual([]);
    expect(resolveEquippedMedals(undefined)).toEqual([]);
    expect(resolveEquippedMedals('nope')).toEqual([]);
    expect(resolveEquippedMedals([null, undefined, {}, { pinned: true }])).toEqual([]);
    expect(hydrateMedal(null)).toBeNull();
    expect(hydrateMedal({})).toBeNull();
  });

  it('never lets one medal occupy two slots', () => {
    const equipped = resolveEquippedMedals([
      state('firstPump', { pinned: true }),
      state('firstPump', { pinned: true }),
    ]);
    expect(equipped).toHaveLength(1);
  });

  it('caps equipped medals at the slot limit', () => {
    const ids = Object.keys(MEDALS).slice(0, MAX_EQUIPPED_MEDALS + 2);
    const equipped = resolveEquippedMedals(ids.map(id => state(id, { pinned: true })));
    expect(equipped).toHaveLength(MAX_EQUIPPED_MEDALS);
    expect(isEquipMedalLimitReached(ids.map(id => state(id, { pinned: true })))).toBe(true);
  });

  it('reports 1-based slot numbers and 0 when not equipped', () => {
    const medals = [
      state('firstPump', { pinned: true }),
      state('weekStreak', { pinned: false }),
      state('firstWrapped', { pinned: true }),
    ];
    expect(getEquippedSlot(medals, 'firstPump')).toBe(1);
    expect(getEquippedSlot(medals, 'firstWrapped')).toBe(2);
    expect(getEquippedSlot(medals, 'weekStreak')).toBe(0);
    expect(getEquippedSlot(medals, 'does_not_exist')).toBe(0);
  });

  it('resolveUnlockedMedals hydrates and de-duplicates unlocked medals only', () => {
    const unlocked = resolveUnlockedMedals([
      state('firstPump'),
      state('firstPump'),
      state('weekStreak', { unlockedAt: null }),
      state('ghost_medal'),
    ]);
    expect(unlocked.map(m => m.id)).toEqual(['firstPump']);
    expect(unlocked[0].name).toBe(MEDALS.firstPump.name);
  });
});
