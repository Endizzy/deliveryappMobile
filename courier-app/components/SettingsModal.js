import React, { useState } from 'react';
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

const LANGUAGES = [
    { code: 'ru', label: 'Русский' },
    { code: 'en', label: 'English' },
    { code: 'lv', label: 'Latviešu' },
];

const THEMES = [
    { code: 'dark', label: 'Тёмная' },
    { code: 'light', label: 'Светлая' },
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
    const [localLanguage, setLocalLanguage] = useState(currentLanguage);
    const [localTheme, setLocalTheme] = useState(currentTheme);
    const [soundEnabled, setSoundEnabled] = useState(notificationSoundEnabled);

    const handleLanguageChange = (code) => {
        setLocalLanguage(code);
        onLanguageChange?.(code);
    };

    const handleThemeChange = (code) => {
        setLocalTheme(code);
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
                        <Text style={styles.headerTitle}>Настройки</Text>
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
                        <Text style={styles.sectionTitle}>Звук оповещений</Text>
                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>Звук новых заказов</Text>
                                <Text style={styles.settingDescription}>
                                    {soundEnabled ? 'Включен' : 'Отключен'}
                                </Text>
                            </View>
                            <Switch
                                value={soundEnabled}
                                onValueChange={handleSoundToggle}
                                trackColor={{ false: '#404854', true: '#4ADE80' }}
                                thumbColor={soundEnabled ? '#2ecc71' : '#888'}
                            />
                        </View>
                    </View>

                    {/* Language Settings */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Язык интерфейса</Text>
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
                        <Text style={styles.sectionTitle}>Тема приложения</Text>
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
                                    {theme.label}
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
                                Все изменения сохраняются автоматически
                            </Text>
                        </View>
                    </View>
                </ScrollView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#010B13',
    },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.08)',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
    },

    headerContent: {
        flex: 1,
    },

    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: 0.2,
    },

    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
    },

    closeButtonText: {
        fontSize: 20,
        fontWeight: '600',
        color: '#A6B6C6',
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
        color: '#FFFFFF',
        marginBottom: 12,
        letterSpacing: 0.2,
    },

    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },

    settingInfo: {
        flex: 1,
        marginRight: 12,
    },

    settingLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 4,
    },

    settingDescription: {
        fontSize: 12,
        color: '#8FA3B8',
    },

    optionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },

    optionButtonActive: {
        backgroundColor: 'rgba(0, 122, 255, 0.12)',
        borderColor: 'rgba(0, 122, 255, 0.24)',
    },

    optionButtonText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#A6B6C6',
    },

    optionButtonTextActive: {
        color: '#007AFF',
        fontWeight: '600',
    },

    checkmark: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#007AFF',
        justifyContent: 'center',
        alignItems: 'center',
    },

    checkmarkText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },

    infoBox: {
        backgroundColor: 'rgba(0, 122, 255, 0.08)',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: 'rgba(0, 122, 255, 0.16)',
    },

    infoText: {
        fontSize: 13,
        color: '#7BA3D0',
        lineHeight: 18,
        textAlign: 'center',
    },
});
