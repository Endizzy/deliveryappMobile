// CourierShiftScreen.js
import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Platform,
    Alert,
    ActivityIndicator,
    Linking,
} from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TASK_NAME } from './locationTask';
import { WS_URL, API_LOCATION, ORIGIN } from './constants';

import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import AllOrdersScreen from './AllOrdersScreen';
import OrdersListScreenModern from './OrdersListScreenModern';
import OrderDetailsScreenModern from './OrderDetailsScreenModern';
import MyOrdersScreen from './MyOrdersScreen';
import TabNavigationBar, { TABS as TAB_TYPES } from './TabNavigationBar';
import { useOrdersWebSocket } from './useOrdersWebSocket';

const UNIT_KEY  = 'unit';
const TOKEN_KEY = 'authToken';

const FOREGROUND_SERVICE = {
    notificationTitle: 'Смена активна',
    notificationBody:  'Идёт передача геолокации для заказов.',
};

function decodeJwtPayload(token) {
    try {
        const parts = token.split('.');
        if (parts.length < 2) return null;
        let p = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const pad = p.length % 4;
        if (pad) p += '='.repeat(4 - pad);
        const json =
            typeof globalThis.atob === 'function'
                ? globalThis.atob(p)
                : Buffer.from(p, 'base64').toString('utf8');
        return JSON.parse(json);
    } catch {
        return null;
    }
}

// Подсчитать количество заказов по каждой точке выдачи
function getOutletCounts(orders) {
    return orders.reduce((acc, o) => {
        const key = (o.outlet || '').toLowerCase();
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});
}

export default function CourierShiftScreen({ onLogout }) {
    const [unit,    setUnit]    = useState(null);
    const [status,  setStatus]  = useState('offline');
    const [loading, setLoading] = useState(true);

    const insets = useSafeAreaInsets();

    // ── Tab / navigation state ──────────────────────────────────────────────
    const [activeTab,      setActiveTab]      = useState(TAB_TYPES.MENU);
    const [selectedOutlet, setSelectedOutlet] = useState(null);
    const [selectedOrder,  setSelectedOrder]  = useState(null);

    // ── WebSocket + заказы ──────────────────────────────────────────────────
    const {
        availableOrders,
        myOrders,
        setMyOrders,
        connected,
        fetchAvailable,
        fetchMy,
        assignOrder,
        releaseOrder,
    } = useOrdersWebSocket({ unit });

    // ── Загрузка unit при старте ────────────────────────────────────────────
    useEffect(() => {
        (async () => {
            try {
                // 1) Из AsyncStorage
                const rawUnit = await AsyncStorage.getItem(UNIT_KEY);
                if (rawUnit) {
                    try {
                        const parsed = JSON.parse(rawUnit);
                        if (parsed && (parsed.unitId || parsed.unitId === 0)) {
                            const normalized = {
                                unitId:       Number(parsed.unitId),
                                unitNickname: parsed.unitNickname ?? null,
                            };
                            setUnit(normalized);
                            await AsyncStorage.setItem('courierId', String(normalized.unitId));
                            setLoading(false);
                            return;
                        }
                    } catch {}
                }

                // 2) Из JWT
                const token = await AsyncStorage.getItem(TOKEN_KEY);
                if (token) {
                    const payload = decodeJwtPayload(token);
                    if (payload) {
                        const unitId = payload.unitId ?? payload.userId ?? payload.unit_id ?? null;
                        const unitNickname = payload.unitNickname ?? payload.unit_nickname ?? null;
                        if (unitId) {
                            const normalized = { unitId: Number(unitId), unitNickname: unitNickname ?? null };
                            await AsyncStorage.setItem(UNIT_KEY,    JSON.stringify(normalized));
                            await AsyncStorage.setItem('courierId', String(normalized.unitId));
                            setUnit(normalized);
                            setLoading(false);
                            return;
                        }
                    }
                }

                setUnit(null);
            } catch (e) {
                console.warn('Error loading unit', e);
                setUnit(null);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    // ── Выход ───────────────────────────────────────────────────────────────
    const handleExit = async () => {
        try {
            try {
                const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
                if (isRegistered) await Location.stopLocationUpdatesAsync(TASK_NAME);
            } catch {}

            await AsyncStorage.removeItem(TOKEN_KEY);
            await AsyncStorage.removeItem(UNIT_KEY);
            await AsyncStorage.removeItem('courierId');
            await AsyncStorage.removeItem('myOrders');
            await AsyncStorage.removeItem('onShift');

            onLogout?.();
        } catch {
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
                    name:       'Location',
                    importance: Notifications.AndroidImportance.DEFAULT,
                });
            }
            await AsyncStorage.setItem('onShift', '1');
            const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
            if (!isRegistered) {
                await Location.startLocationUpdatesAsync(TASK_NAME, {
                    accuracy:                       Location.Accuracy.High,
                    timeInterval:                   5000,
                    distanceInterval:               10,
                    pausesUpdatesAutomatically:     false,
                    showsBackgroundLocationIndicator: true,
                    foregroundService: {
                        notificationTitle: FOREGROUND_SERVICE.notificationTitle,
                        notificationBody:  FOREGROUND_SERVICE.notificationBody,
                        notificationColor: '#000000',
                    },
                });
            }
            setStatus('online');
        } catch (e) {
            Alert.alert('Ошибка', e.message || 'Не удалось запустить смену');
        }
    };

    const stopShift = async () => {
        try {
            try {
                const courierId = unit?.unitId;
                let pos = null;
                try { pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }); } catch {}

                if (courierId && pos) {
                    fetch(API_LOCATION, {
                        method:  'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body:    JSON.stringify({
                            courierId:       Number(courierId),
                            lat:             pos.coords.latitude,
                            lng:             pos.coords.longitude,
                            speedKmh:        typeof pos.coords.speed === 'number' ? pos.coords.speed * 3.6 : null,
                            status:          'off_shift',
                            timestamp:       new Date(pos.timestamp || Date.now()).toISOString(),
                            courierNickname: unit?.unitNickname ?? null,
                        }),
                    }).catch(() => {});
                }
            } catch {}

            await AsyncStorage.removeItem('onShift');
            const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
            if (isRegistered) await Location.stopLocationUpdatesAsync(TASK_NAME);
            setStatus('offline');
        } catch {
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
    const idText   = unit?.unitId ? String(unit.unitId) : '—';
    const initial  = nickname.length > 0 ? nickname[0].toUpperCase() : '?';

    // ── Контент вкладок ──────────────────────────────────────────────────────
    function renderTabContent() {
        switch (activeTab) {

            // ─ Профиль / Смена ──────────────────────────────────────────────
            case TAB_TYPES.MENU:
                return (
                    <View style={styles.container}>
                        <View style={styles.headerCard}>
                            <View style={styles.avatarCircle}>
                                <Text style={styles.avatarText}>{initial}</Text>
                            </View>
                            <View style={styles.infoBlock}>
                                <Text style={styles.nickname}>{nickname}</Text>
                                <Text style={styles.unitId}>ID: {idText}</Text>
                                {/* Индикатор WS-соединения */}
                                <Text style={[styles.wsStatus, connected ? styles.wsOnline : styles.wsOffline]}>
                                    {connected ? '● Online' : '○ Connecting...'}
                                </Text>
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

            // ─ Все заказы ───────────────────────────────────────────────────
            case TAB_TYPES.ALL:
                return (
                    <View style={{ flex: 1 }}>
                        {selectedOrder ? (
                            <OrderDetailsScreenModern
                                order={selectedOrder}
                                outletName={selectedOutlet?.name ?? '—'}
                                onBack={() => setSelectedOrder(null)}
                                onTake={(order) => {
                                    (async () => {
                                        try {
                                            await assignOrder(order.id);
                                            // WS автоматически обновит availableOrders и myOrders
                                            setSelectedOrder(null);
                                            Alert.alert('Успешно', 'Заказ добавлен в ваши заказы');
                                        } catch (e) {
                                            Alert.alert('Ошибка', e.message);
                                        }
                                    })();
                                }}
                                onCall={(phone) => {
                                    Linking.openURL(`tel:${phone}`).catch(() => {});
                                }}
                            />
                        ) : !selectedOutlet ? (
                            <AllOrdersScreen
                                useSafeArea={false}
                                outletCounts={getOutletCounts(availableOrders)}
                                onOpenOutlet={(o) => setSelectedOutlet(o)}
                            />
                        ) : (
                            <OrdersListScreenModern
                                useSafeArea={false}
                                outlet={selectedOutlet}
                                orders={availableOrders}
                                companyId={idText}
                                companyTitle={nickname}
                                outletName={selectedOutlet?.name}
                                onBack={() => setSelectedOutlet(null)}
                                onRefresh={fetchAvailable}
                                onOpenOrder={(order) => setSelectedOrder(order)}
                            />
                        )}
                    </View>
                );

            // ─ Мои заказы ───────────────────────────────────────────────────
            case TAB_TYPES.MY:
                return (
                    <MyOrdersScreen
                        myOrders={myOrders}
                        useSafeArea={false}
                        onOpenOrder={(order) => {
                            setSelectedOrder(order);
                            setActiveTab(TAB_TYPES.ALL);
                        }}
                        onRemoveOrder={(orderId) => {
                            Alert.alert(
                                'Удалить заказ?',
                                'Заказ будет отказан и станет доступным для других курьеров.',
                                [
                                    { text: 'Отмена', style: 'cancel' },
                                    {
                                        text:  'Удалить',
                                        style: 'destructive',
                                        onPress: async () => {
                                            try {
                                                await releaseOrder(orderId);
                                                // WS обновит myOrders и availableOrders автоматически
                                            } catch (e) {
                                                Alert.alert('Ошибка', e.message);
                                            }
                                        },
                                    },
                                ]
                            );
                        }}
                        onCompleteOrder={(orderId) => {
                            // Локальная отметка "выполнен" (визуально)
                            setMyOrders((prev) =>
                                prev.map((o) =>
                                    o.id === orderId
                                        ? { ...o, completed: true, completedAt: new Date().toISOString() }
                                        : o
                                )
                            );
                        }}
                    />
                );

            default:
                return null;
        }
    }

    return (
        <SafeAreaView style={styles.safeContainer} edges={['top', 'left', 'right', 'bottom']}>
            <View style={styles.mainContent}>
                {renderTabContent()}
            </View>
            <TabNavigationBar activeTab={activeTab} onTabChange={setActiveTab} />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeContainer:    { flex: 1, backgroundColor: '#f4f7fb' },
    mainContent:      { flex: 1, backgroundColor: '#f4f7fb', paddingBottom: 12 },
    container:        { flex: 1, backgroundColor: '#f4f7fb' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f4f7fb' },

    headerCard: {
        flexDirection:  'row',
        alignItems:     'center',
        backgroundColor: '#fff',
        marginTop:      12,
        marginHorizontal: 12,
        padding:        14,
        borderRadius:   14,
        shadowColor:    '#000',
        shadowOpacity:  0.03,
        shadowOffset:   { width: 0, height: 6 },
        shadowRadius:   12,
        elevation:      3,
    },
    avatarCircle: {
        width:          56,
        height:         56,
        borderRadius:   28,
        backgroundColor: '#007AFF',
        justifyContent: 'center',
        alignItems:     'center',
    },
    avatarText:   { color: '#fff', fontSize: 22, fontWeight: '700' },
    infoBlock:    { marginLeft: 12, flex: 1 },
    nickname:     { fontSize: 18, fontWeight: '700', color: '#111' },
    unitId:       { marginTop: 4, fontSize: 13, color: '#657786' },
    wsStatus:     { marginTop: 4, fontSize: 11, fontWeight: '700' },
    wsOnline:     { color: '#16a34a' },
    wsOffline:    { color: '#f59e0b' },

    statusBlock:  { alignItems: 'flex-end' },
    statusText:   { fontSize: 12, fontWeight: '800' },
    online:       { color: '#16a34a' },
    offline:      { color: '#888' },

    controls:     { marginTop: 14, marginHorizontal: 12 },
    primaryButton: {
        backgroundColor: '#007AFF',
        paddingVertical: 12,
        borderRadius:    12,
        alignItems:      'center',
        marginBottom:    10,
    },
    primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    ghostButton: {
        backgroundColor: '#fff',
        borderWidth:     1,
        borderColor:     '#e6e9ee',
        paddingVertical: 12,
        borderRadius:    12,
        alignItems:      'center',
        marginBottom:    10,
    },
    ghostButtonText: { color: '#333', fontSize: 16, fontWeight: '700' },
    exitButton: {
        paddingVertical: 10,
        borderRadius:    12,
        alignItems:      'center',
        backgroundColor: '#fff',
        borderWidth:     1,
        borderColor:     '#fdecea',
    },
    exitButtonText: { color: '#c53030', fontWeight: '800' },
});