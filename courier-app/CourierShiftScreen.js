
import React, { useEffect, useState, useMemo, useRef } from 'react';
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
    AppState,
    Animated,
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
import PressableScale from './components/anim/PressableScale';
import { useTheme } from './theme';
import { useT } from './i18n';
import { initOrderSound, setOrderSoundEnabled } from './notificationSound';
import { registerPushToken, unregisterPushToken, addOrderTapListener } from './pushNotifications';

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
    const { colors: COLORS, themeName, setTheme } = useTheme();
    const { t, lang, setLang } = useT();
    const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

    const [unit, setUnit] = useState(null);
    const [status, setStatus] = useState('offline');
    const [loading, setLoading] = useState(true);

    // ── Settings state ──────────────────────────────────────────────────────
    const [settingsVisible, setSettingsVisible] = useState(false);
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

    // ── остановка фоновой геолокации ──────────────────
    const stopTracking = async () => {
        try { await AsyncStorage.removeItem('onShift'); } catch { }
        try {
            const started = await Location.hasStartedLocationUpdatesAsync(TASK_NAME);
            if (started) await Location.stopLocationUpdatesAsync(TASK_NAME);
        } catch { }
    };

    // ── Сверка состояния при запуске и возврате в приложение ─────────────────
    // Если смена не активна, но подписка ОС всё ещё «висит» (воскрешена ОС),
    // принудительно её отключаем. Так геолокация не может идти без активной смены.
    useEffect(() => {
        const reconcile = async () => {
            try {
                const onShift = await AsyncStorage.getItem('onShift');
                if (onShift === '1') {
                    setStatus('online');
                    return;
                }
                setStatus('offline');
                let started = false;
                try { started = await Location.hasStartedLocationUpdatesAsync(TASK_NAME); } catch { }
                if (started) {
                    try { await Location.stopLocationUpdatesAsync(TASK_NAME); } catch { }
                }
            } catch { }
        };

        reconcile();
        const sub = AppState.addEventListener('change', (s) => {
            if (s === 'active') reconcile();
        });
        return () => sub.remove();
    }, []);

    // ── Загрузка сохранённой настройки звука оповещений ──────────────────────
    useEffect(() => {
        (async () => {
            try {
                const v = await initOrderSound();
                setNotificationSoundEnabled(v);
            } catch { }
        })();
    }, []);

    // ── Push-уведомления: регистрация токена + переход по тапу ───────────────
    useEffect(() => {
        registerPushToken();
        const unsubscribe = addOrderTapListener(() => {
            // Тап по уведомлению о новом заказе → открыть список «Все»
            setSelectedOrder(null);
            setSelectedOutlet(null);
            setActiveTab(TAB_TYPES.ALL);
        });
        return unsubscribe;
    }, []);

    // ── Анимации статуса ─────────────────────────────────────────────────────
    // Пульс индикатора подключения (пока идёт connecting).
    const wsPulse = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        if (connected) {
            wsPulse.stopAnimation();
            Animated.timing(wsPulse, { toValue: 1, duration: 200, useNativeDriver: true }).start();
            return;
        }
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(wsPulse, { toValue: 0.4, duration: 650, useNativeDriver: true }),
                Animated.timing(wsPulse, { toValue: 1, duration: 650, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [connected]);

    // Мягкая смена бейджа ON SHIFT / OFFLINE.
    const statusFade = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        statusFade.setValue(0.4);
        Animated.timing(statusFade, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    }, [status]);

    // ── Выход ───────────────────────────────────────────────────────────────
    const handleExit = async () => {
        try {
            await stopTracking();
            await unregisterPushToken(); // снять токен на сервере, пока есть авторизация

            await AsyncStorage.removeItem(TOKEN_KEY);
            await AsyncStorage.removeItem(UNIT_KEY);
            await AsyncStorage.removeItem('courierId');
            await AsyncStorage.removeItem('myOrders');
            await AsyncStorage.removeItem('onShift');

            onLogout?.();
        } catch {
            Alert.alert(t('common.error'), t('shift.errLogoutFail'));
        }
    };

    const ensurePermissions = async () => {
        let fg = await Location.getForegroundPermissionsAsync();
        if (fg.status !== 'granted') {
            fg = await Location.requestForegroundPermissionsAsync();
            if (fg.status !== 'granted') throw new Error(t('shift.permFg'));
        }
        let bg = await Location.getBackgroundPermissionsAsync();
        if (bg.status !== 'granted') {
            bg = await Location.requestBackgroundPermissionsAsync();
            if (bg.status !== 'granted') throw new Error(t('shift.permBg'));
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
                        notificationTitle: t('shift.fgTitle'),
                        notificationBody: t('shift.fgBody'),
                        notificationColor: '#000000',
                    },
                });
            }
            setStatus('online');
        } catch (e) {
            Alert.alert(t('common.error'), e.message || t('shift.errStartFail'));
        }
    };

    const stopShift = async () => {
        try {
            // 1) Сразу глушим смену и фоновую подписку (fail-closed).
            //    Делаем это ДО прощального пинга, чтобы геолокация точно прекратилась,
            //    даже если что-то ниже упадёт.
            await stopTracking();
            setStatus('offline');

            // 2) Прощальный пинг off_shift — чтобы клиент убрал курьера с карты.
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
        } catch {
            Alert.alert(t('common.error'), t('shift.errStopFail'));
        }
    };

    if (loading) {
        return (
            // <SafeAreaView style={styles.safeContainer} edges={['top', 'left', 'right', 'bottom']}>
            <SafeAreaView style={styles.safeContainer} edges={['top', 'left', 'right']}>
                <StatusBar barStyle={COLORS.statusBar} backgroundColor={COLORS.bg} />
                <View style={styles.bgCircleTop} pointerEvents="none" />
                <View style={styles.bgCircleBottom} pointerEvents="none" />

                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.loadingText}>{t('shift.loading')}</Text>
                </View>
            </SafeAreaView>
        );
    }

    const nickname = unit?.unitNickname ?? t('shift.courier');
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
                                <Text style={styles.unitId}>{t('shift.idLabel')}: {idText}</Text>

                                <Animated.View
                                    style={[
                                        styles.wsBadge,
                                        connected ? styles.wsBadgeOnline : styles.wsBadgeOffline,
                                        { opacity: wsPulse },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.wsBadgeText,
                                            connected ? styles.wsOnline : styles.wsOffline,
                                        ]}
                                    >
                                        {connected ? t('shift.wsOnline') : t('shift.wsConnecting')}
                                    </Text>
                                </Animated.View>
                            </View>

                            <View style={styles.statusBlock}>
                                <Animated.View
                                    style={[
                                        styles.shiftBadge,
                                        status === 'online'
                                            ? styles.shiftBadgeOnline
                                            : styles.shiftBadgeOffline,
                                        { opacity: statusFade },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.statusText,
                                            status === 'online' ? styles.online : styles.offline,
                                        ]}
                                    >
                                        {status === 'online' ? t('shift.onShift') : t('shift.offline')}
                                    </Text>
                                </Animated.View>

                                <PressableScale
                                    style={styles.settingsButton}
                                    onPress={() => setSettingsVisible(true)}
                                    scaleTo={0.9}
                                >
                                    <Text style={styles.settingsButtonText}><Settings color={COLORS.accent} /></Text>
                                </PressableScale>
                            </View>
                        </View>

                        <View style={styles.sectionCard}>
                            <Text style={styles.sectionTitle}>{t('shift.manageTitle')}</Text>
                            <Text style={styles.sectionSubtitle}>
                                {t('shift.manageSubtitle')}
                            </Text>

                            <View style={styles.controls}>
                                <PressableScale style={styles.primaryButton} onPress={startShift}>
                                    <Text style={styles.primaryButtonText}>{t('shift.start')}</Text>
                                </PressableScale>

                                <PressableScale style={styles.ghostButton} onPress={stopShift}>
                                    <Text style={styles.ghostButtonText}>{t('shift.stop')}</Text>
                                </PressableScale>

                                <PressableScale style={styles.exitButton} onPress={handleExit}>
                                    <Text style={styles.exitButtonText}>{t('shift.logout')}</Text>
                                </PressableScale>
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
                                            Alert.alert(t('shift.takeSuccessTitle'), t('shift.takeSuccessBody'));
                                        } catch (e) {
                                            Alert.alert(t('common.error'), e.message);
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
                                t('shift.removeTitle'),
                                t('shift.removeBody'),
                                [
                                    { text: t('common.cancel'), style: 'cancel' },
                                    {
                                        text: t('common.delete'),
                                        style: 'destructive',
                                        onPress: async () => {
                                            try {
                                                await releaseOrder(orderId);
                                            } catch (e) {
                                                Alert.alert(t('common.error'), e.message);
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
            <StatusBar barStyle={COLORS.statusBar} backgroundColor={COLORS.bg} />
            <View style={styles.bgCircleTop} pointerEvents="none" />
            <View style={styles.bgCircleBottom} pointerEvents="none" />

            <View style={styles.mainContent}>{renderTabContent()}</View>

            <View style={styles.tabBarWrapper}>
                <TabNavigationBar activeTab={activeTab} onTabChange={setActiveTab} />
            </View>

            <SettingsModal
                visible={settingsVisible}
                onClose={() => setSettingsVisible(false)}
                currentLanguage={lang}
                currentTheme={themeName}
                notificationSoundEnabled={notificationSoundEnabled}
                onLanguageChange={(l) => setLang(l)}
                onThemeChange={(thm) => setTheme(thm)}
                onNotificationSoundChange={(enabled) => {
                    setNotificationSoundEnabled(enabled);
                    setOrderSoundEnabled(enabled);
                }}
            />
        </SafeAreaView>
    );
}

const makeStyles = (COLORS) => StyleSheet.create({
    safeContainer: {
        flex: 1,
        backgroundColor: COLORS.bg,
    },

    mainContent: {
        flex: 1,
        backgroundColor: COLORS.bg,
        paddingBottom: 12,
    },

    container: {
        flex: 1,
        backgroundColor: COLORS.bg,
        paddingHorizontal: 16,
        paddingTop: 12,
    },

    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.bg,
    },

    loadingText: {
        marginTop: 14,
        color: COLORS.muted,
        fontSize: 15,
    },

    bgCircleTop: {
        position: 'absolute',
        top: -80,
        right: -60,
        width: 220,
        height: 220,
        borderRadius: 110,
        backgroundColor: COLORS.circleTop,
        zIndex: 0,
    },

    bgCircleBottom: {
        position: 'absolute',
        bottom: -100,
        left: -80,
        width: 260,
        height: 260,
        borderRadius: 130,
        backgroundColor: COLORS.circleBottom,
        zIndex: 0,
    },

    headerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        marginTop: 4,
        padding: 16,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: COLORS.line,
        shadowColor: COLORS.shadow,
        shadowOpacity: 0.25,
        shadowOffset: { width: 0, height: 10 },
        shadowRadius: 20,
        elevation: 10,
    },

    avatarCircle: {
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: COLORS.accent,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: COLORS.accent,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
        elevation: 6,
    },

    avatarText: {
        color: COLORS.onPrimary,
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
        color: COLORS.text,
        letterSpacing: 0.2,
    },

    unitId: {
        marginTop: 4,
        fontSize: 13,
        color: COLORS.muted,
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
        color: COLORS.success,
    },

    wsOffline: {
        color: COLORS.warning,
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
        backgroundColor: COLORS.softBlue,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.softBlueBorder,
    },

    settingsButtonText: {
        fontSize: 16,
        color: COLORS.accent,
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
        color: COLORS.success,
    },

    offline: {
        color: COLORS.muted,
    },

    sectionCard: {
        marginTop: 16,
        backgroundColor: COLORS.surface,
        borderRadius: 24,
        padding: 18,
        borderWidth: 1,
        borderColor: COLORS.line,
        shadowColor: COLORS.shadow,
        shadowOpacity: 0.25,
        shadowOffset: { width: 0, height: 10 },
        shadowRadius: 20,
        elevation: 10,
    },

    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.text,
        marginBottom: 6,
    },

    sectionSubtitle: {
        fontSize: 14,
        lineHeight: 21,
        color: COLORS.muted,
        marginBottom: 18,
    },

    controls: {
        marginTop: 2,
    },

    primaryButton: {
        height: 56,
        backgroundColor: COLORS.accent,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
        shadowColor: COLORS.accent,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 14,
        elevation: 6,
    },

    primaryButtonText: {
        color: COLORS.onPrimary,
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.3,
    },

    ghostButton: {
        height: 56,
        backgroundColor: COLORS.ghost,
        borderWidth: 1,
        borderColor: COLORS.line,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },

    ghostButtonText: {
        color: COLORS.text,
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.3,
    },

    exitButton: {
        height: 54,
        backgroundColor: COLORS.softRed,
        borderWidth: 1,
        borderColor: COLORS.softRedBorder,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },

    exitButtonText: {
        color: COLORS.danger,
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: 0.3,
    },

    tabBarWrapper: {
        backgroundColor: COLORS.bg,
        // paddingTop: 2,
    },
});