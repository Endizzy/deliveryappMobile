// Push-уведомления о новых заказах (Expo Push). Дополняет WebSocket:
// WS — для живых обновлений при открытом приложении, push — чтобы уведомить
// курьера, когда приложение свёрнуто или закрыто.

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ORIGIN } from './constants';
import { isLive, claimOrderNotification } from './wsLiveness';

// projectId из app.json → extra.eas.projectId (нужен для getExpoPushTokenAsync)
const PROJECT_ID = 'bddc95df-5d2b-4c34-be76-ff4fc4a333c3';
const TOKEN_KEY = 'authToken';
export const ORDERS_CHANNEL = 'orders';

// Поведение, когда приложение НА ПЕРЕДНЕМ ПЛАНЕ.
//
// Push — резервный канал оповещения, и глушить его можно ТОЛЬКО когда основной
// канал доказанно работает. Раньше баннер подавлялся безусловно: если WS в этот
// момент был мёртв (half-open после Doze/смены сети), курьер не получал ни
// WS-звука, ни push — заказ приходил молча. Теперь решает состояние канала:
//
//   • WS живой и этот заказ уже озвучен по WS → молчим (не дублируем сигнал);
//   • WS мёртв, либо заказ по WS не приходил  → показываем баннер со звуком.
//
// claimOrderNotification гарантирует ровно один сигнал на заказ независимо от
// того, какой канал сработал первым.
// В фоне обработчик не вызывается — там ОС сама показывает push со звуком канала.
Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
        const data = notification?.request?.content?.data || {};
        const orderId = data.orderId ?? null;

        // Живой канал уже принёс этот заказ и проиграл звук — дубль не нужен
        const alreadySignalled = !claimOrderNotification(orderId);
        const suppress = isLive() && alreadySignalled;

        if (suppress) {
            return {
                shouldShowBanner: false,
                shouldShowList: false,
                shouldShowAlert: false,
                shouldPlaySound: false,
                shouldSetBadge: false,
            };
        }

        return {
            shouldShowBanner: true,
            shouldShowList: true,
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
        };
    },
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

// Подписка на ПОЛУЧЕНИЕ уведомления при открытом приложении.
// Push здесь работает не только как звук, но и как триггер синхронизации:
// раз сервер прислал уведомление о заказе, списки нужно перечитать немедленно,
// не дожидаясь очередного тика поллинга — особенно если WS в этот момент мёртв.
export function addOrderReceivedListener(handler) {
    const sub = Notifications.addNotificationReceivedListener((notification) => {
        try {
            const data = notification?.request?.content?.data || {};
            handler?.(data);
        } catch (e) {
            // ignore
        }
    });
    return () => {
        try { sub.remove(); } catch (e) {}
    };
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
