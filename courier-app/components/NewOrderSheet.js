// Уведомление о новом СВОБОДНОМ заказе — нижний лист.
//
// Появляется снизу, в зоне большого пальца: курьер часто держит телефон одной
// рукой, на ходу или в перчатках, и тянуться к верхнему краю неудобно.
// Верх экрана остаётся свободным, список заказов не перекрыт.

import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Package, MapPin } from 'lucide-react-native';
import { useTheme } from '../theme';
import { useT } from '../i18n';

export default function NewOrderSheet({
    order,
    onPress,
    onDismiss,
    duration = 15000,   // свободный заказ можно и пропустить — он останется в списке
    bottomOffset = 58,  // высота таб-бара
}) {
    const { colors: COLORS } = useTheme();
    const { t } = useT();
    const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

    const anim = useRef(new Animated.Value(0)).current;
    const timer = useRef(null);

    const hide = () => {
        Animated.timing(anim, {
            toValue: 0,
            duration: 200,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
        }).start(({ finished }) => { if (finished) onDismiss?.(); });
    };

    useEffect(() => {
        if (!order) return;
        anim.setValue(0);
        Animated.timing(anim, {
            toValue: 1,
            duration: 280,
            easing: Easing.out(Easing.back(1.2)),
            useNativeDriver: true,
        }).start();

        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(hide, duration);
        return () => { if (timer.current) clearTimeout(timer.current); };
    }, [order?.id]);

    if (!order) return null;

    const orderNo = order.orderSeq || order.orderNo || order.id;
    const address = order.address || order.addressStreet || '';
    const amount = order.amountTotal != null ? `${Number(order.amountTotal).toFixed(2)} €` : '';
    // Точка комплектации: если не назначена — говорим об этом прямо,
    // иначе курьер не понимает, откуда забирать заказ.
    const outlet = String(order.outlet || order.pickupName || '').trim();

    const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [220, 0] });

    return (
        <Animated.View
            pointerEvents="box-none"
            style={[styles.wrap, { bottom: bottomOffset, opacity: anim, transform: [{ translateY }] }]}
        >
            <View style={styles.sheet}>
                <View style={styles.grab} />

                <View style={styles.row}>
                    <View style={styles.iconWrap}>
                        <Package size={21} color={COLORS.primary} strokeWidth={2.3} />
                    </View>

                    <View style={styles.texts}>
                        <Text style={styles.title} numberOfLines={1}>
                            {t('toast.newTitle')}
                        </Text>
                        <Text style={styles.subtitle} numberOfLines={1}>
                            №{orderNo}{address ? `  ·  ${address}` : ''}{amount ? `  ·  ${amount}` : ''}
                        </Text>

                        <View style={styles.outletRow}>
                            <MapPin
                                size={13}
                                color={outlet ? COLORS.primary : COLORS.muted}
                                strokeWidth={2.3}
                            />
                            <Text
                                style={[styles.outlet, !outlet && styles.outletEmpty]}
                                numberOfLines={1}
                            >
                                {outlet || t('toast.noOutlet')}
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.btns}>
                    <Pressable
                        style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && styles.pressed]}
                        onPress={() => { if (timer.current) clearTimeout(timer.current); hide(); }}
                    >
                        <Text style={styles.btnGhostText}>{t('toast.later')}</Text>
                    </Pressable>

                    <Pressable
                        style={({ pressed }) => [styles.btn, styles.btnFill, pressed && styles.pressed]}
                        onPress={() => {
                            if (timer.current) clearTimeout(timer.current);
                            hide();
                            onPress?.(order);
                        }}
                    >
                        <Text style={styles.btnFillText}>{t('toast.open')}</Text>
                    </Pressable>
                </View>
            </View>
        </Animated.View>
    );
}

function makeStyles(COLORS) {
    return StyleSheet.create({
        wrap: {
            position: 'absolute',
            left: 10,
            right: 10,
            zIndex: 90,
            elevation: 18,
        },
        sheet: {
            backgroundColor: COLORS.cardStrong,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: COLORS.softBlueBorder,
            padding: 15,
            shadowColor: '#000',
            shadowOpacity: 0.45,
            shadowOffset: { width: 0, height: -6 },
            shadowRadius: 20,
        },
        grab: {
            width: 36,
            height: 4,
            borderRadius: 2,
            backgroundColor: COLORS.lineStrong,
            alignSelf: 'center',
            marginBottom: 12,
        },
        row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 13 },
        iconWrap: {
            width: 44,
            height: 44,
            borderRadius: 15,
            backgroundColor: COLORS.softBlue,
            borderWidth: 1,
            borderColor: COLORS.softBlueBorder,
            alignItems: 'center',
            justifyContent: 'center',
        },
        texts: { flex: 1, minWidth: 0 },
        title: { fontSize: 15, fontWeight: '800', color: COLORS.text },
        subtitle: { marginTop: 3, fontSize: 12.5, fontWeight: '600', color: COLORS.muted },
        outletRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
        outlet: { fontSize: 12, fontWeight: '700', color: COLORS.primary, flexShrink: 1 },
        outletEmpty: { color: COLORS.muted, fontStyle: 'italic', fontWeight: '600' },

        btns: { flexDirection: 'row', gap: 9 },
        btn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
        btnGhost: { backgroundColor: COLORS.softGray, borderWidth: 1, borderColor: COLORS.line },
        btnFill: { backgroundColor: COLORS.primary },
        btnGhostText: { fontSize: 13, fontWeight: '800', color: COLORS.muted },
        btnFillText: { fontSize: 13, fontWeight: '800', color: COLORS.onPrimary },
        pressed: { opacity: 0.75 },
    });
}
