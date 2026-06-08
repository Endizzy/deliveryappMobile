// notificationSound.js
// ВРЕМЕННО: воспроизведение звука отключено (зависимость expo-audio убрана
// из-за краша нативной части в standalone-сборке). Оповещение о новом заказе
// сейчас — только короткая вибрация. Тумблер в настройках управляет вибрацией,
// значение сохраняется в AsyncStorage. Звук вернём, когда подключим аудио
// правильно (через expo prebuild / линковку нативного модуля).

import { Vibration } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SOUND_KEY = 'notificationSoundEnabled';

let enabled = true; // кэш настройки в памяти

// Загрузить сохранённое значение настройки при старте приложения.
export async function initOrderSound() {
    try {
        const v = await AsyncStorage.getItem(SOUND_KEY);
        enabled = v === null ? true : v === '1';
    } catch (e) {
        enabled = true;
    }
    return enabled;
}

export function isOrderSoundEnabled() {
    return enabled;
}

// Изменить настройку (вкл/выкл) и сохранить её.
export async function setOrderSoundEnabled(value) {
    enabled = !!value;
    try {
        await AsyncStorage.setItem(SOUND_KEY, enabled ? '1' : '0');
    } catch (e) {
        // ignore
    }
    // При включении — короткая вибрация как подтверждение.
    if (enabled) vibrateOrder();
}

// Заглушка звука (вернём вместе с аудио-модулем).
export async function playOrderSound() {
    // no-op
}

// Короткая вибрация.
export function vibrateOrder() {
    try { Vibration.vibrate(200); } catch (e) {}
}

// Оповещение о новом заказе: вибрация, если оповещения включены.
export function notifyNewOrder() {
    if (!enabled) return;
    vibrateOrder();
}
