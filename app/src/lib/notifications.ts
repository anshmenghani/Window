import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

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
