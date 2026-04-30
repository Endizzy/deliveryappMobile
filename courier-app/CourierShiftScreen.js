// CourierShiftScreen.js
import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Platform,
    Alert,
    ActivityIndicator,
    Linking,
    StatusBar,
} from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TASK_NAME } from './locationTask';
import { API_LOCATION } from './constants';

import { SafeAreaView } from 'react-native-safe-area-context';

import AllOrdersScreen from './AllOrdersScreen';
import OrdersListScreenModern from './OrdersListScreenModern';
import OrderDetailsScreenModern from './OrderDetailsScreenModern';
import MyOrdersScreen from './MyOrdersScreen';
import TabNavigationBar, { TABS as TAB_TYPES } from './TabNavigationBar';
import { useOrdersWebSocket } from './useOrdersWebSocket';
import SettingsModal from './components/SettingsModal';
import { Settings } from 'lucide-react-native';

const UNIT_KEY = 'unit';
const TOKEN_KEY = 'authToken';

const FOREGROUND_SERVICE = {
    notificationTitle: 'Смена активна',
    notificationBody: 'Идёт передача геолокации для заказов.',
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
    const [unit, setUnit] = useState(null);
    const [status, setStatus] = useState('offline');
    const [loading, setLoading] = useState(true);

    // ── Settings state ──────────────────────────────────────────────────────
    const [settingsVisible, setSettingsVisible] = useState(false);
    const [language, setLanguage] = useState('ru');
    const [theme, setTheme] = useState('dark');
    const [notificationSoundEnabled, setNotificationSoundEnabled] = useState(true);

    // ── Tab / navigation state ──────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState(TAB_TYPES.MENU);
    const [selectedOutlet, setSelectedOutlet] = useState(null);
    const [selectedOrder, setSelectedOrder] = useState(null);

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
                const rawUnit = await AsyncStorage.getItem(UNIT_KEY);
                if (rawUnit) {
                    try {
                        const parsed = JSON.parse(rawUnit);
                        if (parsed && (parsed.unitId || parsed.unitId === 0)) {
                            const normalized = {
                                unitId: Number(parsed.unitId),
                                unitNickname: parsed.unitNickname ?? null,
                            };
                            setUnit(normalized);
                            await AsyncStorage.setItem('courierId', String(normalized.unitId));
                            setLoading(false);
                            return;
                        }
                    } catch { }
                }

                const token = await AsyncStorage.getItem(TOKEN_KEY);
                if (token) {
                    const payload = decodeJwtPayload(token);
                    if (payload) {
                        const unitId = payload.unitId ?? payload.userId ?? payload.unit_id ?? null;
                        const unitNickname = payload.unitNickname ?? payload.unit_nickname ?? null;
                        if (unitId) {
                            const normalized = {
                                unitId: Number(unitId),
                                unitNickname: unitNickname ?? null,
                            };
                            await AsyncStorage.setItem(UNIT_KEY, JSON.stringify(normalized));
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
            } catch { }

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
            Alert.alert('Ошибка', e.message || 'Не удалось запустить смену');
        }
    };

    const stopShift = async () => {
        try {
            try {
                const courierId = unit?.unitId;
                let pos = null;
                try {
                    pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
                } catch { }

                if (courierId && pos) {
                    fetch(API_LOCATION, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            courierId: Number(courierId),
                            lat: pos.coords.latitude,
                            lng: pos.coords.longitude,
                            speedKmh: typeof pos.coords.speed === 'number' ? pos.coords.speed * 3.6 : null,
                            status: 'off_shift',
                            timestamp: new Date(pos.timestamp || Date.now()).toISOString(),
                            courierNickname: unit?.unitNickname ?? null,
                        }),
                    }).catch(() => { });
                }
            } catch { }

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
            // <SafeAreaView style={styles.safeContainer} edges={['top', 'left', 'right', 'bottom']}>
            <SafeAreaView style={styles.safeContainer} edges={['top', 'left', 'right']}>
                <StatusBar barStyle="light-content" backgroundColor="#010B13" />
                <View style={styles.bgCircleTop} pointerEvents="none" />
                <View style={styles.bgCircleBottom} pointerEvents="none" />

                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#2F8CFF" />
                    <Text style={styles.loadingText}>Загрузка данных курьера...</Text>
                </View>
            </SafeAreaView>
        );
    }

    const nickname = unit?.unitNickname ?? 'Курьер';
    const idText = unit?.unitId ? String(unit.unitId) : '—';
    const initial = nickname.length > 0 ? nickname[0].toUpperCase() : '?';

    function renderTabContent() {
        switch (activeTab) {
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

                                <View
                                    style={[
                                        styles.wsBadge,
                                        connected ? styles.wsBadgeOnline : styles.wsBadgeOffline,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.wsBadgeText,
                                            connected ? styles.wsOnline : styles.wsOffline,
                                        ]}
                                    >
                                        {connected ? '● Online' : '○ Connecting...'}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.statusBlock}>
                                <View
                                    style={[
                                        styles.shiftBadge,
                                        status === 'online'
                                            ? styles.shiftBadgeOnline
                                            : styles.shiftBadgeOffline,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.statusText,
                                            status === 'online' ? styles.online : styles.offline,
                                        ]}
                                    >
                                        {status === 'online' ? 'ON SHIFT' : 'OFFLINE'}
                                    </Text>
                                </View>

                                <TouchableOpacity
                                    style={styles.settingsButton}
                                    onPress={() => setSettingsVisible(true)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.settingsButtonText}><Settings /></Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.sectionCard}>
                            <Text style={styles.sectionTitle}>Управление сменой</Text>
                            <Text style={styles.sectionSubtitle}>
                                Включайте и выключайте рабочую смену, управляйте статусом и выходом из аккаунта.
                            </Text>

                            <View style={styles.controls}>
                                <TouchableOpacity style={styles.primaryButton} onPress={startShift} activeOpacity={0.85}>
                                    <Text style={styles.primaryButtonText}>Начать смену</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.ghostButton} onPress={stopShift} activeOpacity={0.85}>
                                    <Text style={styles.ghostButtonText}>Остановить смену</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.exitButton} onPress={handleExit} activeOpacity={0.85}>
                                    <Text style={styles.exitButtonText}>Выйти из аккаунта</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                );

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
                                            setSelectedOrder(null);
                                            Alert.alert('Успешно', 'Заказ добавлен в ваши заказы');
                                        } catch (e) {
                                            Alert.alert('Ошибка', e.message);
                                        }
                                    })();
                                }}
                                onCall={(phone) => {
                                    Linking.openURL(`tel:${phone}`).catch(() => { });
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
                                        text: 'Удалить',
                                        style: 'destructive',
                                        onPress: async () => {
                                            try {
                                                await releaseOrder(orderId);
                                            } catch (e) {
                                                Alert.alert('Ошибка', e.message);
                                            }
                                        },
                                    },
                                ]
                            );
                        }}
                        onCompleteOrder={(orderId) => {
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
        // <SafeAreaView style={styles.safeContainer} edges={['top', 'left', 'right', 'bottom']}>
        <SafeAreaView style={styles.safeContainer} edges={['top', 'left', 'right']}>
            <StatusBar barStyle="light-content" backgroundColor="#010B13" />
            <View style={styles.bgCircleTop} pointerEvents="none" />
            <View style={styles.bgCircleBottom} pointerEvents="none" />

            <View style={styles.mainContent}>{renderTabContent()}</View>

            <View style={styles.tabBarWrapper}>
                <TabNavigationBar activeTab={activeTab} onTabChange={setActiveTab} />
            </View>

            <SettingsModal
                visible={settingsVisible}
                onClose={() => setSettingsVisible(false)}
                currentLanguage={language}
                currentTheme={theme}
                notificationSoundEnabled={notificationSoundEnabled}
                onLanguageChange={(lang) => setLanguage(lang)}
                onThemeChange={(thm) => setTheme(thm)}
                onNotificationSoundChange={(enabled) => setNotificationSoundEnabled(enabled)}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeContainer: {
        flex: 1,
        backgroundColor: '#010B13',
    },

    mainContent: {
        flex: 1,
        backgroundColor: '#010B13',
        paddingBottom: 12,
    },

    container: {
        flex: 1,
        backgroundColor: '#010B13',
        paddingHorizontal: 16,
        paddingTop: 12,
    },

    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#010B13',
    },

    loadingText: {
        marginTop: 14,
        color: '#A6B6C6',
        fontSize: 15,
    },

    bgCircleTop: {
        position: 'absolute',
        top: -80,
        right: -60,
        width: 220,
        height: 220,
        borderRadius: 110,
        backgroundColor: 'rgba(0, 122, 255, 0.12)',
        zIndex: 0,
    },

    bgCircleBottom: {
        position: 'absolute',
        bottom: -100,
        left: -80,
        width: 260,
        height: 260,
        borderRadius: 130,
        backgroundColor: 'rgba(0, 180, 255, 0.08)',
        zIndex: 0,
    },

    headerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        marginTop: 4,
        padding: 16,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowOffset: { width: 0, height: 10 },
        shadowRadius: 20,
        elevation: 10,
    },

    avatarCircle: {
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: '#007AFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#007AFF',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
        elevation: 6,
    },

    avatarText: {
        color: '#fff',
        fontSize: 22,
        fontWeight: '700',
    },

    infoBlock: {
        marginLeft: 12,
        flex: 1,
    },

    nickname: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: 0.2,
    },

    unitId: {
        marginTop: 4,
        fontSize: 13,
        color: '#8FA3B8',
    },

    wsBadge: {
        marginTop: 8,
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        borderWidth: 1,
    },

    wsBadgeOnline: {
        backgroundColor: 'rgba(34, 197, 94, 0.12)',
        borderColor: 'rgba(34, 197, 94, 0.25)',
    },

    wsBadgeOffline: {
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
        borderColor: 'rgba(245, 158, 11, 0.22)',
    },

    wsBadgeText: {
        fontSize: 11,
        fontWeight: '700',
    },

    wsOnline: {
        color: '#4ADE80',
    },

    wsOffline: {
        color: '#FBBF24',
    },

    statusBlock: {
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 8,
    },

    settingsButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0, 122, 255, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0, 122, 255, 0.20)',
    },

    settingsButtonText: {
        fontSize: 16,
        color: '#007AFF',
    },

    shiftBadge: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        borderWidth: 1,
    },

    shiftBadgeOnline: {
        backgroundColor: 'rgba(34, 197, 94, 0.12)',
        borderColor: 'rgba(34, 197, 94, 0.24)',
    },

    shiftBadgeOffline: {
        backgroundColor: 'rgba(148, 163, 184, 0.10)',
        borderColor: 'rgba(148, 163, 184, 0.16)',
    },

    statusText: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.4,
    },

    online: {
        color: '#4ADE80',
    },

    offline: {
        color: '#A3B1C2',
    },

    sectionCard: {
        marginTop: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderRadius: 24,
        padding: 18,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowOffset: { width: 0, height: 10 },
        shadowRadius: 20,
        elevation: 10,
    },

    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 6,
    },

    sectionSubtitle: {
        fontSize: 14,
        lineHeight: 21,
        color: '#8FA3B8',
        marginBottom: 18,
    },

    controls: {
        marginTop: 2,
    },

    primaryButton: {
        height: 56,
        backgroundColor: '#007AFF',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
        shadowColor: '#007AFF',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 14,
        elevation: 6,
    },

    primaryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.3,
    },

    ghostButton: {
        height: 56,
        backgroundColor: '#0B1722',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },

    ghostButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.3,
    },

    exitButton: {
        height: 54,
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.20)',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },

    exitButtonText: {
        color: '#FF7B7B',
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: 0.3,
    },

    tabBarWrapper: {
        backgroundColor: '#010B13',
        // paddingTop: 2,
    },
});