import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function prepareNotifications() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('lembretes', {
      name: 'Lembretes',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (!current.granted) {
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  }
  return true;
}

export async function scheduleReminder(reminder) {
  const allowed = await prepareNotifications();
  if (!allowed) return null;
  const date = new Date(`${reminder.reminderDate}T${reminder.reminderTime}:00`);
  return Notifications.scheduleNotificationAsync({
    content: {
      title: reminder.title,
      body: reminder.notes || 'Você tem um compromisso agora.',
      sound: 'default',
    },
    trigger: Platform.OS === 'android'
      ? { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: 'lembretes' }
      : date,
  });
}

export async function cancelReminder(notificationId) {
  if (notificationId) await Notifications.cancelScheduledNotificationAsync(notificationId);
}
