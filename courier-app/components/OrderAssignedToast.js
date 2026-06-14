// In-app баннер 

import React, { useRef, useEffect, useMemo } from 'react';
import { Animated, Text, View, StyleSheet, Pressable, Platform } from 'react-native';
import { Package, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../theme';
import { useT } from '../i18n';

export default function OrderAssignedToast({ order, onPress, onDismiss, duration = 10000 }) {
    const { colors: COLORS } = useTheme();
    const { t } = useT();
    const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

    const anim = useRef(new Animated.Value(0)).current;
    const timer = useRef(null);

    const hide = () => {
        Animated.timing(anim, {
            toValue: 0,
            duration: 220,
            useNativeDriver: true,
        }).start(({ finished }) => {
            if (finished) onDismiss?.();
        });
    };

    useEffect(() => {
        if (!order) return;
        anim.setValue(0);
        Animated.spring(anim, {
            toValue: 1,
            useNativeDriver: true,
            speed: 16,
            bounciness: 7,
        }).start();

        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(hide, duration);

        return () => {
            if (timer.current) clearTimeout(timer.current);
        };
    }, [order?.id]);

    if (!order) return null;

    const orderNo = order.orderSeq || order.orderNo || order.id;
    const address = order.address || order.addressStreet || '';
    const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-160, 0] });

    return (
        <Animated.View
            pointerEvents="box-none"
            style={[styles.wrap, { opacity: anim, transform: [{ translateY }] }]}
        >
            <Pressable
                style={styles.card}
                onPress={() => {
                    if (timer.current) clearTimeout(timer.current);
                    hide();
                    onPress?.(order);
                }}
            >
                <View style={styles.accent} />
                <View style={styles.iconWrap}>
                    <Package size={20} color={COLORS.primary} strokeWidth={2.4} />
                </View>

                <View style={styles.texts}>
                    <Text style={styles.title} numberOfLines={1}>
                        {t('toast.assignedTitle')}
                    </Text>
                    <Text style={styles.subtitle} numberOfLines={1}>
                        №{orderNo}{address ? `  ·  ${address}` : ''}
                    </Text>
                </View>

                <View style={styles.ctaWrap}>
                    <Text style={styles.cta}>{t('toast.open')}</Text>
                    <ChevronRight size={16} color={COLORS.primary} strokeWidth={2.4} />
                </View>
            </Pressable>
        </Animated.View>
    );
}

const makeStyles = (COLORS) => StyleSheet.create({
    wrap: {
        position: 'absolute',
        top: 8,
        left: 12,
        right: 12,
        zIndex: 100,
        elevation: 20,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: COLORS.card,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: COLORS.softBlueBorder,
        paddingVertical: 12,
        paddingHorizontal: 14,
        paddingLeft: 18,
        overflow: 'hidden',
        shadowColor: COLORS.shadow,
        shadowOpacity: Platform.OS === 'ios' ? 0.3 : 0.25,
        shadowOffset: { width: 0, height: 10 },
        shadowRadius: 18,
    },
    accent: {
        position: 'absolute',
        left: 0,
        top: 12,
        bottom: 12,
        width: 4,
        borderTopRightRadius: 4,
        borderBottomRightRadius: 4,
        backgroundColor: COLORS.primary,
    },
    iconWrap: {
        width: 40,
        height: 40,
        borderRadius: 14,
        backgroundColor: COLORS.softBlue,
        borderWidth: 1,
        borderColor: COLORS.softBlueBorder,
        alignItems: 'center',
        justifyContent: 'center',
    },
    texts: {
        flex: 1,
        minWidth: 0,
    },
    title: {
        fontSize: 14,
        fontWeight: '800',
        color: COLORS.text,
    },
    subtitle: {
        marginTop: 3,
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.muted,
    },
    ctaWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    cta: {
        fontSize: 13,
        fontWeight: '800',
        color: COLORS.primary,
    },
});
