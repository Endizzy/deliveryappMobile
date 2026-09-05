// Прежний вид главного экрана (вкладка «Меню») — сохранён для отката.
//
// Разметка перенесена из CourierShiftScreen без изменений, поэтому стили
// приходят пропом `styles` из родителя: так гарантируется, что вид остался
// ровно тем же, что был до редизайна.
//
// Чтобы вернуть этот экран, поставьте в CourierShiftScreen:
//     const USE_CLASSIC_MENU = true;

import React from 'react';
import { View, Text, Animated } from 'react-native';
import { Settings, BarChart3 } from 'lucide-react-native';
import PressableScale from '../anim/PressableScale';

export default function MenuClassic({
    styles,
    COLORS,
    t,
    initial,
    nickname,
    idText,
    connected,
    wsPulse,
    status,
    statusFade,
    onOpenReport,
    onOpenSettings,
    onStartShift,
    onStopShift,
    onExit,
}) {
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
                            status === 'online' ? styles.shiftBadgeOnline : styles.shiftBadgeOffline,
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

                    <PressableScale style={styles.settingsButton} onPress={onOpenReport} scaleTo={0.9}>
                        <Text style={styles.settingsButtonText}><BarChart3 color={COLORS.accent} /></Text>
                    </PressableScale>

                    <PressableScale style={styles.settingsButton} onPress={onOpenSettings} scaleTo={0.9}>
                        <Text style={styles.settingsButtonText}><Settings color={COLORS.accent} /></Text>
                    </PressableScale>
                </View>
            </View>

            <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>{t('shift.manageTitle')}</Text>
                <Text style={styles.sectionSubtitle}>{t('shift.manageSubtitle')}</Text>

                <View style={styles.controls}>
                    <PressableScale style={styles.primaryButton} onPress={onStartShift}>
                        <Text style={styles.primaryButtonText}>{t('shift.start')}</Text>
                    </PressableScale>

                    <PressableScale style={styles.ghostButton} onPress={onStopShift}>
                        <Text style={styles.ghostButtonText}>{t('shift.stop')}</Text>
                    </PressableScale>

                    <PressableScale style={styles.exitButton} onPress={onExit}>
                        <Text style={styles.exitButtonText}>{t('shift.logout')}</Text>
                    </PressableScale>
                </View>
            </View>
        </View>
    );
}
