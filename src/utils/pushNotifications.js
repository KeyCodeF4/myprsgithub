import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { reportError } from './errorReporter';

export async function registerForPushNotifications(userId) {
  if (!Device.isDevice || !userId) return null;

  let finalStatus;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
  } catch (e) {
    reportError(e, 'notification-permission');
    return null;
  }

  if (finalStatus !== 'granted') return null;

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('wrapped', {
        name: 'Wrapped Cards',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    const { error } = await supabase.from('push_tokens').upsert(
      { user_id: userId, token: tokenData.data },
      { onConflict: 'user_id,token' }
    );

    if (error) reportError(error, 'save-push-token');

    return tokenData.data;
  } catch (e) {
    reportError(e, 'register-push-token');
    return null;
  }
}

export async function unregisterPushTokens(userId) {
  if (!userId) return;
  try {
    await supabase.from('push_tokens').delete().eq('user_id', userId);
  } catch (e) {
    reportError(e, 'unregister-push-token');
  }
}
