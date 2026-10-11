import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { getAnalyticsConsent } from './storage';

const INSTALLATION_KEY = '@myprs_analytics_installation';
const QUEUE_KEY = '@myprs_analytics_queue';
const MAX_QUEUE_SIZE = 100;

const ALLOWED_EVENTS = new Set([
  'onboarding.completed',
  'workout.logged',
  'wrapped.created',
  'wrapped.shared',
  'medal.unlocked',
  'medal.equipped',
  'theme.equipped',
]);

const ALLOWED_PROPERTIES = new Set([
  'card_type',
  'duration_minutes',
  'equipped',
  'exercise_count',
  'format',
  'has_custom_title',
  'medal_tier',
  'starting_stats_count',
  'theme_id',
  'tier_id',
]);

let flushPromise = null;

function cleanProperties(properties = {}) {
  const clean = {};
  for (const [key, value] of Object.entries(properties)) {
    if (!ALLOWED_PROPERTIES.has(key)) continue;
    if (['string', 'number', 'boolean'].includes(typeof value)) clean[key] = value;
  }
  return clean;
}

async function getInstallationId() {
  const existing = await AsyncStorage.getItem(INSTALLATION_KEY);
  if (existing) return existing;
  const created = `install_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(INSTALLATION_KEY, created);
  return created;
}

async function readQueue() {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE_SIZE)));
}

export async function clearAnalyticsQueue() {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

export async function flushAnalytics() {
  if (flushPromise) return flushPromise;
  flushPromise = (async () => {
    try {
      if (!(await getAnalyticsConsent())) return false;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return false;

      const queue = await readQueue();
      if (queue.length === 0) return true;

      const { error } = await supabase.from('product_events').insert(queue);
      if (error) return false;
      await writeQueue([]);
      return true;
    } catch {
      // Analytics is non-essential and must never interrupt workout logging.
      return false;
    } finally {
      flushPromise = null;
    }
  })();
  return flushPromise;
}

export async function trackEvent(name, properties = {}) {
  try {
    if (!ALLOWED_EVENTS.has(name) || !(await getAnalyticsConsent())) return false;
    const installationId = await getInstallationId();
    const queue = await readQueue();
    queue.push({
      installation_id: installationId,
      event_name: name,
      properties: cleanProperties(properties),
      platform: Platform.OS,
      occurred_at: new Date().toISOString(),
    });
    await writeQueue(queue);
    flushAnalytics();
    return true;
  } catch {
    return false;
  }
}

