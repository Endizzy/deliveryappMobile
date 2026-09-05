// Уведомление о заказе, назначенном ЛИЧНО этому курьеру — полноэкранный вызов.
//
// Отличается от уведомления о свободном заказе намеренно: свободный заказ можно
// пропустить (он останется в списке и его возьмёт кто-то другой), а назначенный
// ждёт именно этого курьера. Поэтому экран перекрывается целиком и — ключевое —
// сам не гаснет: раньше баннер исчезал через 10 секунд, и назначение можно было
// не заметить, находясь за рулём или с сумками в руках.

import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Package, MapPin, Clock } from 'lucide-react-native';
import { useTheme } from '../theme';
import { useT } from '../i18n';

export default function AssignedOrderCall({ order, onPress, onDismiss }) {
    const { colors: COLORS } = useTheme();
    const { t } = useT();
    const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

    const anim = useRef(new Animated.Value(0)).current;
    const ring = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (!order) return;
        anim.setValue(0);
        Animated.timing(anim, {
            toValue: 1,
            duration: 260,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();

        // Расходящееся кольцо — как у входящего звонка, притягивает взгляд
        ring.setValue(0);
        const loop = Animated.loop(
            Animated.timing(ring, {
                toValue: 1,
                duration: 1600,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
            })
        );
        loop.start();
        return () => loop.stop();
    }, [order?.id]);

    const hide = (then) => {
        Animated.timing(anim, {
            toValue: 0,
            duration: 180,
            useNativeDriver: true,
        }).start(({ finished }) => { if (finished) (then ?? onDismiss)?.(); });
    };

    if (!order) return null;

    const orderNo = order.orderSeq || order.orderNo || order.id;
    const address = order.address || order.addressStreet || '';
    const amount = order.amountTotal != null ? `${Number(order.amountTotal).toFixed(2)} €` : '';
    const outlet = String(order.outlet || order.pickupName || '').trim();
    const scheduled = order.scheduledAt ? new Date(order.scheduledAt) : null;
    const scheduledText =
        scheduled && !Number.isNaN(scheduled.getTime())
            ? scheduled.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
            : null;

    const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });
    const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.35] });
    const ringOpacity = ring.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

    return (
        <Animated.View style={[styles.overlay, { opacity: anim }]}>
            <Animated.View style={[styles.content, { transform: [{ scale }] }]}>
                <View style={styles.haloWrap}>
                    <Animated.View
                        style={[styles.ring, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]}
                    />
                    <View style={styles.halo}>
                        <Package size={40} color={COLORS.primary} strokeWidth={2.1} />
                    </View>
                </View>

                <Text style={styles.title}>{t('toast.assignedTitle')}</Text>

                <Text style={styles.orderNo}>№{orderNo}</Text>
                {!!address && <Text style={styles.address} numberOfLines={2}>{address}</Text>}

                {/* Точка комплектации — курьеру нужно знать, откуда забирать */}
                <View style={styles.outletRow}>
                    <MapPin size={15} color={outlet ? COLORS.primary : COLORS.muted} strokeWidth={2.3} />
                    <Text style={[styles.outlet, !outlet && styles.outletEmpty]} numberOfLines={1}>
                        {outlet || t('toast.noOutlet')}
                    </Text>
                </View>

                {!!scheduledText && (
                    <View style={styles.outletRow}>
                        <Clock size={15} color={COLORS.warning} strokeWidth={2.3} />
                        <Text style={styles.scheduled}>{t('toast.scheduledTo', { time: scheduledText })}</Text>
                    </View>
                )}

                {!!amount && <Text style={styles.amount}>{amount}</Text>}

                <View style={styles.btns}>
                    <Pressable
                        style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && styles.pressed]}
                        onPress={() => hide()}
                    >
                        <Text style={styles.btnGhostText}>{t('toast.hide')}</Text>
                    </Pressable>

                    <Pressable
                        style={({ pressed }) => [styles.btn, styles.btnFill, pressed && styles.pressed]}
                        onPress={() => hide(() => onPress?.(order))}
                    >
                        <Text style={styles.btnFillText}>{t('toast.open')}</Text>
                    </Pressable>
                </View>
            </Animated.View>
        </Animated.View>
    );
}

function makeStyles(COLORS) {
    return StyleSheet.create({
        overlay: {
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(10, 13, 17, 0.94)',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
            elevation: 30,
            padding: 26,
        },
        content: { alignItems: 'center', width: '100%' },

        haloWrap: { width: 116, height: 116, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
        ring: {
            position: 'absolute',
            width: 116, height: 116, borderRadius: 58,
            borderWidth: 2, borderColor: COLORS.primary,
        },
        halo: {
            width: 96, height: 96, borderRadius: 48,
            backgroundColor: COLORS.softBlue,
            borderWidth: 2, borderColor: COLORS.softBlueBorder,
            alignItems: 'center', justifyContent: 'center',
        },

        title: { fontSize: 19, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
        orderNo: { marginTop: 10, fontSize: 15, fontWeight: '800', color: COLORS.primary },
        address: { marginTop: 4, fontSize: 14, fontWeight: '600', color: COLORS.muted, textAlign: 'center' },

        outletRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
        outlet: { fontSize: 13.5, fontWeight: '700', color: COLORS.primary, flexShrink: 1 },
        outletEmpty: { color: COLORS.muted, fontStyle: 'italic', fontWeight: '600' },
        scheduled: { fontSize: 13, fontWeight: '700', color: COLORS.warning },

        amount: { marginTop: 14, fontSize: 26, fontWeight: '800', color: COLORS.success },

        btns: { flexDirection: 'row', gap: 10, marginTop: 24, width: '100%' },
        btn: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
        btnGhost: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: COLORS.line },
        btnFill: { backgroundColor: COLORS.primary },
        btnGhostText: { fontSize: 13.5, fontWeight: '800', color: COLORS.muted },
        btnFillText: { fontSize: 13.5, fontWeight: '800', color: COLORS.onPrimary },
        pressed: { opacity: 0.75 },
    });
}
