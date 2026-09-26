import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';

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
