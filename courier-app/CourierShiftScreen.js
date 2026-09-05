
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
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
    BackHandler,
} from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TASK_NAME } from './locationTask';
import { API_LOCATION, ORIGIN } from './constants';

import { SafeAreaView } from 'react-native-safe-area-context';

import AllOrdersScreen from './AllOrdersScreen';
import OrdersListScreenModern from './OrdersListScreenModern';
import OrderDetailsScreenModern from './OrderDetailsScreenModern';
import MyOrdersScreen from './MyOrdersScreen';
import TabNavigationBar, { TABS as TAB_TYPES } from './TabNavigationBar';
import { useOrdersWebSocket } from './useOrdersWebSocket';
import SettingsModal from './components/SettingsModal';
import DailyReportModal from './components/DailyReportModal';
import { Settings, BarChart3 } from 'lucide-react-native';
import PressableScale from './components/anim/PressableScale';
import { useTheme } from './theme';
import { useT } from './i18n';
import { initOrderSound, setOrderSoundEnabled } from './notificationSound';
import { registerPushToken, unregisterPushToken, addOrderTapListener, addOrderReceivedListener, getInitialOrderTap } from './pushNotifications';
import OrderDialog from './components/OrderDialog';
import NewOrderSheet from './components/NewOrderSheet';
import AssignedOrderCall from './components/AssignedOrderCall';
import ConnectionBanner from './components/ConnectionBanner';
import MenuCarousel from './components/menu/MenuCarousel';
import MenuClassic from './components/menu/MenuClassic';
import { clearQueue } from './offlineQueue';

const UNIT_KEY = 'unit';
const TOKEN_KEY = 'authToken';
const SHIFT_STARTED_KEY = 'shiftStartedAt';

// Переключатель дизайна главного экрана:
//   true  — прежний вид (MenuClassic), сейчас активен;
//   false — карусель активных заказов (MenuCarousel).
// Оба компонента лежат в components/menu, переключение — только этой строкой.
const USE_CLASSIC_MENU = true;

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

// Истёк ли срок действия токена (по полю exp в JWT).
// Нет токена → считаем «истёк». Нет exp → не можем судить локально,
// полагаемся на 401 от сервера (возвращаем false).
function isTokenExpired(token) {
    if (!token) return true;
    const p = decodeJwtPayload(token);
    if (!p || !p.exp) return false;
    return Date.now() >= p.exp * 1000 - 5000; // 5с запас
}

// Список точек выдачи = все точки (админ-аккаунты) с сервера, всегда видимы.
// Счётчик заказов берём из самих заказов (0, если заказов нет).
// Плюс подстраховка: если в заказе есть точка, которой нет в серверном списке
// (переименовали/удалили админа) — всё равно показываем, чтобы заказ не потерялся.
function buildOutlets(orders, pickupPoints) {
    const counts = new Map(); // lowerKey -> count
    for (const o of orders) {
        const name = String(o.outlet || '').trim();
        if (!name) continue;
        const key = name.toLowerCase();
        counts.set(key, (counts.get(key) || 0) + 1);
    }

    const seen = new Set();
    const outlets = [];

    // 1) точки с сервера — видны всегда, даже с нулём
    for (const p of pickupPoints || []) {
        const name = String(p.nickname || '').trim();
        if (!name) continue;
        const key = name.toLowerCase();
        seen.add(key);
        outlets.push({ id: `pp-${p.id}`, name, serverName: name, count: counts.get(key) || 0 });
    }

    // 2) точки из заказов, которых нет в серверном списке
    for (const [key, count] of counts) {
        if (seen.has(key)) continue;
        const original = orders.find(
            (o) => String(o.outlet || '').trim().toLowerCase() === key
        );
        const name = original ? String(original.outlet).trim() : key;
        outlets.push({ id: `x-${key}`, name, serverName: name, count });
    }

    return outlets.sort((a, b) => a.name.localeCompare(b.name));
}

export default function CourierShiftScreen({ onLogout }) {
    const { colors: COLORS, themeName, setTheme } = useTheme();
    const { t, lang, setLang } = useT();
    const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

    const [unit, setUnit] = useState(null);
    const [status, setStatus] = useState('offline');
    // Начало смены для таймера на главном экране
    const [shiftStartedAt, setShiftStartedAt] = useState(null);
    const [loading, setLoading] = useState(true);

    // Зеркало статуса в ref — источник правды для текущей сессии.
    // reconcile опирается на него, а не на онлайн-флаг из хранилища.
    const statusRef = useRef('offline');
    useEffect(() => { statusRef.current = status; }, [status]);

    // ── Settings state ──────────────────────────────────────────────────────
    const [settingsVisible, setSettingsVisible] = useState(false);
    const [reportVisible, setReportVisible] = useState(false);
    const [notificationSoundEnabled, setNotificationSoundEnabled] = useState(true);

    // ── Tab / navigation state ──────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState(TAB_TYPES.MENU);
    const [selectedOutlet, setSelectedOutlet] = useState(null);
    const [selectedOrder, setSelectedOrder] = useState(null);
    // Отложенный переход по тапу на push и временная подсветка заказа
    const [pushIntent, setPushIntent] = useState(null);
    const [highlightOrderId, setHighlightOrderId] = useState(null);

    // Диалог-плашка вместо системного Alert
    const [dialog, setDialog] = useState(null);

    // Результат действия: подтверждать нечего, плашка гаснет сама
    const notify = useCallback((title, body, tone = 'ok') => {
        setDialog({ tone, title, body });
    }, []);

    // Подтверждение действия: показываем кнопки
    const confirm = useCallback((opts) => {
        setDialog({ tone: opts.destructive ? 'danger' : 'question', ...opts });
    }, []);

    // Точки выдачи (админ-аккаунты компании) — тянем с сервера, видны всегда
    const [pickupPoints, setPickupPoints] = useState([]);

    // ── In-app баннер «заказ назначен мне» ───────────────────────────────────
    const [assignedToast, setAssignedToast] = useState(null);

    // Ссылка на принудительный выход (заполняется ниже, после определения forceLogout).
    // Нужна, чтобы хук/эффекты могли вызвать выход, не завися от порядка объявления.
    const sessionExpiredRef = useRef(null);

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
        completeOrder,
        enrouteOrder,
        pendingCount,
        offline,
        syncing,
        retryNow,
    } = useOrdersWebSocket({
        unit,
        // Назначенный лично заказ важнее свободного и всегда перекрывает его
        onAssignedOrder: (order) => setAssignedToast({ order, variant: 'assigned' }),
        // Свободный заказ: раньше был только звук, и курьер не понимал,
        // что именно приехало и где это искать. Не вытесняет полноэкранное
        // уведомление о назначении, если оно сейчас показано.
        onNewOrder: (order) =>
            setAssignedToast((prev) =>
                prev?.variant === 'assigned' ? prev : { order, variant: 'new' }
            ),
        onUnauthorized: () => sessionExpiredRef.current?.(),
        // Действие из очереди отклонено сервером окончательно (заказ забрал
        // другой курьер / отменён) — объясняем курьеру, что произошло
        onConflict: (op, reason) => {
            notify(t('connection.conflictTitle'), reason || t('common.error'), 'danger');
        },
    });

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
        try { await AsyncStorage.removeItem(SHIFT_STARTED_KEY); } catch { }
        try {
            const started = await Location.hasStartedLocationUpdatesAsync(TASK_NAME);
            if (started) await Location.stopLocationUpdatesAsync(TASK_NAME);
        } catch { }
    };

    // ── Сверка состояния при запуске и возврате в приложение ─────────────────
    // Геолокация включается ТОЛЬКО кнопкой «Начать смену» в текущей сессии.
    // Никакого авто-возобновления по флагу из хранилища: свежий запуск = смена
    // выключена. Если смена НЕ активна в этой сессии, но подписка ОС «висит»
    // (воскрешена ОС / зомби после прошлого входа) — принудительно её глушим.
    useEffect(() => {
        const reconcile = async () => {
            // Активная смена в ЭТОЙ сессии (нажали «Начать смену») — не трогаем.
            if (statusRef.current === 'online') return;
            try {
                // гарантируем, что смена выключена и фоновой подписки нет
                await AsyncStorage.removeItem('onShift');
                // и таймер не показывает время прошлой сессии
                await AsyncStorage.removeItem(SHIFT_STARTED_KEY);
                setShiftStartedAt(null);
                const started = await Location.hasStartedLocationUpdatesAsync(TASK_NAME);
                if (started) await Location.stopLocationUpdatesAsync(TASK_NAME);
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
    // Тап сохраняем как «намерение»: в момент нажатия списки могут быть ещё не
    // загружены (особенно при холодном старте), поэтому сам переход выполняет
    // эффект ниже — когда становится понятно, чей это заказ и с какой точки.
    useEffect(() => {
        registerPushToken();

        const unsubscribe = addOrderTapListener((data) => {
            setPushIntent({
                orderId:   data?.orderId ?? null,
                courierId: data?.courierId ?? null,
                outlet:    data?.outlet ?? null,
                ts:        Date.now(),
            });
            // подтягиваем свежие списки, чтобы решение было по актуальным данным
            fetchAvailable();
            fetchMy();
        });

        // Приложение открыли тапом по уведомлению из закрытого состояния
        getInitialOrderTap().then((data) => {
            if (!data) return;
            setPushIntent({
                orderId:   data.orderId ?? null,
                courierId: data.courierId ?? null,
                outlet:    data.outlet ?? null,
                ts:        Date.now(),
            });
        });

        return unsubscribe;
    }, [fetchAvailable, fetchMy]);

    // Выполнение отложенного перехода по push
    useEffect(() => {
        if (!pushIntent) return;

        const id = pushIntent.orderId;
        if (id == null) {
            // без идентификатора вести некуда — просто открываем «Все»
            setSelectedOrder(null);
            setSelectedOutlet(null);
            setActiveTab(TAB_TYPES.ALL);
            setPushIntent(null);
            return;
        }

        const mine = myOrders.find((o) => String(o.id) === String(id));
        const free = availableOrders.find((o) => String(o.id) === String(id));
        const found = mine || free;

        // Списки могли ещё не приехать — ждём их, но не дольше 8 секунд,
        // иначе тап останется без реакции при плохой связи.
        if (!found && Date.now() - pushIntent.ts < 8000) return;

        const myUnitId = unit?.unitId ?? null;
        const isMine =
            !!mine ||
            (pushIntent.courierId != null &&
                myUnitId != null &&
                String(pushIntent.courierId) === String(myUnitId));

        setSelectedOrder(null);

        if (isMine) {
            // заказ назначен курьеру → «Мои заказы»
            setSelectedOutlet(null);
            setActiveTab(TAB_TYPES.MY);
        } else {
            // свободный заказ → «Все»; если есть точка комплектации, открываем её
            setActiveTab(TAB_TYPES.ALL);
            const outletName = String(
                found?.outlet || found?.pickupName || pushIntent.outlet || ''
            ).trim();

            if (outletName) {
                const outlets = buildOutlets(availableOrders, pickupPoints);
                const match = outlets.find(
                    (o) => o.name.trim().toLowerCase() === outletName.toLowerCase()
                );
                setSelectedOutlet(
                    match ?? { id: `x-${outletName.toLowerCase()}`, name: outletName, serverName: outletName, count: 1 }
                );
            } else {
                // Точка не назначена: ведём в список ВСЕХ заказов (карточка «Все точки»),
                // а не на экран выбора точки — иначе курьер не видит сам заказ и не
                // понимает, куда идти дальше.
                setSelectedOutlet({ id: 'all', name: t('allOrders.allOutlets'), isAll: true });
            }
        }

        setHighlightOrderId(String(id));
        setPushIntent(null);
    }, [pushIntent, myOrders, availableOrders, pickupPoints, unit, t]);

    // Подсветка нового заказа гаснет сама
    useEffect(() => {
        if (!highlightOrderId) return;
        const tm = setTimeout(() => setHighlightOrderId(null), 6000);
        return () => clearTimeout(tm);
    }, [highlightOrderId]);


    // Пришёл push при открытом приложении — сразу перечитываем списки.
    // Это второй независимый от WebSocket путь доставки заказа в UI:
    // если сокет мёртв, заказ появится по push, а не через 15 c поллинга.
    useEffect(() => {
        const unsubscribe = addOrderReceivedListener(() => {
            fetchAvailable();
            fetchMy();
        });
        return unsubscribe;
    }, [fetchAvailable, fetchMy]);

    // ── Точки выдачи: список админ-аккаунтов компании ────────────────────────
    const fetchPickupPoints = useCallback(async () => {
        try {
            const token = await AsyncStorage.getItem(TOKEN_KEY);
            if (!token) return;
            const res = await fetch(`${ORIGIN}/api/order-support/pickup-points`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.status === 401) { sessionExpiredRef.current?.(); return; }
            const data = await res.json();
            if (data?.ok && Array.isArray(data.items)) setPickupPoints(data.items);
        } catch { }
    }, []);

    useEffect(() => { fetchPickupPoints(); }, [fetchPickupPoints]);

    // Обновляем список точек при открытии вкладки «Все»
    useEffect(() => {
        if (activeTab === TAB_TYPES.ALL) fetchPickupPoints();
    }, [activeTab, fetchPickupPoints]);

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

    // ── Принудительный выход при истёкшем/недействительном токене ────────────
    const loggingOutRef = useRef(false);
    const forceLogout = useCallback(async () => {
        if (loggingOutRef.current) return; // защита от повторных срабатываний
        loggingOutRef.current = true;
        try {
            // тоже с прощальным off_shift — на сервере есть и TTL-очистка
            // на случай, если токен уже истёк и пинг не пройдёт
            try { await stopShift(); } catch { await stopTracking(); }
            try { await unregisterPushToken(); } catch { }
            // Очередь принадлежит конкретному курьеру: иначе после смены
            // аккаунта его действия ушли бы от имени другого человека.
            try { await clearQueue(); } catch { }
            await AsyncStorage.multiRemove([
                TOKEN_KEY, UNIT_KEY, 'courierId', 'myOrders', 'onShift',
            ]);
        } catch { }
        onLogout?.(); // App.js → isAuth=false → экран авторизации
    }, [onLogout]);

    // держим актуальную ссылку, чтобы хук/эффекты могли вызвать выход
    sessionExpiredRef.current = forceLogout;

    // ── Авто-проверка токена: при старте, возврате в приложение и раз в минуту ─
    // Если токен отсутствует или истёк — сразу выкидываем на экран авторизации,
    // даже без сетевого запроса.
    useEffect(() => {
        let interval;
        const check = async () => {
            try {
                const token = await AsyncStorage.getItem(TOKEN_KEY);
                if (!token || isTokenExpired(token)) {
                    await forceLogout();
                }
            } catch { }
        };
        check();
        const sub = AppState.addEventListener('change', (s) => {
            if (s === 'active') check();
        });
        interval = setInterval(check, 60000);
        return () => {
            try { sub.remove(); } catch { }
            clearInterval(interval);
        };
    }, [forceLogout]);

    // ── Аппаратная кнопка «Назад» (Android) ─────────────────────────────────
    // Без этого обработчика системная кнопка сразу сворачивала приложение,
    // даже если открыты детали заказа или список точек. Разбираем экраны
    // в порядке вложенности; на главной отдаём управление системе.
    useEffect(() => {
        const onBack = () => {
            if (settingsVisible) { setSettingsVisible(false); return true; }
            if (reportVisible)   { setReportVisible(false);   return true; }
            if (selectedOrder)   { setSelectedOrder(null);    return true; }
            if (selectedOutlet)  { setSelectedOutlet(null);   return true; }
            if (activeTab !== TAB_TYPES.MENU) { setActiveTab(TAB_TYPES.MENU); return true; }
            return false; // на главной — стандартное поведение (свернуть приложение)
        };
        const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
        return () => { try { sub.remove(); } catch { } };
    }, [settingsVisible, reportVisible, selectedOrder, selectedOutlet, activeTab]);

    // ── Выход ───────────────────────────────────────────────────────────────
    const doExit = async () => {
        try {
            // stopShift = стоп трекинга + прощальный пинг off_shift,
            // иначе метка курьера остаётся висеть на карте у админов
            await stopShift();
            await unregisterPushToken(); // снять токен на сервере, пока есть авторизация

            // Очередь привязана к курьеру — не переносим её в чужую сессию
            try { await clearQueue(); } catch { }

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

    const handleExit = async () => {
        // Неотправленные действия при выходе будут потеряны — предупреждаем,
        // но сначала пробуем дослать их: обычно связь к этому моменту уже есть.
        if (pendingCount > 0) {
            try { await retryNow(); } catch { }
        }
        if (pendingCount > 0) {
            Alert.alert(
                t('connection.conflictTitle'),
                t('connection.pendingOnLogout', { count: pendingCount }),
                [
                    { text: t('common.cancel'), style: 'cancel' },
                    { text: t('shift.logout'), style: 'destructive', onPress: doExit },
                ]
            );
            return;
        }
        await doExit();
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
            // Момент начала смены — для таймера на главном экране. Хранится
            // отдельно от флага, чтобы переживать перезапуск приложения.
            const startedAt = new Date().toISOString();
            await AsyncStorage.setItem(SHIFT_STARTED_KEY, startedAt);
            setShiftStartedAt(startedAt);

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
            // 0) Берём ПОСЛЕДНЮЮ ИЗВЕСТНУЮ позицию из кэша ДО остановки.
            //    getLastKnownPositionAsync не включает GPS, поэтому индикатор
            //    геолокации не «мигает» обратно после остановки смены.
            let pos = null;
            try { pos = await Location.getLastKnownPositionAsync(); } catch { }

            // 1) Сразу глушим смену и фоновую подписку (fail-closed).
            //    Делаем это ДО прощального пинга, чтобы геолокация точно прекратилась,
            //    даже если что-то ниже упадёт.
            await stopTracking();
            setStatus('offline');
            try { await AsyncStorage.removeItem(SHIFT_STARTED_KEY); } catch { }
            setShiftStartedAt(null);

            // 2) Прощальный пинг off_shift — чтобы клиент убрал курьера с карты.
            //    Шлём ВСЕГДА (координаты необязательны): сервер по off_shift
            //    убирает курьера сразу, даже если позиции нет.
            try {
                const courierId = unit?.unitId;
                const token = await AsyncStorage.getItem(TOKEN_KEY);
                if (courierId && token) {
                    fetch(API_LOCATION, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({
                            courierId: Number(courierId),
                            lat: pos ? pos.coords.latitude : null,
                            lng: pos ? pos.coords.longitude : null,
                            speedKmh: pos && typeof pos.coords.speed === 'number' ? pos.coords.speed * 3.6 : null,
                            status: 'off_shift',
                            timestamp: new Date((pos && pos.timestamp) || Date.now()).toISOString(),
                            courierNickname: unit?.unitNickname ?? null,
                        }),
                    }).catch(() => { });
                }
            } catch { }
        } catch {
            Alert.alert(t('common.error'), t('shift.errStopFail'));
        }
    };

    // ВАЖНО: этот useMemo обязан стоять ДО раннего return по `loading`.
    // Хуки нельзя вызывать условно: пока шла загрузка, хук не выполнялся,
    // а после неё выполнялся — React падал с «Rendered more hooks than
    // during the previous render».
    //
    // Счётчики на вкладках таб-бара. «Мои» считаем только по активным заказам:
    // выполненные за смену копятся, и общее число ничего бы не говорило.
    // Тот же критерий, что делит секции в MyOrdersScreen.
    const tabCounts = useMemo(() => ({
        [TAB_TYPES.ALL]: availableOrders.length,
        [TAB_TYPES.MY]: myOrders.filter(
            (o) => !(o.completed || String(o.status || '').toLowerCase() === 'completed')
        ).length,
    }), [availableOrders, myOrders]);

    // selectedOrder — снимок на момент открытия: если статус изменится по WS
    // (заказ забрал другой курьер, диспетчер отменил), детали покажут устаревшие
    // данные и не те кнопки. Берём актуальную версию заказа из списков по id.
    const selectedOrderLive = useMemo(() => {
        if (!selectedOrder) return null;
        const id = selectedOrder.id ?? selectedOrder.order_id;
        return (
            myOrders.find((o) => String(o.id) === String(id)) ||
            availableOrders.find((o) => String(o.id) === String(id)) ||
            selectedOrder // заказ уже вне списков (завершён) — показываем снимок
        );
    }, [selectedOrder, myOrders, availableOrders]);

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
        // Детали заказа — слой поверх вкладок, а не часть вкладки «Все».
        // Раньше они жили внутри case ALL, поэтому открытие заказа из «Мои»
        // принудительно переключало вкладку, и «Назад» возвращал курьера
        // в «Все» вместо «Мои заказы». Теперь вкладка не меняется, и возврат
        // всегда ведёт туда, откуда заказ открыли.
        if (selectedOrderLive) {
            return (
                <OrderDetailsScreenModern
                    order={selectedOrderLive}
                    // имя точки берём из самого заказа: при открытии из «Мои»
                    // выбранной точки нет, и раньше показывался прочерк
                    outletName={
                        selectedOrderLive.outlet ||
                        selectedOrderLive.pickupName ||
                        selectedOutlet?.name ||
                        '—'
                    }
                    myUnitId={unit?.unitId}
                    onBack={() => setSelectedOrder(null)}
                    onTake={(order) => {
                        // Заказ переезжает в «Мои» мгновенно (оптимистично), поэтому и
                        // подтверждение показываем сразу. Раньше Alert ждал ответа
                        // сервера и появлялся с задержкой — уже после того, как заказ
                        // исчез из списка, и выглядело это как сбой.
                        setSelectedOrder(null);
                        notify(t('shift.takeSuccessTitle'), t('shift.takeSuccessBody'));

                        // Без анимации ухода: экран деталей закрывается, и списка
                        // под ним ещё не видно — уезжать было бы нечему.
                        assignOrder(order.id).catch((e) => {
                            // сюда попадаем только при конфликте: заказ уже забрал другой
                            notify(t('connection.conflictTitle'), e?.message || t('common.error'), 'danger');
                        });
                    }}
                    onEnroute={(order) => {
                        // оптимистично: статус меняем сразу, отправку берёт на себя очередь
                        setMyOrders((prev) =>
                            prev.map((o) =>
                                o.id === order.id ? { ...o, status: 'enroute' } : o
                            )
                        );
                        setSelectedOrder(null);
                        enrouteOrder(order.id).catch((e) => {
                            // сюда попадаем только при конфликте — заказ уже закрыт/чужой
                            notify(t('connection.conflictTitle'), e?.message || t('common.error'), 'danger');
                        });
                    }}
                    onCall={(phone) => {
                        Linking.openURL(`tel:${phone}`).catch(() => { });
                    }}
                />
            );
        }

        switch (activeTab) {
            case TAB_TYPES.MENU:
                // Прежний вид сохранён в MenuClassic — вернуть его можно,
                // поставив USE_CLASSIC_MENU = true в начале файла.
                if (USE_CLASSIC_MENU) {
                    return (
                        <MenuClassic
                            styles={styles}
                            COLORS={COLORS}
                            t={t}
                            initial={initial}
                            nickname={nickname}
                            idText={idText}
                            connected={connected}
                            wsPulse={wsPulse}
                            status={status}
                            statusFade={statusFade}
                            onOpenReport={() => setReportVisible(true)}
                            onOpenSettings={() => setSettingsVisible(true)}
                            onStartShift={startShift}
                            onStopShift={stopShift}
                            onExit={handleExit}
                        />
                    );
                }

                return (
                    <MenuCarousel
                        COLORS={COLORS}
                        t={t}
                        initial={initial}
                        nickname={nickname}
                        idText={idText}
                        connected={connected}
                        wsPulse={wsPulse}
                        status={status}
                        statusFade={statusFade}
                        shiftStartedAt={shiftStartedAt}
                        // в карусели только активные заказы: выполненные листать незачем
                        orders={myOrders.filter(
                            (o) => !(o.completed || String(o.status || '').toLowerCase() === 'completed')
                        )}
                        onOpenOrder={(order) => setSelectedOrder(order)}
                        onCall={(phone) => {
                            if (phone) Linking.openURL(`tel:${phone}`).catch(() => { });
                        }}
                        onEnroute={(orderId) => {
                            setMyOrders((prev) =>
                                prev.map((o) => (o.id === orderId ? { ...o, status: 'enroute' } : o))
                            );
                            enrouteOrder(orderId).catch((e) => {
                                notify(t('connection.conflictTitle'), e?.message || t('common.error'), 'danger');
                            });
                        }}
                        onComplete={(orderId) => {
                            // то же подтверждение, что и в списке «Мои заказы»
                            confirm({
                                title: t('dialog.completeTitle'),
                                body: t('dialog.completeBody'),
                                confirmText: t('dialog.completeConfirm'),
                                onConfirm: () => {
                                    setMyOrders((prev) =>
                                        prev.map((o) =>
                                            o.id === orderId
                                                ? { ...o, completed: true, completedAt: new Date().toISOString() }
                                                : o
                                        )
                                    );
                                    completeOrder(orderId).catch((e) => {
                                        notify(t('connection.conflictTitle'), e?.message || t('common.error'), 'danger');
                                    });
                                },
                            });
                        }}
                        onOpenReport={() => setReportVisible(true)}
                        onOpenSettings={() => setSettingsVisible(true)}
                        onStartShift={startShift}
                        onStopShift={stopShift}
                        onExit={handleExit}
                    />
                );


            case TAB_TYPES.ALL:
                return (
                    <View style={{ flex: 1 }}>
                        {!selectedOutlet ? (
                            <AllOrdersScreen
                                useSafeArea={false}
                                outlets={buildOutlets(availableOrders, pickupPoints)}
                                totalCount={availableOrders.length}
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
                                highlightOrderId={highlightOrderId}
                                onBack={() => setSelectedOutlet(null)}
                                onRefresh={fetchAvailable}
                                onOpenOrder={(order) => setSelectedOrder(order)}
                                onActionPress={(order) => {
                                    // «+» = взять заказ на себя (как кнопка «Взять» в деталях).
                                    // Подтверждение показываем сразу: заказ уже перенесён в «Мои»
                                    const id = order.id || order.order_id;
                                    notify(t('shift.takeSuccessTitle'), t('shift.takeSuccessBody'));
                                    assignOrder(id).catch((e) => {
                                        notify(t('connection.conflictTitle'), e?.message || t('common.error'), 'danger');
                                    });
                                }}
                            />
                        )}
                    </View>
                );

            case TAB_TYPES.MY:
                return (
                    <MyOrdersScreen
                        myOrders={myOrders}
                        useSafeArea={false}
                        highlightOrderId={highlightOrderId}
                        onOpenOrder={(order) => {
                            // вкладку не меняем: «Назад» из деталей вернёт в «Мои заказы»
                            setSelectedOrder(order);
                        }}
                        onRemoveOrder={(orderId) => {
                            // Отказ от заказа необратим — спрашиваем подтверждение
                            confirm({
                                destructive: true,
                                title: t('shift.removeTitle'),
                                body: t('shift.removeBody'),
                                confirmText: t('dialog.removeConfirm'),
                                onConfirm: () => {
                                    releaseOrder(orderId).catch((e) => {
                                        // офлайн сюда не приводит — только реальный конфликт
                                        notify(t('connection.conflictTitle'), e?.message || t('common.error'), 'danger');
                                    });
                                },
                            });
                        }}
                        onEnrouteOrder={(orderId) => {
                            // оптимистично ставим статус «в пути» → кнопка сменится на «Готово»
                            setMyOrders((prev) =>
                                prev.map((o) =>
                                    o.id === orderId ? { ...o, status: 'enroute' } : o
                                )
                            );
                            // ставим в очередь: уйдёт сразу или при появлении связи
                            enrouteOrder(orderId).catch((e) => {
                                notify(t('connection.conflictTitle'), e?.message || t('common.error'), 'danger');
                            });
                        }}
                        onCompleteOrder={(orderId) => {
                            // Закрытие заказа отменить нельзя, а кнопка стоит рядом с «В путь»
                            // и нажимается на ходу — поэтому спрашиваем подтверждение.
                            confirm({
                                title: t('dialog.completeTitle'),
                                body: t('dialog.completeBody'),
                                confirmText: t('dialog.completeConfirm'),
                                onConfirm: () => {
                                    // оптимистично помечаем выполненным (уходит в секцию «выполнено»)
                                    setMyOrders((prev) =>
                                        prev.map((o) =>
                                            o.id === orderId
                                                ? { ...o, completed: true, completedAt: new Date().toISOString() }
                                                : o
                                        )
                                    );
                                    // ставим в очередь: уйдёт сразу или при появлении связи
                                    completeOrder(orderId).catch((e) => {
                                        notify(t('connection.conflictTitle'), e?.message || t('common.error'), 'danger');
                                    });
                                },
                            });
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

            {/* Состояние связи и неотправленных действий */}
            <ConnectionBanner
                pendingCount={pendingCount}
                offline={offline}
                syncing={syncing}
                onRetry={retryNow}
            />

            <View style={styles.mainContent}>{renderTabContent()}</View>

            <View style={styles.tabBarWrapper}>
                <TabNavigationBar
                    activeTab={activeTab}
                    counts={tabCounts}
                    onTabChange={(tab) => {
                        // Детали — слой поверх вкладок, поэтому при переходе по
                        // таб-бару их нужно закрыть, иначе нажатие «не сработает»
                        setSelectedOrder(null);
                        setActiveTab(tab);
                    }}
                />
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

            <DailyReportModal
                visible={reportVisible}
                onClose={() => setReportVisible(false)}
            />

            {/* Компактная плашка вместо системного Alert */}
            <OrderDialog dialog={dialog} onDismiss={() => setDialog(null)} />

            {/* Свободный заказ — нижний лист: заметно, но работать не мешает */}
            {assignedToast?.variant === 'new' && (
                <NewOrderSheet
                    order={assignedToast.order}
                    onDismiss={() => setAssignedToast(null)}
                    onPress={(order) => {
                        // тот же маршрут, что и по тапу на системный push
                        setPushIntent({
                            orderId: order?.id ?? null,
                            courierId: null,
                            outlet: order?.outlet ?? order?.pickupName ?? null,
                            ts: Date.now(),
                        });
                        setAssignedToast(null);
                    }}
                />
            )}

            {/* Назначенный лично — полноэкранный вызов, сам не гаснет */}
            {assignedToast?.variant === 'assigned' && (
                <AssignedOrderCall
                    order={assignedToast.order}
                    onDismiss={() => setAssignedToast(null)}
                    onPress={(order) => {
                        setPushIntent({
                            orderId: order?.id ?? null,
                            courierId: unit?.unitId ?? null,
                            outlet: order?.outlet ?? order?.pickupName ?? null,
                            ts: Date.now(),
                        });
                        setAssignedToast(null);
                    }}
                />
            )}
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