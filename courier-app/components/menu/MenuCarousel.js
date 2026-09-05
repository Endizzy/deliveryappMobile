// Главный экран: смена + карусель активных заказов.
//
// Курьер часто везёт несколько заказов сразу, поэтому каждый занимает почти всю
// ширину экрана и листается пальцем: адрес и кнопки крупные, читаются на ходу.
// Точки под каруселью показывают, сколько заказов на руках и какой открыт.
//
// Сознательно не показываем пройденный путь (геолокация включена не у всех)
// и заработок — для денег есть отдельный отчёт, дублировать его здесь незачем.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    Dimensions,
    Animated,
} from 'react-native';
import { Settings, BarChart3, Phone, Navigation, CheckCircle2, PackageOpen } from 'lucide-react-native';
import PressableScale from '../anim/PressableScale';

const H_PADDING = 12;
const CARD_GAP = 9;

export default function MenuCarousel({
    COLORS,
    t,
    initial,
    nickname,
    idText,
    connected,
    wsPulse,
    status,
    statusFade,
    shiftStartedAt,      // ISO-строка начала смены или null
    orders = [],         // активные заказы курьера
    onOpenOrder,
    onCall,
    onEnroute,
    onComplete,
    onOpenReport,
    onOpenSettings,
    onStartShift,
    onStopShift,
    onExit,
}) {
    const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
    const { width } = Dimensions.get('window');
    const cardWidth = width - H_PADDING * 2 - 26; // край следующей карточки виден — подсказка, что можно листать

    const [page, setPage] = useState(0);
    const onShift = status === 'online';

    // Таймер смены: пересчитываем раз в минуту, секунды курьеру не нужны
    const [nowTs, setNowTs] = useState(Date.now());
    useEffect(() => {
        if (!onShift || !shiftStartedAt) return;
        const id = setInterval(() => setNowTs(Date.now()), 30000);
        return () => clearInterval(id);
    }, [onShift, shiftStartedAt]);

    const shiftDuration = useMemo(() => {
        if (!onShift || !shiftStartedAt) return null;
        const start = new Date(shiftStartedAt).getTime();
        if (Number.isNaN(start)) return null;
        const mins = Math.max(0, Math.floor((nowTs - start) / 60000));
        return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    }, [onShift, shiftStartedAt, nowTs]);

    const handleScroll = (e) => {
        const x = e.nativeEvent.contentOffset.x;
        setPage(Math.round(x / (cardWidth + CARD_GAP)));
    };

    return (
        <View style={styles.root}>
            {/* ── Шапка: кто я, есть ли связь, сколько на смене ── */}
            <View style={styles.header}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initial}</Text>
                </View>

                <View style={styles.headerTexts}>
                    <Text style={styles.nickname} numberOfLines={1}>{nickname}</Text>
                    <Text style={styles.headerSub} numberOfLines={1}>
                        {onShift
                            ? `${t('shift.onShift')}${shiftDuration ? ` · ${shiftDuration}` : ''}`
                            : `${t('shift.idLabel')}: ${idText}`}
                    </Text>
                </View>

                <Animated.View
                    style={[
                        styles.wsPill,
                        connected ? styles.wsPillOn : styles.wsPillOff,
                        { opacity: wsPulse },
                    ]}
                >
                    <Text style={[styles.wsPillText, { color: connected ? COLORS.primary : COLORS.muted }]}>
                        {connected ? t('shift.wsOnline') : t('shift.wsConnecting')}
                    </Text>
                </Animated.View>

                <PressableScale style={styles.iconBtn} onPress={onOpenSettings} scaleTo={0.9}>
                    <Settings size={17} color={COLORS.muted} strokeWidth={2.2} />
                </PressableScale>
            </View>

            {/* ── Карусель активных заказов ── */}
            {orders.length > 0 ? (
                <>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        snapToInterval={cardWidth + CARD_GAP}
                        decelerationRate="fast"
                        contentContainerStyle={styles.carousel}
                        onMomentumScrollEnd={handleScroll}
                    >
                        {orders.map((order, idx) => (
                            <OrderCard
                                key={String(order.id)}
                                order={order}
                                index={idx}
                                total={orders.length}
                                width={cardWidth}
                                styles={styles}
                                COLORS={COLORS}
                                t={t}
                                onOpen={() => onOpenOrder?.(order)}
                                onCall={() => onCall?.(order.phone)}
                                onEnroute={() => onEnroute?.(order.id)}
                                onComplete={() => onComplete?.(order.id)}
                            />
                        ))}
                    </ScrollView>

                    {orders.length > 1 && (
                        <View style={styles.dots}>
                            {orders.map((o, i) => (
                                <View
                                    key={String(o.id)}
                                    style={[styles.dot, i === page && styles.dotActive]}
                                />
                            ))}
                        </View>
                    )}
                </>
            ) : (
                <View style={styles.empty}>
                    <View style={styles.emptyIcon}>
                        <PackageOpen size={26} color={COLORS.muted} strokeWidth={1.8} />
                    </View>
                    <Text style={styles.emptyTitle}>{t('menu.noOrdersTitle')}</Text>
                    <Text style={styles.emptyText}>
                        {onShift ? t('menu.noOrdersOnShift') : t('menu.noOrdersOffShift')}
                    </Text>
                </View>
            )}

            <View style={styles.spacer} />

            {/* ── Действия ── */}
            <View style={styles.actionsRow}>
                <PressableScale style={[styles.action, styles.actionGhost]} onPress={onOpenReport}>
                    <BarChart3 size={16} color={COLORS.primary} strokeWidth={2.2} />
                    <Text style={styles.actionGhostText}>{t('menu.report')}</Text>
                </PressableScale>

                {/* Кнопка смены одна и зависит от состояния: раньше показывались обе */}
                {onShift ? (
                    <PressableScale style={[styles.action, styles.actionStop]} onPress={onStopShift}>
                        <Text style={styles.actionStopText}>{t('shift.stop')}</Text>
                    </PressableScale>
                ) : (
                    <PressableScale style={[styles.action, styles.actionStart]} onPress={onStartShift}>
                        <Text style={styles.actionStartText}>{t('shift.start')}</Text>
                    </PressableScale>
                )}
            </View>

            {/* Выход отделён от рабочих кнопок — случайное нажатие стоит дорого */}
            <PressableScale style={styles.exit} onPress={onExit} scaleTo={0.97}>
                <Text style={styles.exitText}>{t('shift.logout')}</Text>
            </PressableScale>
        </View>
    );
}

// ── Карточка одного заказа ──────────────────────────────────────────────────
function OrderCard({ order, index, total, width, styles, COLORS, t, onOpen, onCall, onEnroute, onComplete }) {
    const statusLc = String(order.status || '').toLowerCase();
    const isEnroute = statusLc === 'enroute';

    const number = order.orderSeq || order.orderNo || order.id;
    const address = order.address || order.addressStreet || '—';
    const outlet = String(order.outlet || order.pickupName || '').trim();

    const state = isEnroute
        ? { label: t('menu.stateDelivering'), bg: COLORS.softAmber ?? 'rgba(251,191,36,0.14)', color: COLORS.warning }
        : { label: t('menu.statePickup'), bg: COLORS.softBlue, color: COLORS.primary };

    return (
        <PressableScale style={[styles.card, { width }]} onPress={onOpen} scaleTo={0.98}>
            <View style={styles.cardTop}>
                <View style={[styles.statePill, { backgroundColor: state.bg }]}>
                    <Text style={[styles.statePillText, { color: state.color }]}>{state.label}</Text>
                </View>
                <Text style={styles.counter}>{t('menu.counter', { current: index + 1, total })}</Text>
            </View>

            <Text style={styles.cardTitle} numberOfLines={2}>№{number} · {address}</Text>
            <Text style={styles.cardSub} numberOfLines={1}>
                {[outlet || t('toast.noOutlet'), order.customer].filter(Boolean).join('  ·  ')}
            </Text>

            <View style={styles.cardBtns}>
                {isEnroute ? (
                    <PressableScale style={[styles.cardBtn, styles.cardBtnPrimary]} onPress={onComplete}>
                        <CheckCircle2 size={15} color={COLORS.onPrimary} strokeWidth={2.3} />
                        <Text style={styles.cardBtnPrimaryText}>{t('myOrders.done')}</Text>
                    </PressableScale>
                ) : (
                    <PressableScale style={[styles.cardBtn, styles.cardBtnPrimary]} onPress={onEnroute}>
                        <Navigation size={15} color={COLORS.onPrimary} strokeWidth={2.3} />
                        <Text style={styles.cardBtnPrimaryText}>{t('myOrders.enroute')}</Text>
                    </PressableScale>
                )}

                <PressableScale
                    style={[styles.cardBtn, styles.cardBtnGhost, !order.phone && styles.cardBtnDisabled]}
                    onPress={order.phone ? onCall : undefined}
                >
                    <Phone size={15} color={COLORS.muted} strokeWidth={2.3} />
                    <Text style={styles.cardBtnGhostText}>{t('menu.call')}</Text>
                </PressableScale>
            </View>
        </PressableScale>
    );
}

function makeStyles(COLORS) {
    return StyleSheet.create({
        root: { flex: 1, paddingHorizontal: H_PADDING, paddingTop: 10 },

        header: { flexDirection: 'row', alignItems: 'center', gap: 9 },
        avatar: {
            width: 38, height: 38, borderRadius: 13,
            backgroundColor: COLORS.softBlue,
            borderWidth: 1, borderColor: COLORS.softBlueBorder,
            alignItems: 'center', justifyContent: 'center',
        },
        avatarText: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
        headerTexts: { flex: 1, minWidth: 0 },
        nickname: { fontSize: 14.5, fontWeight: '800', color: COLORS.text },
        headerSub: { fontSize: 11, color: COLORS.muted, marginTop: 2, fontWeight: '600' },

        wsPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
        wsPillOn: { backgroundColor: COLORS.softBlue, borderColor: COLORS.softBlueBorder },
        wsPillOff: { backgroundColor: COLORS.softGray, borderColor: COLORS.line },
        wsPillText: { fontSize: 10, fontWeight: '800' },

        iconBtn: {
            width: 32, height: 32, borderRadius: 10,
            backgroundColor: COLORS.ghost, borderWidth: 1, borderColor: COLORS.line,
            alignItems: 'center', justifyContent: 'center',
        },

        carousel: { paddingTop: 14, paddingBottom: 2, gap: CARD_GAP },

        card: {
            backgroundColor: COLORS.card,
            borderWidth: 1, borderColor: COLORS.softBlueBorder,
            borderRadius: 18, padding: 14,
        },
        cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
        statePill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
        statePillText: { fontSize: 10, fontWeight: '800' },
        counter: { fontSize: 11, color: COLORS.muted, fontWeight: '600' },

        cardTitle: { fontSize: 15.5, fontWeight: '800', color: COLORS.text, marginTop: 10 },
        cardSub: { fontSize: 12, color: COLORS.muted, marginTop: 4, fontWeight: '600' },

        cardBtns: { flexDirection: 'row', gap: 8, marginTop: 13 },
        cardBtn: {
            flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
            borderRadius: 12, paddingVertical: 11,
        },
        cardBtnPrimary: { backgroundColor: COLORS.primary },
        cardBtnPrimaryText: { fontSize: 12.5, fontWeight: '800', color: COLORS.onPrimary },
        cardBtnGhost: { backgroundColor: COLORS.ghost, borderWidth: 1, borderColor: COLORS.line },
        cardBtnGhostText: { fontSize: 12.5, fontWeight: '800', color: COLORS.muted },
        cardBtnDisabled: { opacity: 0.45 },

        dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 11 },
        dot: { width: 5, height: 5, borderRadius: 99, backgroundColor: COLORS.lineStrong },
        dotActive: { width: 18, backgroundColor: COLORS.primary },

        empty: { alignItems: 'center', paddingVertical: 30, gap: 8 },
        emptyIcon: {
            width: 56, height: 56, borderRadius: 20,
            backgroundColor: COLORS.softGray, borderWidth: 1, borderColor: COLORS.line,
            alignItems: 'center', justifyContent: 'center',
        },
        emptyTitle: { fontSize: 14.5, fontWeight: '800', color: COLORS.text, marginTop: 4 },
        emptyText: { fontSize: 12, color: COLORS.muted, textAlign: 'center', fontWeight: '600', paddingHorizontal: 20 },

        spacer: { flex: 1 },

        actionsRow: { flexDirection: 'row', gap: 9 },
        action: {
            flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
            borderRadius: 15, paddingVertical: 14,
        },
        actionGhost: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line },
        actionGhostText: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
        actionStart: { backgroundColor: COLORS.success },
        actionStartText: { fontSize: 13, fontWeight: '800', color: '#07230F' },
        actionStop: { backgroundColor: COLORS.danger },
        actionStopText: { fontSize: 13, fontWeight: '800', color: '#2A0D0D' },

        exit: { alignItems: 'center', paddingVertical: 14, marginTop: 2 },
        exitText: { fontSize: 12.5, fontWeight: '700', color: COLORS.muted },
    });
}
