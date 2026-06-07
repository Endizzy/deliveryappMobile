
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Vibration } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SOUND_KEY = 'notificationSoundEnabled';

const SOUND_SOURCE = require('./assets/orderNotification.mp3');

let enabled = true;      // текущее состояние (кэш в памяти)
let player = null;       // переиспользуемый плеер
let audioModeReady = false;

function ensurePlayer() {
    if (!player) {
        try {
            player = createAudioPlayer(SOUND_SOURCE);
        } catch (e) {
            player = null;
        }
    }
    return player;
}

async function ensureAudioMode() {
    if (audioModeReady) return;
    try {
        // Проигрывать даже когда телефон в беззвучном режиме
        await setAudioModeAsync({ playsInSilentMode: true });
        audioModeReady = true;
    } catch (e) {
        // ignore
    }
}

// Загрузить сохранённое значение настройки при старте приложения.
export async function initOrderSound() {
    try {
        const v = await AsyncStorage.getItem(SOUND_KEY);
        enabled = v === null ? true : v === '1';
    } catch (e) {
        enabled = true;
    }
    await ensureAudioMode();
    ensurePlayer();
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
    // При включении оповещений проигрываем звук — как подтверждение/превью.
    if (enabled) playOrderSound();
}

// Проиграть звук, если оповещения включены.
export async function playOrderSound() {
    if (!enabled) return;
    try {
        await ensureAudioMode();
        const p = ensurePlayer();
        if (!p) return;
        // Перемотать в начало, чтобы звук срабатывал и при частых заказах подряд
        try { await p.seekTo(0); } catch (e) {}
        p.play();
    } catch (e) {
        // ignore — звук не критичен для работы приложения
    }
}

// Короткая вибрация.
export function vibrateOrder() {
    try { Vibration.vibrate(200); } catch (e) {}
}

// Полное оповещение о новом заказе: вибрация + звук
export function notifyNewOrder() {
    if (!enabled) return;
    vibrateOrder();
    playOrderSound();
}
