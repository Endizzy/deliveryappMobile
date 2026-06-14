// Модалка «Отчёт за день»: по всем курьерам компании за сегодня.
// Курьер в конце смены сверяет кассу (наличные) и терминал (карта).

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { X, Wallet, CreditCard, Banknote, RefreshCw } from 'lucide-react-native';
import { ORIGIN } from '../constants';
import { useTheme } from '../theme';
import { useT } from '../i18n';

const TOKEN_KEY = 'authToken';
const money = (n) => (Number(n) || 0).toFixed(2);

export default function DailyReportModal({ visible, onClose }) {
    const { colors: COLORS } = useTheme();
    const { t } = useT();
    const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null); // { couriers, totals }

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const token = await AsyncStorage.getItem(TOKEN_KEY);
            const res = await fetch(`${ORIGIN}/api/mobile-report`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            const json = await res.json();
            if (!res.ok || !json.ok) throw new Error(json.error || 'error');
            setData(json);
        } catch (e) {
            setError(t('report.error'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        if (visible) load();
    }, [visible, load]);

    const totals = data?.totals;
    // сводка по авторизованному курьеру (если сегодня ничего не вёз — нули)
    const summary = data?.mine || {
        totalOrders: 0, totalSum: 0, cash: 0, card: 0, wire: 0, totalItems: 0,
    };
    // в списке ниже — только курьеры, выполнявшие заказы сегодня
    const rows = (data?.couriers || []).filter((c) => c.totalOrders > 0);
    const hasAny = totals && totals.totalOrders > 0;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.sheet}>
                    {/* Заголовок */}
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.title}>{t('report.title')}</Text>
                            {data?.date ? <Text style={styles.subtitle}>{data.date}</Text> : null}
                        </View>
                        <View style={styles.headerActions}>
                            <Pressable onPress={load} style={styles.iconBtn} hitSlop={10}>
                                <RefreshCw size={18} color={COLORS.muted} strokeWidth={2.2} />
                            </Pressable>
                            <Pressable onPress={onClose} style={styles.iconBtn} hitSlop={10}>
                                <X size={20} color={COLORS.text} strokeWidth={2.2} />
                            </Pressable>
                        </View>
                    </View>

                    {loading ? (
                        <View style={styles.center}>
                            <ActivityIndicator size="large" color={COLORS.primary} />
                            <Text style={styles.muted}>{t('report.loading')}</Text>
                        </View>
                    ) : error ? (
                        <View style={styles.center}>
                            <Text style={styles.errorText}>{error}</Text>
                            <Pressable onPress={load} style={styles.retryBtn}>
                                <Text style={styles.retryText}>{t('report.retry')}</Text>
                            </Pressable>
                        </View>
                    ) : !hasAny ? (
                        <View style={styles.center}>
                            <Text style={styles.muted}>{t('report.empty')}</Text>
                        </View>
                    ) : (
                        <ScrollView
                            contentContainerStyle={{ paddingBottom: 24 }}
                            showsVerticalScrollIndicator={false}
                        >
                            {/* Сводка: касса / терминал */}
                            <Text style={styles.sectionLabel}>{t('report.summary')}</Text>
                            <View style={styles.summaryRow}>
                                <View style={[styles.summaryCard, styles.cashCard]}>
                                    <Banknote size={20} color={COLORS.primary} strokeWidth={2.2} />
                                    <Text style={styles.summaryCaption}>{t('report.cash')}</Text>
                                    <Text style={styles.summaryValue}>€{money(summary.cash)}</Text>
                                </View>
                                <View style={[styles.summaryCard, styles.cardCard]}>
                                    <CreditCard size={20} color={COLORS.primary} strokeWidth={2.2} />
                                    <Text style={styles.summaryCaption}>{t('report.card')}</Text>
                                    <Text style={styles.summaryValue}>€{money(summary.card)}</Text>
                                </View>
                            </View>

                            <View style={styles.totalsBar}>
                                <View style={styles.totalsItem}>
                                    <Text style={styles.totalsCaption}>{t('report.orders')}</Text>
                                    <Text style={styles.totalsNum}>{summary.totalOrders}</Text>
                                </View>
                                {summary.wire > 0 && (
                                    <View style={styles.totalsItem}>
                                        <Text style={styles.totalsCaption}>{t('report.wire')}</Text>
                                        <Text style={styles.totalsNum}>€{money(summary.wire)}</Text>
                                    </View>
                                )}
                                <View style={styles.totalsItem}>
                                    <Text style={styles.totalsCaption}>{t('report.total')}</Text>
                                    <Text style={[styles.totalsNum, { color: COLORS.text }]}>€{money(summary.totalSum)}</Text>
                                </View>
                            </View>

                            {/* По курьерам */}
                            <Text style={styles.sectionLabel}>{t('report.byCourier')}</Text>
                            {rows.map((c, i) => (
                                <View key={c.unitId ?? `unassigned-${i}`} style={styles.courierCard}>
                                    <View style={styles.courierTop}>
                                        <Text style={styles.courierName} numberOfLines={1}>
                                            {c.unitId == null ? t('report.unassigned') : c.nickname}
                                        </Text>
                                        <Text style={styles.courierOrders}>
                                            {c.totalOrders} · €{money(c.totalSum)}
                                        </Text>
                                    </View>

                                    <View style={styles.courierBreak}>
                                        <View style={styles.breakItem}>
                                            <Banknote size={13} color={COLORS.muted} strokeWidth={2.2} />
                                            <Text style={styles.breakText}>€{money(c.cash)}</Text>
                                        </View>
                                        <View style={styles.breakItem}>
                                            <CreditCard size={13} color={COLORS.muted} strokeWidth={2.2} />
                                            <Text style={styles.breakText}>€{money(c.card)}</Text>
                                        </View>
                                        {c.wire > 0 && (
                                            <View style={styles.breakItem}>
                                                <Wallet size={13} color={COLORS.muted} strokeWidth={2.2} />
                                                <Text style={styles.breakText}>€{money(c.wire)}</Text>
                                            </View>
                                        )}
                                        <View style={styles.breakItem}>
                                            <Text style={styles.breakText}>{t('report.items')}: {c.totalItems}</Text>
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </ScrollView>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const makeStyles = (COLORS) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'flex-end',
    },
    sheet: {
        maxHeight: '88%',
        backgroundColor: COLORS.bg,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 8,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    title: { fontSize: 20, fontWeight: '800', color: COLORS.text },
    subtitle: { marginTop: 2, fontSize: 12, fontWeight: '600', color: COLORS.muted },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    iconBtn: {
        width: 38,
        height: 38,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.line,
    },
    center: { paddingVertical: 48, alignItems: 'center', justifyContent: 'center', gap: 12 },
    muted: { color: COLORS.muted, fontWeight: '600' },
    errorText: { color: COLORS.danger, fontWeight: '800' },
    retryBtn: {
        backgroundColor: COLORS.softBlue,
        borderWidth: 1,
        borderColor: COLORS.softBlueBorder,
        paddingHorizontal: 16,
        paddingVertical: 9,
        borderRadius: 12,
    },
    retryText: { color: COLORS.primary, fontWeight: '800' },

    sectionLabel: {
        fontSize: 12,
        fontWeight: '800',
        color: COLORS.muted,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        marginTop: 8,
        marginBottom: 8,
    },

    summaryRow: { flexDirection: 'row', gap: 10 },
    summaryCard: {
        flex: 1,
        backgroundColor: COLORS.card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.lineSoft,
        padding: 14,
        gap: 6,
    },
    cashCard: {},
    cardCard: {},
    summaryCaption: { fontSize: 12, fontWeight: '700', color: COLORS.muted },
    summaryValue: { fontSize: 22, fontWeight: '900', color: COLORS.text },

    totalsBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: COLORS.card,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.lineSoft,
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginTop: 10,
    },
    totalsItem: { alignItems: 'center', gap: 3 },
    totalsCaption: { fontSize: 11, fontWeight: '600', color: COLORS.muted },
    totalsNum: { fontSize: 16, fontWeight: '900', color: COLORS.primary },

    courierCard: {
        backgroundColor: COLORS.card,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.lineSoft,
        padding: 12,
        marginBottom: 10,
    },
    courierTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    courierName: { flex: 1, fontSize: 15, fontWeight: '800', color: COLORS.text },
    courierOrders: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
    courierBreak: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 14,
        marginTop: 8,
    },
    breakItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    breakText: { fontSize: 13, fontWeight: '700', color: COLORS.muted },
});
