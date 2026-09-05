// Диалог подтверждения — нижний лист.
//
// Заменяет системный Alert: тот выглядит по-разному на Android и iOS, не связан
// с оформлением приложения и всегда требует нажатия — даже там, где подтверждать
// нечего. Форма выбрана та же, что у уведомления о новом заказе (NewOrderSheet),
// поэтому приложение говорит на одном языке. Кнопки крупные и у нижнего края —
// курьер попадает по ним не глядя, на ходу и в перчатках.
//
// Поведение зависит от смысла сообщения:
//   без onConfirm  — это результат действия: затемнения нет, лист гаснет сам,
//                    курьеру не нужно подтверждать каждый взятый заказ;
//   с onConfirm    — подтверждение: экран затемняется, две кнопки друг под другом.
//
// Тон задаёт цвет иконки и кнопки: 'ok' — успех, 'danger' — необратимое
// действие или ошибка, 'question' — обычное подтверждение.

import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react-native';
import { useTheme } from '../theme';
import { useT } from '../i18n';

export default function OrderDialog({
    dialog,          // { tone, title, body, confirmText, cancelText, destructive, autoHideMs, onConfirm }
    onDismiss,
}) {
    const { colors: COLORS } = useTheme();
    const { t } = useT();
    const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

    const anim = useRef(new Animated.Value(0)).current;
    const timer = useRef(null);

    const tone = dialog?.tone ?? 'ok';
    const hasActions = typeof dialog?.onConfirm === 'function';
    // результат действия гаснет сам; подтверждение ждёт курьера сколько нужно
    const autoHideMs = dialog?.autoHideMs ?? (hasActions ? null : 3000);

    const hide = (then) => {
        if (timer.current) { clearTimeout(timer.current); timer.current = null; }
        Animated.timing(anim, {
            toValue: 0,
            duration: 190,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
        }).start(({ finished }) => { if (finished) (then ?? onDismiss)?.(); });
    };

    useEffect(() => {
        if (!dialog) return;
        anim.setValue(0);
        Animated.timing(anim, {
            toValue: 1,
            duration: 260,
            easing: Easing.out(Easing.back(1.1)),
            useNativeDriver: true,
        }).start();

        if (autoHideMs) {
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => hide(), autoHideMs);
        }
        return () => { if (timer.current) clearTimeout(timer.current); };
    }, [dialog]);

    if (!dialog) return null;

    const TONE = {
        ok:       { color: COLORS.success, bg: COLORS.softGreen, Icon: CheckCircle2 },
        danger:   { color: COLORS.danger,  bg: COLORS.softRed,   Icon: AlertTriangle },
        question: { color: COLORS.primary, bg: COLORS.softBlue,  Icon: HelpCircle },
    }[tone] ?? { color: COLORS.primary, bg: COLORS.softBlue, Icon: HelpCircle };

    const { Icon } = TONE;
    const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [260, 0] });

    return (
        <View style={styles.root} pointerEvents="box-none">
            {/* Затемнение только для подтверждений: сообщение об успехе не должно
                блокировать работу. Нажатие по фону = отмена. */}
            {hasActions && (
                <Animated.View style={[styles.scrim, { opacity: anim }]}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={() => hide()} />
                </Animated.View>
            )}

            <Animated.View
                style={[styles.sheet, { opacity: anim, transform: [{ translateY }] }]}
            >
                <View style={styles.grab} />

                <View style={styles.row}>
                    <View style={[styles.icon, { backgroundColor: TONE.bg }]}>
                        <Icon size={21} color={TONE.color} strokeWidth={2.3} />
                    </View>
                    <View style={styles.texts}>
                        <Text style={styles.title}>{dialog.title}</Text>
                        {!!dialog.body && <Text style={styles.body}>{dialog.body}</Text>}
                    </View>
                </View>

                <View style={styles.btns}>
                    {hasActions ? (
                        <>
                            <Pressable
                                style={({ pressed }) => [
                                    styles.btn,
                                    { backgroundColor: dialog.destructive ? COLORS.danger : COLORS.primary },
                                    pressed && styles.pressed,
                                ]}
                                onPress={() => hide(() => { onDismiss?.(); dialog.onConfirm?.(); })}
                            >
                                <Text style={styles.btnConfirmText}>
                                    {dialog.confirmText ?? t('dialog.confirm')}
                                </Text>
                            </Pressable>

                            <Pressable
                                style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && styles.pressed]}
                                onPress={() => hide()}
                            >
                                <Text style={styles.btnGhostText}>
                                    {dialog.cancelText ?? t('common.cancel')}
                                </Text>
                            </Pressable>
                        </>
                    ) : (
                        <Pressable
                            style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && styles.pressed]}
                            onPress={() => hide()}
                        >
                            <Text style={styles.btnGhostText}>{t('dialog.gotIt')}</Text>
                        </Pressable>
                    )}
                </View>
            </Animated.View>
        </View>
    );
}

function makeStyles(COLORS) {
    return StyleSheet.create({
        root: {
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            justifyContent: 'flex-end',
            zIndex: 150,
            elevation: 24,
        },
        scrim: {
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(8, 10, 13, 0.72)',
        },
        sheet: {
            backgroundColor: COLORS.cardStrong,
            borderTopWidth: 1,
            borderColor: COLORS.line,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 14,
            paddingHorizontal: 16,
            paddingBottom: 26,
            shadowColor: '#000',
            shadowOpacity: 0.5,
            shadowOffset: { width: 0, height: -10 },
            shadowRadius: 24,
        },
        grab: {
            width: 38, height: 4, borderRadius: 2,
            backgroundColor: COLORS.lineStrong,
            alignSelf: 'center',
            marginBottom: 16,
        },
        row: { flexDirection: 'row', alignItems: 'flex-start', gap: 13, marginBottom: 18 },
        icon: {
            width: 46, height: 46, borderRadius: 15,
            alignItems: 'center', justifyContent: 'center',
        },
        texts: { flex: 1, minWidth: 0 },
        title: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: 5 },
        body: { fontSize: 12.5, lineHeight: 19, color: COLORS.muted, fontWeight: '600' },

        btns: { gap: 9 },
        btn: { borderRadius: 14, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
        btnGhost: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: COLORS.line },
        btnGhostText: { fontSize: 14, fontWeight: '800', color: COLORS.muted },
        btnConfirmText: { fontSize: 14, fontWeight: '800', color: COLORS.onPrimary },
        pressed: { opacity: 0.75 },
    });
}
