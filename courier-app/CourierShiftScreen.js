// courierShiftScreen.js
import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Platform,
    Alert,
    ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TASK_NAME } from './locationTask'; // оставьте как есть
import { WS_URL } from './constants'; // или замените на строку 'wss://...' если нет constants

const UNIT_KEY = 'unit';   // ожидаемый объект { unitId, unitNickname }
const TOKEN_KEY = 'token'; // JWT

const FOREGROUND_SERVICE = {
    notificationTitle: 'Смена активна',
    notificationBody: 'Идёт передача геолокации для заказов.',
};

// Декодируем base64url payload (JWT). Используем Buffer fallback.
function decodeJwtPayload(token) {
    try {
        const parts = token.split('.');
        if (parts.length < 2) return null;
        let payload = parts[1];
        payload = payload.replace(/-/g, '+').replace(/_/g, '/');
        const pad = payload.length % 4;
        if (pad) payload += '='.repeat(4 - pad);
        let jsonStr;
        if (typeof globalThis.atob === 'function') {
            jsonStr = globalThis.atob(payload);
        } else if (typeof Buffer !== 'undefined') {
            jsonStr = Buffer.from(payload, 'base64').toString('utf8');
        } else {
            return null;
        }
        return JSON.parse(jsonStr);
    } catch (e) {
        return null;
    }
}

export default function CourierShiftScreen({ onLogout }) {
    const [unit, setUnit] = useState(null); // { unitId, unitNickname }
    const [status, setStatus] = useState('offline');
    const [loading, setLoading] = useState(true);
    const wsRef = useRef(null);

    useEffect(() => {
        (async () => {
            try {
                // 1) Попытка получить объект unit из AsyncStorage
                const rawUnit = await AsyncStorage.getItem(UNIT_KEY);
                if (rawUnit) {
                    try {
                        const parsed = JSON.parse(rawUnit);
                        if (parsed && (parsed.unitId || parsed.unitId === 0)) {
                            setUnit({
                                unitId: Number(parsed.unitId),
                                unitNickname: parsed.unitNickname ?? null,
                            });
                            setLoading(false);
                            return;
                        }
                    } catch {
                        // не JSON — игнорируем
                    }
                }

                // 2) Попытка извлечь из токена JWT
                const token = await AsyncStorage.getItem(TOKEN_KEY);
                if (token) {
                    const payload = decodeJwtPayload(token);
                    if (payload) {
                        const unitId = payload.unitId ?? payload.userId ?? payload.unit_id ?? payload.user_id ?? null;
                        const unitNickname = payload.unitNickname ?? payload.unit_nickname ?? payload.nickname ?? null;
                        if (unitId) {
                            const normalized = { unitId: Number(unitId), unitNickname: unitNickname ?? null };
                            // Сохраняем для будущих запусков
                            try {
                                await AsyncStorage.setItem(UNIT_KEY, JSON.stringify(normalized));
                            } catch {}
                            setUnit(normalized);
                            setLoading(false);
                            return;
                        }
                    }
                }

                // 3) Ничего не найдено
                setUnit(null);
            } catch (e) {
                console.warn('Error loading unit', e);
                setUnit(null);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    useEffect(() => {
        if (!unit) return;
        let ws;
        try {
            ws = new WebSocket(WS_URL);
        } catch (e) {
            console.warn('WS init failed', e);
            return;
        }
        wsRef.current = ws;

        ws.onopen = async () => {
            // пытаемся взять companyId из токена — если есть
            let companyId = null;
            try {
                const token = await AsyncStorage.getItem(TOKEN_KEY);
                if (token) {
                    const payload = decodeJwtPayload(token);
                    companyId = payload?.companyId ?? payload?.company_id ?? null;
                }
            } catch (e) {}

            const hello = {
                type: 'hello',
                role: 'courier',
                courierId: unit.unitId,
                courierNickname: unit.unitNickname ?? null,
                companyId,
            };
            try {
                ws.send(JSON.stringify(hello));
            } catch (e) {
                console.warn('WS send failed', e);
            }
        };

        ws.onmessage = (evt) => {
            try {
                const data = JSON.parse(evt.data);
                // handle server messages if needed
                console.log('WS message', data);
            } catch (e) {
                console.log('WS raw', evt.data);
            }
        };

        ws.onclose = () => {};
        ws.onerror = (e) => console.warn('WS error', e && e.message ? e.message : e);

        return () => {
            try { ws && ws.close(); } catch (e) {}
        };
    }, [unit]);

    const handleExit = async () => {
        try {
            // остановка фоновой задачи (если зарегистрирована)
            try {
                const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
                if (isRegistered) await Location.stopLocationUpdatesAsync(TASK_NAME);
            } catch (e) {
                console.warn('Stop task error', e);
            }

            // закрыть WS
            try { wsRef.current && wsRef.current.close(); } catch (e) {}

            // удалить ключи
            await AsyncStorage.removeItem(TOKEN_KEY);
            await AsyncStorage.removeItem(UNIT_KEY);
            await AsyncStorage.removeItem('courierId');

            onLogout && onLogout();
        } catch (e) {
            console.error('Logout error', e);
            Alert.alert('Ошибка', 'Не удалось выйти. Попробуйте ещё раз.');
        }
    };

    const ensurePermissions = async () => {
        let fg = await Location.getForegroundPermissionsAsync();
        if (fg.status !== 'granted') {
            fg = await Location.requestForegroundPermissionsAsync();
            if (fg.status !== 'granted') throw new Error('Нужны права на геолокацию');
        }
        let bg = await Location.getBackgroundPermissionsAsync();
        if (bg.status !== 'granted') {
            bg = await Location.requestBackgroundPermissionsAsync();
            if (bg.status !== 'granted') throw new Error('Нужны права на геолокацию в фоне');
        }
    };

    const startShift = async () => {
        try {
            await ensurePermissions();

            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('location', {
                    name: 'Location',
                    importance: Notifications.AndroidImportance.DEFAULT,
                });
            }

            await AsyncStorage.setItem('onShift', '1');

            const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
            if (!isRegistered) {
                await Location.startLocationUpdatesAsync(TASK_NAME, {
                    accuracy: Location.Accuracy.High,
                    timeInterval: 5000,
                    distanceInterval: 10,
                    pausesUpdatesAutomatically: false,
                    showsBackgroundLocationIndicator: true,
                    foregroundService: {
                        notificationTitle: FOREGROUND_SERVICE.notificationTitle,
                        notificationBody: FOREGROUND_SERVICE.notificationBody,
                        notificationColor: '#000000',
                    },
                });
            }

            setStatus('online');
        } catch (e) {
            console.warn(e);
            Alert.alert('Ошибка', e.message || 'Не удалось запустить смену');
        }
    };

    const stopShift = async () => {
        try {
            await AsyncStorage.removeItem('onShift');
            const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
            if (isRegistered) await Location.stopLocationUpdatesAsync(TASK_NAME);
            setStatus('offline');
        } catch (e) {
            console.warn('Error stopping shift', e);
            Alert.alert('Ошибка', 'Не удалось остановить смену');
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" />
                <Text style={{ marginTop: 12 }}>Загрузка данных курьера...</Text>
            </View>
        );
    }

    const nickname = unit?.unitNickname ?? 'Курьер';
    const idText = unit?.unitId ? String(unit.unitId) : '—';
    const initial = (nickname && nickname.length > 0) ? nickname[0].toUpperCase() : '?';

    return (
        <View style={styles.container}>
            <View style={styles.headerCard}>
                <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>{initial}</Text>
                </View>

                <View style={styles.infoBlock}>
                    <Text style={styles.nickname}>{nickname}</Text>
                    <Text style={styles.unitId}>ID: {idText}</Text>
                </View>

                <View style={styles.statusBlock}>
                    <Text style={[styles.statusText, status === 'online' ? styles.online : styles.offline]}>
                        {status.toUpperCase()}
                    </Text>
                </View>
            </View>

            <View style={styles.controls}>
                <TouchableOpacity style={styles.primaryButton} onPress={startShift}>
                    <Text style={styles.primaryButtonText}>Начать смену</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.ghostButton} onPress={stopShift}>
                    <Text style={styles.ghostButtonText}>Остановить</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.exitButton} onPress={handleExit}>
                    <Text style={styles.exitButtonText}>Выйти</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: '#f4f7fb' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f4f7fb' },

    headerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        marginTop: 40,
        padding: 16,
        borderRadius: 14,
        shadowColor: '#000',
        shadowOpacity: 0.03,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 12,
        elevation: 3,
    },
    avatarCircle: {
        width: 68,
        height: 68,
        borderRadius: 34,
        backgroundColor: '#007AFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: { color: '#fff', fontSize: 28, fontWeight: '700' },

    infoBlock: { marginLeft: 14, flex: 1 },
    nickname: { fontSize: 20, fontWeight: '700', color: '#111' },
    unitId: { marginTop: 6, fontSize: 13, color: '#657786' },

    statusBlock: { alignItems: 'flex-end' },
    statusText: { fontSize: 12, fontWeight: '800' },
    online: { color: '#16a34a' },
    offline: { color: '#888' },

    controls: { marginTop: 22, paddingTop: 4 },
    primaryButton: {
        backgroundColor: '#007AFF',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 12,
    },
    primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

    ghostButton: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e6e9ee',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 12,
    },
    ghostButtonText: { color: '#333', fontSize: 16, fontWeight: '700' },

    exitButton: {
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#fdecea',
    },
    exitButtonText: { color: '#c53030', fontWeight: '800' },
});
