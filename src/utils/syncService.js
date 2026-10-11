import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import * as storage from './storage';
import { reportError } from './errorReporter';
import { getLevel } from './xpSystem';
import { buildCloudRow } from './cloud-sync-rows';

const SYNC_QUEUE_KEY = '@myprs_sync_queue';

let unsubscribe = null;
let isProcessing = false;
let statusListener = null;
let isOnline = true;
let retryTimer = null;
let retryAttempt = 0;
let queueMutation = Promise.resolve();

const actionKey = action => `${action.table}:${action.userId}:${action.data?.id || 'profile'}`;

const normalizeQueue = queue => (Array.isArray(queue) ? queue : []).map((item, index) => ({
  ...item,
  queueId: item.queueId || `legacy:${item.timestamp || 0}:${actionKey(item)}:${index}`,
}));

const getSyncQueue = async () => {
  try {
    const data = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    return normalizeQueue(data ? JSON.parse(data) : []);
  } catch (error) {
    reportError(error, 'read-sync-queue');
    return [];
  }
};

const mutateQueue = mutator => {
  const operation = queueMutation.then(async () => {
    const current = await getSyncQueue();
    const next = normalizeQueue(await mutator(current));
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(next));
    return next;
  });
  queueMutation = operation.catch(() => {});
  return operation;
};

const scheduleRetry = () => {
  if (retryTimer || !isOnline) return;
  const delay = Math.min(30000, 2000 * (2 ** retryAttempt));
  retryAttempt = Math.min(retryAttempt + 1, 4);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    processSyncQueue();
  }, delay);
};

export const startSyncService = (onStatus) => {
  statusListener = onStatus || null;
  unsubscribe?.();
  unsubscribe = NetInfo.addEventListener(state => {
    isOnline = !!state.isConnected && state.isInternetReachable !== false;
    if (isOnline) {
      processSyncQueue();
    } else {
      statusListener?.({ state: 'offline' });
    }
  });
  NetInfo.fetch().then(state => {
    isOnline = !!state.isConnected && state.isInternetReachable !== false;
    if (isOnline) processSyncQueue();
  }).catch(error => reportError(error, 'network-status'));
};

export const stopSyncService = () => {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  statusListener = null;
};

export const addToSyncQueue = async (table, type, data, userId) => {
  if (!userId || !data) return;
  const action = {
    queueId: `${Date.now()}:${Math.random().toString(36).slice(2)}`,
    table,
    type,
    data,
    userId,
    timestamp: Date.now(),
  };
  const next = await mutateQueue(queue => [
    ...queue.filter(item => actionKey(item) !== actionKey(action)),
    action,
  ]);
  statusListener?.({ state: 'pending', pending: next.length });
  processSyncQueue();
};

export const processSyncQueue = async () => {
  if (isProcessing || !isOnline) return;
  isProcessing = true;
  let syncedAny = false;
  try {
    const queue = await getSyncQueue();
    if (queue.length === 0) {
      statusListener?.({ state: 'synced', pending: 0 });
      return;
    }

    for (const item of queue) {
      try {
        await executeSyncAction(item);
        syncedAny = true;
        await mutateQueue(current => current.filter(entry => entry.queueId !== item.queueId));
      } catch (e) {
        reportError(e, 'cloud-sync', { table: item.table, type: item.type });
      }
    }
    const remaining = await getSyncQueue();
    if (remaining.length === 0 && syncedAny) {
      retryAttempt = 0;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      await storage.saveBackupMeta({ lastBackupAt: new Date().toISOString() });
    }
    statusListener?.({ state: remaining.length ? 'pending' : 'synced', pending: remaining.length });
    if (remaining.length) scheduleRetry();
  } catch (error) {
    reportError(error, 'sync-queue');
    const remaining = await getSyncQueue();
    statusListener?.({ state: 'pending', pending: remaining.length || 1 });
    scheduleRetry();
  } finally {
    isProcessing = false;
    const queued = await getSyncQueue();
    if (isOnline && queued.length && syncedAny) processSyncQueue();
  }
};

const executeSyncAction = async (action) => {
  const payload = buildCloudRow(action.table, action.data, action.userId);
  // Locked medals are useful locally for progress display but are not cloud
  // records until they have actually been earned.
  if (!payload) return;

  if (action.type === 'delete') {
    let request = supabase.from(action.table).delete().eq('id', payload.id);
    if (action.table !== 'users') request = request.eq('user_id', action.userId);
    const { error } = await request;
    if (error) throw error;
    return;
  }

  // Upsert makes retries safe: a response can be lost after Supabase commits,
  // and retrying must not create duplicates or fail on a primary-key conflict.
  const { error } = await supabase.from(action.table).upsert(payload, { onConflict: 'id' });
  if (error) throw error;
};

export const queueAllUserData = async userId => {
  if (!userId) return { workouts: 0, cards: 0, medals: 0 };
  const [workouts, cards, medals, xp] = await Promise.all([
    storage.getWorkouts(),
    storage.getWrappedCards(),
    storage.getMedals(),
    storage.getXpData(),
  ]);
  const earnedMedals = medals.filter(medal => medal.unlockedAt);
  const actions = [
    ...workouts.map(data => ({ table: 'workouts', type: 'insert', data })),
    ...cards.map(data => ({ table: 'wrapped_cards', type: 'insert', data })),
    ...earnedMedals.map(data => ({ table: 'medals', type: 'insert', data })),
    { table: 'users', type: 'update', data: { id: userId, xp: xp.totalXp || 0, level: getLevel(xp.totalXp || 0) } },
  ];

  for (const action of actions) {
    await addToSyncQueue(action.table, action.type, action.data, userId);
  }
  return { workouts: workouts.length, cards: cards.length, medals: earnedMedals.length };
};

export const syncUserData = async (userId) => {
  const { data: remoteWorkouts, error: wErr } = await supabase
    .from('workouts')
    .select('*')
    .eq('user_id', userId);
  if (!wErr && remoteWorkouts) {
    const local = await storage.getWorkouts();
    const merged = mergeById(local, remoteWorkouts);
    await storage.saveWorkouts(merged);
  }

  const { data: remoteCards, error: cErr } = await supabase
    .from('wrapped_cards')
    .select('*')
    .eq('user_id', userId);
  if (!cErr && remoteCards) {
    const local = await storage.getWrappedCards();
    const merged = mergeById(local, remoteCards);
    await storage.saveWrappedCards(merged);
  }

  const { data: remoteMedals, error: mErr } = await supabase
    .from('medals')
    .select('*')
    .eq('user_id', userId);
  if (!mErr && remoteMedals) {
    const local = await storage.getMedals();
    const merged = mergeById(local, remoteMedals);
    await storage.saveMedals(merged);
  }
};

const mergeById = (local, remote) => {
  const map = new Map();
  for (const item of local) map.set(item.id, item);
  for (const item of remote) {
    const existing = map.get(item.id);
    map.set(item.id, existing ? { ...existing, ...item } : item);
  }
  return [...map.values()];
};

export const pushWorkoutToSupabase = (workout, userId) =>
  addToSyncQueue('workouts', 'insert', workout, userId);

export const pushMedalToSupabase = (medal, userId) =>
  addToSyncQueue('medals', 'insert', medal, userId);

export const pushWrappedCardToSupabase = (card, userId) =>
  addToSyncQueue('wrapped_cards', 'insert', card, userId);
