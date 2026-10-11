import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { TESTING_TOOLS_ENABLED } from '../config/testing';

const TEST_ACCOUNT_ALLOWLIST = ['test@myprs.app', 'dev@myprs.app'];

function log(step, status, msg) {
  console.log(`[DevReset] ${step}: ${status} — ${msg}`);
}

export async function performDevReset() {
  if (!TESTING_TOOLS_ENABLED) {
    console.error('[DevReset] FATAL: Testing tools are disabled — aborting.');
    return { success: false, error: 'Testing tools are disabled' };
  }

  log('STORAGE_WIPE', 'START', 'Clearing all @myprs_* AsyncStorage keys…');
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const myprsKeys = allKeys.filter(k => k.startsWith('@myprs_'));
    if (myprsKeys.length > 0) {
      await AsyncStorage.multiRemove(myprsKeys);
    }
    log('STORAGE_WIPE', 'DONE', `Removed ${myprsKeys.length} key(s)`);
  } catch (e) {
    log('STORAGE_WIPE', 'FAIL', e.message);
    return { success: false, error: `Storage wipe failed: ${e.message}` };
  }

  log('SUPABASE_CHECK', 'START', 'Checking current session…');
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;

    if (!session) {
      log('SUPABASE_CHECK', 'SKIP', 'No active session — skipping Supabase cleanup');
    } else {
      const userId = session.user.id;
      const userEmail = session.user.email;
      log('SUPABASE_CHECK', 'FOUND', `User: ${userEmail} (${userId})`);

      if (!TEST_ACCOUNT_ALLOWLIST.includes(userEmail)) {
        log('SUPABASE_CHECK', 'SKIP', 'Cloud data preserved because this is not an allowlisted test account');
      } else {
        log('SUPABASE_CHECK', 'ALLOWED', 'Email is on the allowlist');
        log('SUPABASE_DELETE', 'START', 'Deleting user rows from workouts, wrapped_cards, medals…');
        const tables = ['workouts', 'wrapped_cards', 'medals'];
        for (const table of tables) {
          const { error: delError } = await supabase
            .from(table)
            .delete()
            .eq('user_id', userId);
          if (delError) {
            log('SUPABASE_DELETE', 'WARN', `Failed to delete from ${table}: ${delError.message}`);
          } else {
            log('SUPABASE_DELETE', 'OK', `Deleted rows from ${table}`);
          }
        }
        log('SUPABASE_DELETE', 'DONE', 'Supabase cleanup complete');
      }
    }
  } catch (e) {
    log('SUPABASE_CHECK', 'FAIL', e.message);
  }

  log('SUPABASE_SIGNOUT', 'START', 'Signing out of Supabase…');
  try {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      log('SUPABASE_SIGNOUT', 'WARN', `Sign out error: ${signOutError.message}`);
    } else {
      log('SUPABASE_SIGNOUT', 'DONE', 'Signed out');
    }
  } catch (e) {
    log('SUPABASE_SIGNOUT', 'FAIL', e.message);
  }

  log('RESTART', 'READY', 'All steps complete — ready for app restart');
  return { success: true };
}
