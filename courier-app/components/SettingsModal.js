import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Switch,
    Alert,
} from 'react-native';
import { useTheme } from '../theme';
import { useT } from '../i18n';

// Названия языков всегда на родном языке — не переводятся.
const LANGUAGES = [
    { code: 'ru', label: 'Русский' },
    { code: 'en', label: 'English' },
    { code: 'lv', label: 'Latviešu' },
];

const THEMES = [
    { code: 'dark', labelKey: 'settings.themeDark' },
    { code: 'light', labelKey: 'settings.themeLight' },
];

export default function SettingsModal({
    visible,
    onClose,
    currentLanguage = 'ru',
    currentTheme = 'dark',
    onLanguageChange,
    onThemeChange,
    onNotificationSoundChange,
    notificationSoundEnabled = true,
}) {
    const { colors: COLORS } = useTheme();
    const { t } = useT();
    const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

    const [soundEnabled, setSoundEnabled] = useState(notificationSoundEnabled);

    // Выбор языка и темы берётся напрямую из глобального состояния, чтобы
    // подсветка всегда отражала реально применённые значения.
    const localLanguage = currentLanguage;
    const localTheme = currentTheme;

    const handleLanguageChange = (code) => {
        onLanguageChange?.(code);
    };

    const handleThemeChange = (code) => {
        onThemeChange?.(code);
    };

    const handleSoundToggle = () => {
        const newValue = !soundEnabled;
        setSoundEnabled(newValue);
        onNotificationSoundChange?.(newValue);
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={false}
            onRequestClose={onClose}
            statusBarTranslucent={false}
        >
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerContent}>
                        <Text style={styles.headerTitle}>{t('settings.title')}</Text>
                    </View>
                    <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
                        <Text style={styles.closeButtonText}>✕</Text>
                    </TouchableOpacity>
                </View>

                {/* Content */}
                <ScrollView
                    style={styles.content}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                >
                    {/* Sound Settings */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>{t('settings.soundSection')}</Text>
                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>{t('settings.soundLabel')}</Text>
                                <Text style={styles.settingDescription}>
                                    {soundEnabled ? t('settings.on') : t('settings.off')}
                                </Text>
                            </View>
                            <Switch
                                value={soundEnabled}
                                onValueChange={handleSoundToggle}
                                trackColor={{ false: COLORS.switchTrackOff, true: COLORS.switchTrackOn }}
                                thumbColor={soundEnabled ? COLORS.switchThumbOn : COLORS.switchThumbOff}
                            />
                        </View>
                    </View>

                    {/* Language Settings */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>{t('settings.langSection')}</Text>
                        {LANGUAGES.map((lang) => (
                            <TouchableOpacity
                                key={lang.code}
                                style={[
                                    styles.optionButton,
                                    localLanguage === lang.code && styles.optionButtonActive,
                                ]}
                                onPress={() => handleLanguageChange(lang.code)}
                                activeOpacity={0.7}
                            >
                                <Text
                                    style={[
                                        styles.optionButtonText,
                                        localLanguage === lang.code && styles.optionButtonTextActive,
                                    ]}
                                >
                                    {lang.label}
                                </Text>
                                {localLanguage === lang.code && (
                                    <View style={styles.checkmark}>
                                        <Text style={styles.checkmarkText}>✓</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Theme Settings */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>{t('settings.themeSection')}</Text>
                        {THEMES.map((theme) => (
                            <TouchableOpacity
                                key={theme.code}
                                style={[
                                    styles.optionButton,
                                    localTheme === theme.code && styles.optionButtonActive,
                                ]}
                                onPress={() => handleThemeChange(theme.code)}
                                activeOpacity={0.7}
                            >
                                <Text
                                    style={[
                                        styles.optionButtonText,
                                        localTheme === theme.code && styles.optionButtonTextActive,
                                    ]}
                                >
                                    {t(theme.labelKey)}
                                </Text>
                                {localTheme === theme.code && (
                                    <View style={styles.checkmark}>
                                        <Text style={styles.checkmarkText}>✓</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Info Section */}
                    <View style={styles.section}>
                        <View style={styles.infoBox}>
                            <Text style={styles.infoText}>
                                {t('settings.autosaveNote')}
                            </Text>
                        </View>
                    </View>
                </ScrollView>
            </View>
        </Modal>
    );
}

const makeStyles = (COLORS) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bg,
    },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.line,
        backgroundColor: COLORS.surfaceSoft,
    },

    headerContent: {
        flex: 1,
    },

    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.text,
        letterSpacing: 0.2,
    },

    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.surface,
        justifyContent: 'center',
        alignItems: 'center',
    },

    closeButtonText: {
        fontSize: 20,
        fontWeight: '600',
        color: COLORS.muted,
    },

    content: {
        flex: 1,
    },

    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 24,
    },

    section: {
        marginBottom: 28,
    },

    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.text,
        marginBottom: 12,
        letterSpacing: 0.2,
    },

    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: COLORS.line,
    },

    settingInfo: {
        flex: 1,
        marginRight: 12,
    },

    settingLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 4,
    },

    settingDescription: {
        fontSize: 12,
        color: COLORS.muted,
    },

    optionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: COLORS.line,
    },

    optionButtonActive: {
        backgroundColor: COLORS.softBlue,
        borderColor: COLORS.softBlueBorder,
    },

    optionButtonText: {
        fontSize: 15,
        fontWeight: '500',
        color: COLORS.muted,
    },

    optionButtonTextActive: {
        color: COLORS.accent,
        fontWeight: '600',
    },

    checkmark: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: COLORS.accent,
        justifyContent: 'center',
        alignItems: 'center',
    },

    checkmarkText: {
        color: COLORS.onPrimary,
        fontSize: 14,
        fontWeight: '700',
    },

    infoBox: {
        backgroundColor: COLORS.softBlue,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: COLORS.softBlueBorder,
    },

    infoText: {
        fontSize: 13,
        color: COLORS.primary,
        lineHeight: 18,
        textAlign: 'center',
    },
});
