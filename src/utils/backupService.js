import { supabase } from '../lib/supabase';
import * as storage from './storage';
import { reportError } from './errorReporter';

// ---------------------------------------------------------------------------
// Optional cloud backup.
//
// The app is offline-first and stays fully usable with no account — an account
// only exists so progress survives losing/changing a phone. Nothing here is on
// the critical path of logging a workout; every failure degrades to "your data
// is still safe on this device".
//
// Wrapped cards, medals and workouts are stored as JSONB blobs keyed by their
// existing local ids, so the local shape stays the source of truth and we don't
// have to migrate the whole data model to relational columns.
// ---------------------------------------------------------------------------

const CHUNK = 200;

async function upsertAll(table, rows) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from(table).upsert(slice, { onConflict: 'id' });
    if (error) throw error;
  }
}

/**
 * Push everything on this device up to the account.
 * One-shot full snapshot helper retained for recovery and data migrations.
 * Normal app usage goes through the persistent automatic sync queue.
 */
export async function backupToCloud(userId) {
  if (!userId) return { success: false, error: 'Not signed in' };
  try {
    const [workouts, cards, medals, xp, earnedTitles, equippedTitle, startingStats] = await Promise.all([
      storage.getWorkouts(),
      storage.getWrappedCards(),
      storage.getMedals(),
      storage.getXpData(),
      storage.getEarnedTitles(),
      storage.getEquippedTitle(),
      storage.getStartingStats(),
    ]);

    await upsertAll('workouts', workouts.map(w => ({
      id: String(w.id),
      user_id: userId,
      date: w.date,
      duration: w.duration || 0,
      mood: w.mood || 3,
      exercises: w.exercises || [],
    })));

    await upsertAll('wrapped_cards', cards.map(c => ({
      id: String(c.id),
      user_id: userId,
      type: c.type,
      period_key: c.periodKey,
      period_start: c.periodStart || null,
      period_end: c.periodEnd || null,
      title: c.title || null,
      stats: c,           // full card blob — keeps local shape authoritative
      tier: c.level || 1,
      locked: !!c.locked,
    })));

    await upsertAll('medals', medals
      .filter(m => m.unlockedAt)
      .map(m => ({
        id: `${userId}_${m.id}`,
        user_id: userId,
        medal_type: m.id,
        pinned: !!m.pinned,
        unlocked_at: m.unlockedAt,
      })));

    const { error: profileError } = await supabase.from('users').upsert({
      id: userId,
      xp: xp?.totalXp || 0,
      level: undefined, // derived from xp on restore, never stored twice
    }, { onConflict: 'id' });
    if (profileError) throw profileError;

    await storage.saveBackupMeta({
      lastBackupAt: new Date().toISOString(),
      counts: { workouts: workouts.length, cards: cards.length },
    });

    return {
      success: true,
      counts: {
        workouts: workouts.length,
        cards: cards.length,
        medals: medals.filter(m => m.unlockedAt).length,
        titles: (earnedTitles || []).length,
        hasStartingStats: !!startingStats,
      },
    };
  } catch (error) {
    reportError(error, 'cloud-backup');
    return { success: false, error: error?.message || 'Backup failed' };
  }
}

/**
 * Pull the account's data down onto this device. Used when signing in on a new
 * phone. Remote wins for records that exist in both, because the cloud copy is
 * the one that survived the device change.
 */
export async function restoreFromCloud(userId) {
  if (!userId) return { success: false, error: 'Not signed in' };
  try {
    const [{ data: workouts, error: wErr }, { data: cards, error: cErr }, { data: medals, error: mErr }, { data: profile }] =
      await Promise.all([
        supabase.from('workouts').select('*').eq('user_id', userId),
        supabase.from('wrapped_cards').select('*').eq('user_id', userId),
        supabase.from('medals').select('*').eq('user_id', userId),
        supabase.from('users').select('xp').eq('id', userId).maybeSingle(),
      ]);
    if (wErr) throw wErr;
    if (cErr) throw cErr;
    if (mErr) throw mErr;

    const localWorkouts = await storage.getWorkouts();
    const mergedWorkouts = mergeById(
      localWorkouts,
      (workouts || []).map(w => ({
        id: w.id,
        date: w.date,
        duration: w.duration,
        mood: w.mood,
        exercises: w.exercises || [],
      }))
    );
    await storage.saveWorkouts(mergedWorkouts);

    const localCards = await storage.getWrappedCards();
    // `stats` holds the whole card blob we uploaded, so restore returns the
    // exact local shape rather than a lossy relational projection.
    const remoteCards = (cards || [])
      .map(row => (row.stats && typeof row.stats === 'object' && row.stats.id ? row.stats : null))
      .filter(Boolean);
    await storage.saveWrappedCards(mergeById(localCards, remoteCards));

    const localMedals = await storage.getMedals();
    const remoteMedals = (medals || []).map(row => ({
      id: row.medal_type,
      unlockedAt: row.unlocked_at,
      pinned: !!row.pinned,
      progressCurrent: 1,
      progressTarget: 1,
    }));
    await storage.saveMedals(mergeById(localMedals, remoteMedals));

    if (profile?.xp != null) {
      const local = await storage.getXpData();
      // Never let a restore reduce progress.
      await storage.saveXpData({ totalXp: Math.max(local?.totalXp || 0, profile.xp) });
    }

    return {
      success: true,
      counts: {
        workouts: mergedWorkouts.length,
        cards: remoteCards.length,
        medals: remoteMedals.length,
      },
    };
  } catch (error) {
    reportError(error, 'cloud-restore');
    return { success: false, error: error?.message || 'Restore failed' };
  }
}

/**
 * Permanently delete the account and everything stored against it.
 * Apple requires in-app account deletion for any app that offers sign-up.
 * The `delete_own_account` RPC removes the auth user; cascading FKs in the
 * schema drop workouts / cards / medals / push tokens with it.
 */
export async function deleteAccount(userId) {
  if (!userId) return { success: false, error: 'Not signed in' };
  try {
    // Delete owned rows first so data is gone even if the RPC is unavailable.
    await Promise.all([
      supabase.from('workouts').delete().eq('user_id', userId),
      supabase.from('wrapped_cards').delete().eq('user_id', userId),
      supabase.from('medals').delete().eq('user_id', userId),
      supabase.from('push_tokens').delete().eq('user_id', userId),
    ]);
    await supabase.from('users').delete().eq('id', userId);

    const { error: rpcError } = await supabase.rpc('delete_own_account');
    if (rpcError) {
      // Rows are already gone; surface it so the user can be told the auth
      // record needs a follow-up rather than silently claiming success.
      reportError(rpcError, 'delete-account-rpc');
      await supabase.auth.signOut();
      return { success: true, authRecordPending: true };
    }

    await supabase.auth.signOut();
    return { success: true, authRecordPending: false };
  } catch (error) {
    reportError(error, 'delete-account');
    return { success: false, error: error?.message || 'Could not delete account' };
  }
}

function mergeById(local, remote) {
  const map = new Map();
  for (const item of local || []) map.set(String(item.id), item);
  for (const item of remote || []) {
    const key = String(item.id);
    const existing = map.get(key);
    map.set(key, existing ? { ...existing, ...item } : item);
  }
  return [...map.values()];
}
