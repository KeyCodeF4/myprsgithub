// Convert offline-first app records into the narrower Supabase table shapes.
// Keeping this boundary explicit prevents local-only card and medal fields from
// being sent as unknown database columns.
export function buildCloudRow(table, data, userId) {
  if (!data || !userId) return null;

  if (table === 'workouts') {
    return {
      id: String(data.id),
      user_id: userId,
      date: data.date,
      duration: data.duration || 0,
      mood: data.mood || 3,
      exercises: data.exercises || [],
    };
  }

  if (table === 'wrapped_cards') {
    return {
      id: String(data.id),
      user_id: userId,
      type: data.type,
      period_key: data.periodKey || null,
      period_start: data.periodStart || null,
      period_end: data.periodEnd || null,
      title: data.title || null,
      stats: data,
      headline_stat: data.headlineStat || {},
      secondary_stats: data.secondaryStats || [],
      tier: data.level || 1,
      locked: !!data.locked,
    };
  }

  if (table === 'medals') {
    if (!data.unlockedAt) return null;
    return {
      id: `${userId}_${data.id}`,
      user_id: userId,
      medal_type: data.id,
      pinned: !!data.pinned,
      unlocked_at: data.unlockedAt,
    };
  }

  if (table === 'users') {
    return {
      id: userId,
      xp: data.xp || 0,
      level: data.level || 1,
    };
  }

  return { ...data, user_id: userId };
}
