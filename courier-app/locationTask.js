import * as TaskManager from 'expo-task-manager';
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

        // Берём последний фикc
        const loc = locations[locations.length - 1];
        const courierId = await AsyncStorage.getItem('courierId');
        const onShift = await AsyncStorage.getItem('onShift'); // "1" | null

        if (!courierId || onShift !== '1') return;

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
