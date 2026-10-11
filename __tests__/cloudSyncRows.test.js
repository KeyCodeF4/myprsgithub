import { buildCloudRow } from '../src/utils/cloud-sync-rows';

describe('automatic cloud backup row mapping', () => {
  const userId = 'user-123';

  test('maps a local Wrapped card to Supabase columns and keeps the full card blob', () => {
    const card = {
      id: 'daily_2026-08-04',
      type: 'daily',
      periodKey: '2026-08-04',
      periodStart: '2026-08-04T00:00:00.000Z',
      title: 'Daily Wrapped',
      headlineStat: { label: 'Volume', value: 1200 },
      secondaryStats: [{ label: 'Sets', value: 12 }],
      level: 4,
      localOnlyPresentationField: true,
    };

    expect(buildCloudRow('wrapped_cards', card, userId)).toEqual(expect.objectContaining({
      id: card.id,
      user_id: userId,
      period_key: card.periodKey,
      period_start: card.periodStart,
      headline_stat: card.headlineStat,
      secondary_stats: card.secondaryStats,
      tier: 4,
      stats: card,
    }));
  });

  test('maps earned medals to stable per-user ids and skips locked medals', () => {
    expect(buildCloudRow('medals', { id: 'first_pump' }, userId)).toBeNull();
    expect(buildCloudRow('medals', {
      id: 'first_pump',
      unlockedAt: '2026-08-04T12:00:00.000Z',
      pinned: true,
    }, userId)).toEqual({
      id: 'user-123_first_pump',
      user_id: userId,
      medal_type: 'first_pump',
      pinned: true,
      unlocked_at: '2026-08-04T12:00:00.000Z',
    });
  });

  test('strips unsupported local workout fields', () => {
    expect(buildCloudRow('workouts', {
      id: 42,
      date: '2026-08-04T12:00:00.000Z',
      duration: 50,
      exercises: [{ name: 'Squat' }],
      temporaryUiState: 'ignored',
    }, userId)).toEqual({
      id: '42',
      user_id: userId,
      date: '2026-08-04T12:00:00.000Z',
      duration: 50,
      mood: 3,
      exercises: [{ name: 'Squat' }],
    });
  });
});
