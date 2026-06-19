// LoginScreen.js
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Animated,
    Keyboard,
    Platform,
    StyleSheet,
    Alert,
    StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LottieView from 'lottie-react-native';
import CourierAnimation from './assets/Lotties/Food Courier.json';
import { useTheme } from './theme';
import { useT } from './i18n';
import { ORIGIN } from './constants';

// Keyboard padding через Animated.Value — без ре-рендера LoginScreen
function useKeyboardPadding() {
    const padding = useRef(new Animated.Value(24)).current;

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const onShow = (e) => {
            Animated.timing(padding, {
                toValue: e.endCoordinates.height + 24,
                duration: 50,
                useNativeDriver: false,
            }).start();
        };

        const onHide = () => {
            Animated.timing(padding, {
                toValue: 24,
                duration: 50,
                useNativeDriver: false,
            }).start();
        };

        const showSub = Keyboard.addListener(showEvent, onShow);
        const hideSub = Keyboard.addListener(hideEvent, onHide);
        return () => { showSub.remove(); hideSub.remove(); };
    }, []);

    return padding;
}

// Бордер тоже через Animated.Value — setState вообще не вызывается при фокусе,
// поэтому компонент никогда не перерисовывается и TextInput не теряет фокус
function FocusableInput({ label, ...props }) {
    const { colors: COLORS } = useTheme();
    const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
    const anim = useRef(new Animated.Value(0)).current;

    const borderColor = anim.interpolate({
        inputRange: [0, 1],
        outputRange: [COLORS.lineSoft, COLORS.primary],
    });

    const shadowOpacity = anim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.18],
    });

    const handleFocus = () => {
        Animated.timing(anim, { toValue: 1, duration: 150, useNativeDriver: false }).start();
        props.onFocus?.();
    };

    const handleBlur = () => {
        Animated.timing(anim, { toValue: 0, duration: 150, useNativeDriver: false }).start();
        props.onBlur?.();
    };

    return (
        <Animated.View style={[
            styles.inputWrapper,
            { borderColor, shadowColor: COLORS.primary, shadowOpacity, shadowRadius: 10, elevation: 4 },
        ]}>
            <Text style={styles.inputLabel}>{label}</Text>
            <TextInput
                {...props}
                style={styles.input}
                onFocus={handleFocus}
                onBlur={handleBlur}
            />
        </Animated.View>
    );
}

export default function LoginScreen({ onLoginSuccess }) {
    const { colors: COLORS } = useTheme();
    const { t } = useT();
    const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const keyboardPadding = useKeyboardPadding();

    // Автозаполнение сохранённых логина/пароля (после перезахода или смерти токена)
    useEffect(() => {
        (async () => {
            try {
                const raw = await AsyncStorage.getItem('savedCredentials');
                if (raw) {
                    const c = JSON.parse(raw);
                    if (c?.login) setLogin(c.login);
                    if (c?.password) setPassword(c.password);
                }
            } catch { }
        })();
    }, []);

    const handleSubmit = async () => {
        if (!login || !password) {
            Alert.alert(t('common.error'), t('login.errEnterCredentials'));
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${ORIGIN}/api/auth/courierlogin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    unit_email: login,
                    unit_password: password,
                }),
            });

            const contentType = res.headers.get('content-type') || '';
            let data;
            if (contentType.includes('application/json')) {
                data = await res.json();
            } else {
                const text = await res.text();
                console.warn('Non-JSON response body:', text);
                throw new Error(`Непредвиденный ответ от сервера (status ${res.status}).`);
            }

            if (!res.ok) {
                Alert.alert(t('common.error'), data?.error || data?.message || t('login.errLogin'));
            } else {
                const token = data.token;
                if (!token) {
                    Alert.alert(t('common.error'), t('login.errNoToken'));
                } else {
                    await AsyncStorage.setItem('authToken', token);
                    // Запоминаем логин/пароль для автозаполнения при следующем входе
                    try {
                        await AsyncStorage.setItem(
                            'savedCredentials',
                            JSON.stringify({ login, password })
                        );
                    } catch { }
                    onLoginSuccess && onLoginSuccess();
                }
            }
        } catch (err) {
            console.error('Ошибка сети или парсинга:', err);
            Alert.alert(t('login.errNetwork'), err.message || t('login.errTryLater'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <StatusBar barStyle={COLORS.statusBar} backgroundColor={COLORS.bg} />
            <View style={styles.container}>
                <Animated.ScrollView
                    contentContainerStyle={[styles.scrollContent, { paddingBottom: keyboardPadding }]}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                >
                    <View style={styles.bgCircleTop} />
                    <View style={styles.bgCircleBottom} />

                    <View style={styles.logoWrapper}>
                        <LottieView
                            source={CourierAnimation}
                            autoPlay
                            loop
                            style={styles.animation}
                        />
                    </View>

                    <Text style={styles.title}>{t('login.title')}</Text>
                    <Text style={styles.subtitle}>
                        {t('login.subtitle')}
                    </Text>

                    <View style={styles.card}>
                        <FocusableInput
                            label={t('login.loginLabel')}
                            placeholder={t('login.loginPlaceholder')}
                            placeholderTextColor={COLORS.placeholder}
                            value={login}
                            onChangeText={setLogin}
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="email-address"
                            autoComplete="off"
                            importantForAutofill="no"
                            accessible={true}
                            accessibilityLabel="Поле для ввода логина"
                        />

                        <FocusableInput
                            label={t('login.passwordLabel')}
                            placeholder={t('login.passwordPlaceholder')}
                            placeholderTextColor={COLORS.placeholder}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            autoComplete="off"
                            importantForAutofill="no"
                            returnKeyType="done"
                            onSubmitEditing={handleSubmit}
                            accessible={true}
                            accessibilityLabel="Поле для ввода пароля"
                        />

                        <TouchableOpacity
                            style={[styles.button, loading && styles.buttonDisabled]}
                            onPress={handleSubmit}
                            accessibilityRole="button"
                            accessibilityLabel="Кнопка войти"
                            disabled={loading}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.buttonText}>
                                {loading ? t('login.signingIn') : t('login.signIn')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </Animated.ScrollView>
            </View>
        </>
    );
}

const makeStyles = (COLORS) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bg,
    },

    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingTop: 40,
    },

    bgCircleTop: {
        position: 'absolute',
        top: -80,
        right: -60,
        width: 220,
        height: 220,
        borderRadius: 110,
        backgroundColor: COLORS.circleTop,
    },

    bgCircleBottom: {
        position: 'absolute',
        bottom: -100,
        left: -80,
        width: 260,
        height: 260,
        borderRadius: 130,
        backgroundColor: COLORS.circleBottom,
    },

    logoWrapper: {
        alignItems: 'center',
        marginBottom: 10,
    },

    animation: {
        width: 190,
        height: 190,
    },

    title: {
        fontSize: 30,
        fontWeight: '700',
        color: COLORS.text,
        textAlign: 'center',
        letterSpacing: 0.3,
    },

    subtitle: {
        marginTop: 8,
        marginBottom: 28,
        fontSize: 15,
        lineHeight: 22,
        color: COLORS.muted,
        textAlign: 'center',
        paddingHorizontal: 8,
    },

    card: {
        backgroundColor: COLORS.surface,
        borderRadius: 24,
        padding: 18,
        borderWidth: 1,
        borderColor: COLORS.line,
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
    },

    inputWrapper: {
        backgroundColor: COLORS.inputBg,
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 8,
        marginBottom: 14,
        borderWidth: 1,
    },

    inputLabel: {
        fontSize: 12,
        color: COLORS.inputLabel,
        marginBottom: 6,
        fontWeight: '600',
        letterSpacing: 0.3,
    },

    input: {
        height: 28,
        fontSize: 16,
        color: COLORS.text,
        padding: 0,
    },

    button: {
        height: 56,
        marginTop: 6,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.accent,
        shadowColor: COLORS.accent,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 14,
        elevation: 6,
    },

    buttonDisabled: {
        opacity: 0.75,
    },

    buttonText: {
        color: COLORS.onPrimary,
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
});