import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

// While the app is open the in-app banner shows new windows and knocks, so phone notifications stay
// quiet then. The one exception is the test from the You tab, which you want to see right away.
Notifications.setNotificationHandler({
  handleNotification: async (n) => {
    const test = (n.request.content.data as { type?: string } | undefined)?.type === 'test';
    return { shouldShowBanner: test, shouldShowList: test, shouldPlaySound: test, shouldSetBadge: false };
  },
});

const PREF = 'window.notifications';

/** Whether this phone should get notifications (the You tab switch). On unless turned off. */
export async function notificationsWanted(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PREF)) !== 'off';
  } catch {
    return true;
  }
}

export async function setNotificationsWanted(on: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(PREF, on ? 'on' : 'off');
  } catch { /* the server copy (push_tokens) still decides what gets sent */ }
}

/** 'unsupported' = simulator or Android in Expo Go (needs a real app build there). */
export async function notificationPermission(): Promise<'granted' | 'denied' | 'undetermined' | 'unsupported'> {
  if (!Device.isDevice || (Platform.OS === 'android' && Constants.executionEnvironment === 'storeClient')) return 'unsupported';
  try {
    return (await Notifications.getPermissionsAsync()).status as 'granted' | 'denied' | 'undetermined';
  } catch {
    return 'unsupported';
  }
}

export async function getPushToken(): Promise<string | null> {
  try {
    if (!Device.isDevice || (Platform.OS === 'android' && Constants.executionEnvironment === 'storeClient')) return null;
    const permissions = await Notifications.getPermissionsAsync();
    const status = permissions.status === 'granted' ? permissions.status : (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return null;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return null;
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    return null;
  }
}

/** Tapping a "window arrived" notification opens that letter; a knock opens Today. */
export function useNotificationTaps() {
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const data = response?.notification.request.content.data as { type?: string; id?: string } | undefined;
    if (!data?.type) return;
    if (data.type === 'window' && data.id) router.push({ pathname: '/window/[id]', params: { id: data.id } });
    else router.push('/today');
  }, [response]);
}
