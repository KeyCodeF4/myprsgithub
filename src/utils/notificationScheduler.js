import { Platform } from 'react-native';
import { reportError } from './errorReporter';

let Notifications = null;
try {
  Notifications = require('expo-notifications');
} catch (e) {
  reportError(e, 'notification-module');
  console.warn('expo-notifications not available');
}

export async function registerForPushNotifications() {
  if (!Notifications) return false;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return false;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('wrapped', {
        name: 'Wrapped Cards',
        importance: Notifications.AndroidImportance.HIGH,
      });
      // Reminders get their own lower-importance channel so users can mute the
      // daily nudge without losing Wrapped notifications.
      await Notifications.setNotificationChannelAsync('reminders', {
        name: 'Workout Reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    return true;
  } catch (e) {
    reportError(e, 'notification-registration');
    return false;
  }
}

export async function scheduleWeeklyNotification() {
  if (!Notifications) return null;
  try {
    await Notifications.cancelScheduledNotificationAsync('weekly_wrapped');
  } catch (e) {
    reportError(e, 'cancel-weekly-notification');
  }

  const trigger = {
    type: 'weekly',
    weekday: 1,
    hour: 20,
    minute: 0,
  };

  try {
    const id = await Notifications.scheduleNotificationAsync({
      identifier: 'weekly_wrapped',
      content: {
        title: 'Your Weekly Wrapped is ready!',
        body: 'See how your week stacked up — volume, streaks, PRs, and more.',
        data: { type: 'weekly' },
        sound: true,
      },
      trigger,
    });
    return id;
  } catch (e) {
    reportError(e, 'schedule-weekly-notification');
    return null;
  }
}

export async function scheduleMonthlyNotification() {
  if (!Notifications) return null;
  try {
    await Notifications.cancelScheduledNotificationAsync('monthly_wrapped');
  } catch (e) {
    reportError(e, 'cancel-monthly-notification');
  }

  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 10, 0, 0);

  try {
    const id = await Notifications.scheduleNotificationAsync({
      identifier: 'monthly_wrapped',
      content: {
        title: 'Monthly Wrapped is here!',
        body: 'Your biggest month yet? Check out your full monthly stats.',
        data: { type: 'monthly' },
        sound: true,
      },
      trigger: {
        date: nextMonth,
        channelId: 'wrapped',
      },
    });
    return id;
  } catch (e) {
    reportError(e, 'schedule-monthly-notification');
    return null;
  }
}

// Rotating copy so a daily reminder doesn't read like the same robot every day.
const DAILY_NUDGES = [
  { title: 'Log today’s session', body: 'Two taps and your Wrapped is updated.' },
  { title: 'Did you train today?', body: 'Keep the streak alive — log it before midnight.' },
  { title: 'Your Wrapped is waiting', body: 'Add today’s lifts and see how the numbers move.' },
  { title: 'Don’t break the chain', body: 'A quick log keeps your streak and XP climbing.' },
];

export const DAILY_NUDGE_ID = 'daily_log_nudge';

/**
 * Opt-in daily reminder to log a workout. This is the feature that justifies
 * asking for the notification permission at all — without it we'd be requesting
 * a permission the user never sees a benefit from.
 *
 * @param hour 24h local hour to fire (default 19:00)
 */
export async function scheduleDailyLogNudge(hour = 19, minute = 0) {
  if (!Notifications) return null;
  try {
    await Notifications.cancelScheduledNotificationAsync(DAILY_NUDGE_ID);
  } catch (e) {
    // Nothing scheduled yet is the normal first-run case, not an error worth reporting.
  }

  const nudge = DAILY_NUDGES[new Date().getDate() % DAILY_NUDGES.length];

  try {
    return await Notifications.scheduleNotificationAsync({
      identifier: DAILY_NUDGE_ID,
      content: {
        title: nudge.title,
        body: nudge.body,
        data: { type: 'daily-nudge' },
        sound: false, // a daily reminder shouldn't make noise
      },
      trigger: {
        type: 'daily',
        hour,
        minute,
        channelId: 'reminders',
      },
    });
  } catch (e) {
    reportError(e, 'schedule-daily-nudge');
    return null;
  }
}

export async function cancelDailyLogNudge() {
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(DAILY_NUDGE_ID);
  } catch (e) {
    reportError(e, 'cancel-daily-nudge');
  }
}

export async function cancelAllNotifications() {
  if (!Notifications) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    reportError(e, 'cancel-all-notifications');
  }
}
