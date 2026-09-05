// Индикатор связи и офлайн-очереди.
//
// Показывается, только когда есть что сообщить:
//   • действия ждут отправки — курьер должен видеть, что нажатие не пропало;
//   • связи нет — объясняет, почему список не обновляется.
// В обычной ситуации баннер скрыт и не занимает место.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { CloudOff, RefreshCw, WifiOff } from 'lucide-react-native';
import { useTheme } from '../theme';
import { useT } from '../i18n';

export default function ConnectionBanner({ pendingCount = 0, offline = false, syncing = false, onRetry }) {
    const { colors: COLORS } = useTheme();
    const { t } = useT();
    const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

    // Баннер — индикатор ПРОБЛЕМЫ, а не нормальной работы. Любое действие
    // курьера сначала попадает в очередь и лишь потом уходит на сервер, поэтому
    // при живой связи pendingCount на доли секунды становится > 0. Показывать
    // из-за этого предупреждение нельзя — курьер видел бы его при каждом нажатии.
    // Ждём GRACE_MS: если за это время очередь ушла, пользователь ничего не увидит.
    const GRACE_MS = 2500;
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // связь оборвалась — сообщаем сразу, тут ждать нечего
        if (offline && pendingCount > 0) { setVisible(true); return; }
        if (pendingCount === 0) { setVisible(false); return; }

        const tm = setTimeout(() => setVisible(true), GRACE_MS);
        return () => clearTimeout(tm);
    }, [pendingCount, offline]);

    const anim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.timing(anim, {
            toValue: visible ? 1 : 0,
            duration: 200,
            useNativeDriver: true,
        }).start();
    }, [visible, anim]);

    // Вращение иконки во время отправки
    const spin = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        if (!syncing) { spin.stopAnimation(); spin.setValue(0); return; }
        const loop = Animated.loop(
            Animated.timing(spin, { toValue: 1, duration: 900, useNativeDriver: true })
        );
        loop.start();
        return () => loop.stop();
    }, [syncing, spin]);

    if (!visible) return null;

    // Ожидающие отправки действия важнее сообщения об отсутствии связи:
    // курьеру нужно знать, что его нажатия сохранены.
    const pending = pendingCount > 0;
    const tone = pending ? 'pending' : 'offline';

    // t() в этом приложении не поддерживает defaultValue — ключи обязаны быть в i18n
    const text = pending
        ? t('connection.pending', { count: pendingCount })
        : t('connection.offline');

    const Icon = pending ? CloudOff : WifiOff;

    return (
        <Animated.View
            style={[
                styles.wrap,
                tone === 'pending' ? styles.wrapPending : styles.wrapOffline,
                { opacity: anim },
            ]}
        >
            <Icon size={16} color={tone === 'pending' ? COLORS.warning : COLORS.danger} />
            <Text style={styles.text} numberOfLines={2}>{text}</Text>

            {pending && (
                <Pressable
                    onPress={onRetry}
                    hitSlop={10}
                    disabled={syncing}
                    style={({ pressed }) => [styles.retry, pressed && { opacity: 0.6 }]}
                >
                    <Animated.View
                        style={{
                            transform: [{
                                rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }),
                            }],
                        }}
                    >
                        <RefreshCw size={15} color={COLORS.warning} />
                    </Animated.View>
                </Pressable>
            )}
        </Animated.View>
    );
}

function makeStyles(COLORS) {
    return StyleSheet.create({
        wrap: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            marginHorizontal: 12,
            marginTop: 8,
            borderRadius: 10,
            borderWidth: 1,
        },
        wrapPending: {
            backgroundColor: 'rgba(251, 191, 36, 0.12)',
            borderColor: 'rgba(251, 191, 36, 0.35)',
        },
        wrapOffline: {
            backgroundColor: 'rgba(229, 72, 77, 0.12)',
            borderColor: 'rgba(229, 72, 77, 0.35)',
        },
        text: {
            flex: 1,
            fontSize: 12.5,
            lineHeight: 17,
            color: COLORS.text,
        },
        retry: {
            padding: 4,
        },
    });
}
