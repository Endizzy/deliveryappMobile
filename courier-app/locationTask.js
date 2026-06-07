import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_LOCATION } from './constants';

export const TASK_NAME = 'COURIER_LOCATION_TASK';

TaskManager.defineTask(TASK_NAME, async ({ data, error }) => {
    try {
        if (error) {
            console.log('Location task error', error);
            return;
        }
        const { locations } = data || {};
        if (!locations || locations.length === 0) return;

        // Берём последний фикс
        const loc = locations[locations.length - 1];

        // Попытка получить courierId: сначала отдельный ключ, затем — объект unit
        let courierId = await AsyncStorage.getItem('courierId');
        if (!courierId) {
            const rawUnit = await AsyncStorage.getItem('unit');
            if (rawUnit) {
                try {
                    const parsed = JSON.parse(rawUnit);
                    if (parsed && (parsed.unitId || parsed.unitId === 0)) {
                        courierId = String(parsed.unitId);
                    }
                } catch (e) {
                    // ignore
                }
            }
        }

        const onShift = await AsyncStorage.getItem('onShift'); // "1" | null

        // Fail-closed приватность: если смена НЕ активна — ничего не отправляем
        // и принудительно глушим фоновую подписку, чтобы ОС не «воскрешала» её
        // после остановки смены или гибели процесса приложения.
        if (onShift !== '1') {
            try {
                const started = await Location.hasStartedLocationUpdatesAsync(TASK_NAME);
                if (started) await Location.stopLocationUpdatesAsync(TASK_NAME);
            } catch (e) {
                // ignore
            }
            return;
        }

        if (!courierId) return;

        const body = {
            type: 'location',
            courierId: Number(courierId),
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
            speedKmh: typeof loc.coords.speed === 'number' ? loc.coords.speed * 3.6 : null,
            status: 'on_shift',
            timestamp: new Date(loc.timestamp || Date.now()).toISOString(),
        };

        // Отправляем через REST на сервер; без await — чтобы не блокировать
        fetch(API_LOCATION, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }).catch(() => {});
    } catch (e) {
        console.log('Location task exception', e);
    }
});
