// LoginScreen.js
import React, { useState, useEffect, useRef } from 'react';
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
    const anim = useRef(new Animated.Value(0)).current;

    const borderColor = anim.interpolate({
        inputRange: [0, 1],
        outputRange: ['rgba(255,255,255,0.06)', '#2F8CFF'],
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
            { borderColor, shadowColor: '#2F8CFF', shadowOpacity, shadowRadius: 10, elevation: 4 },
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
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const keyboardPadding = useKeyboardPadding();

    const handleSubmit = async () => {
        if (!login || !password) {
            Alert.alert('Ошибка', 'Пожалуйста, введите логин и пароль');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('https://deliveryappserver-1.onrender.com/api/auth/courierlogin', {
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
                Alert.alert('Ошибка', data?.error || data?.message || 'Ошибка входа');
            } else {
                const token = data.token;
                if (!token) {
                    Alert.alert('Ошибка', 'Сервер не вернул токен');
                } else {
                    await AsyncStorage.setItem('authToken', token);
                    onLoginSuccess && onLoginSuccess();
                }
            }
        } catch (err) {
            console.error('Ошибка сети или парсинга:', err);
            Alert.alert('Ошибка сети', err.message || 'Попробуйте позже');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <StatusBar barStyle="light-content" backgroundColor="#010B13" />
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

                    <Text style={styles.title}>Авторизация</Text>
                    <Text style={styles.subtitle}>
                        Войдите в аккаунт курьера, чтобы продолжить
                    </Text>

                    <View style={styles.card}>
                        <FocusableInput
                            label="Логин"
                            placeholder="Email или телефон"
                            placeholderTextColor="#7E8A97"
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
                            label="Пароль"
                            placeholder="Введите пароль"
                            placeholderTextColor="#7E8A97"
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
                                {loading ? 'Выполняется...' : 'Войти'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </Animated.ScrollView>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#010B13',
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
        backgroundColor: 'rgba(0, 122, 255, 0.12)',
    },

    bgCircleBottom: {
        position: 'absolute',
        bottom: -100,
        left: -80,
        width: 260,
        height: 260,
        borderRadius: 130,
        backgroundColor: 'rgba(0, 180, 255, 0.08)',
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
        color: '#FFFFFF',
        textAlign: 'center',
        letterSpacing: 0.3,
    },

    subtitle: {
        marginTop: 8,
        marginBottom: 28,
        fontSize: 15,
        lineHeight: 22,
        color: '#8FA3B8',
        textAlign: 'center',
        paddingHorizontal: 8,
    },

    card: {
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderRadius: 24,
        padding: 18,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
    },

    inputWrapper: {
        backgroundColor: '#0B1722',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 8,
        marginBottom: 14,
        borderWidth: 1,
    },

    inputLabel: {
        fontSize: 12,
        color: '#7F93A8',
        marginBottom: 6,
        fontWeight: '600',
        letterSpacing: 0.3,
    },

    input: {
        height: 28,
        fontSize: 16,
        color: '#FFFFFF',
        padding: 0,
    },

    button: {
        height: 56,
        marginTop: 6,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#007AFF',
        shadowColor: '#007AFF',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 14,
        elevation: 6,
    },

    buttonDisabled: {
        opacity: 0.75,
    },

    buttonText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
});