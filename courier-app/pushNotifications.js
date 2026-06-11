// pushNotifications.js
// Push-уведомления о новых заказах (Expo Push). Дополняет WebSocket:
// WS — для живых обновлений при открытом приложении, push — чтобы уведомить
// курьера, когда приложение свёрнуто или закрыто.

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ORIGIN } from './constants';

// projectId из app.json → extra.eas.projectId (нужен для getExpoPushTokenAsync)
const PROJECT_ID = 'bddc95df-5d2b-4c34-be76-ff4fc4a333c3';
const TOKEN_KEY = 'authToken';
export const ORDERS_CHANNEL = 'orders';

// Как показывать уведомление, когда приложение НА ПЕРЕДНЕМ ПЛАНЕ.
// Звук не проигрываем — при открытом приложении звук уже даёт WS (notifyNewOrder),
// иначе будет двойной сигнал. В фоне ОС покажет уведомление со звуком канала сама.
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldShowAlert: true, // для совместимости со старым API
        shouldPlaySound: false,
        shouldSetBadge: false,
    }),
});

// Android-канал для заказов (с высокой важностью и звуком)
export async function ensureOrdersChannel() {
    if (Platform.OS !== 'android') return;
    try {
        await Notifications.setNotificationChannelAsync(ORDERS_CHANNEL, {
            name: 'Новые заказы',
            importance: Notifications.AndroidImportance.HIGH,
            sound: 'default',
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#2F8CFF',
        });
    } catch (e) {
        // ignore
    }
}

// Запросить разрешение, получить Expo-токен и отправить его на сервер.
// Безопасно: при любой ошибке (нет FCM, нет разрешения) просто вернёт null,
// приложение не падает — push просто не будет работать, пока не настроен.
export async function registerPushToken() {
    try {
        await ensureOrdersChannel();

        const current = await Notifications.getPermissionsAsync();
        let granted = current.granted || current.status === 'granted';
        if (!granted) {
            const req = await Notifications.requestPermissionsAsync();
            granted = req.granted || req.status === 'granted';
        }
        console.log('[push] permission granted:', granted);
        if (!granted) {
            console.warn('[push] notifications permission NOT granted — токен не получаем');
            return null;
        }

        let expoToken = null;
        try {
            const tokenResp = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
            expoToken = tokenResp?.data;
        } catch (tokErr) {
            console.warn('[push] getExpoPushTokenAsync FAILED (вероятно не настроен FCM):', tokErr?.message ?? tokErr);
            return null;
        }
        console.log('[push] expo token:', expoToken);
        if (!expoToken) return null;

        const authToken = await AsyncStorage.getItem(TOKEN_KEY);
        if (!authToken) {
            console.warn('[push] нет authToken — не регистрируем на сервере');
            return expoToken;
        }

        try {
            const res = await fetch(`${ORIGIN}/api/push/register-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authToken}`,
                },
                body: JSON.stringify({ token: expoToken, platform: Platform.OS }),
            });
            console.log('[push] register-token POST ->', res.status, ORIGIN);
        } catch (postErr) {
            console.warn('[push] register-token POST error:', postErr?.message ?? postErr);
        }

        return expoToken;
    } catch (e) {
        console.warn('[push] registerPushToken error:', e?.message ?? e);
        return null;
    }
}

// Удалить токены курьера на сервере (при выходе из аккаунта).
export async function unregisterPushToken() {
    try {
        const authToken = await AsyncStorage.getItem(TOKEN_KEY);
        if (!authToken) return;
        await fetch(`${ORIGIN}/api/push/unregister-token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authToken}`,
            },
        }).catch(() => {});
    } catch (e) {
        // ignore
    }
}

// Подписка на тап по уведомлению. Возвращает функцию отписки.
export function addOrderTapListener(handler) {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
        try {
            const data = response?.notification?.request?.content?.data || {};
            handler?.(data);
        } catch (e) {
            // ignore
        }
    });
    return () => {
        try { sub.remove(); } catch (e) {}
    };
}
