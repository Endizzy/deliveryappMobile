// LoginScreen.js
import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './config.js';

export default function LoginScreen({ onLoginSuccess }) {
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!login || !password) {
            Alert.alert('Ошибка', 'Пожалуйста, введите логин и пароль');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`https://deliveryappserver-1.onrender.com/api/auth/courierlogin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    unit_email: login,
                    unit_password: password,
                }),
            });

            console.log('HTTP', res.status, res.headers.get('content-type'));

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
                const message = data?.error || data?.message || 'Ошибка входа';
                Alert.alert('Ошибка', message);
            } else {
                const token = data.token;
                if (!token) {
                    Alert.alert('Ошибка', 'Сервер не вернул токен');
                } else {
                    // Сохраняем токен под ключом authToken (согласовано с app.js)
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
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.container}
        >
            <Text style={styles.title}>Авторизация</Text>

            <TextInput
                style={styles.input}
                placeholder="Email или телефон"
                value={login}
                onChangeText={setLogin}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="username"
                returnKeyType="next"
                accessible={true}
                accessibilityLabel="Поле для ввода логина"
            />

            <TextInput
                style={styles.input}
                placeholder="Пароль"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType="password"
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                accessible={true}
                accessibilityLabel="Поле для ввода пароля"
            />

            <TouchableOpacity
                style={[styles.button, loading && { opacity: 0.7 }]}
                onPress={handleSubmit}
                accessibilityRole="button"
                accessibilityLabel="Кнопка войти"
                disabled={loading}
            >
                <Text style={styles.buttonText}>{loading ? 'Выполняется...' : 'Войти'}</Text>
            </TouchableOpacity>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
        backgroundColor: '#f5f5f5',
    },
    title: {
        fontSize: 28,
        fontWeight: '600',
        marginBottom: 32,
        alignSelf: 'center',
        color: '#333',
    },
    input: {
        height: 48,
        backgroundColor: '#fff',
        borderRadius: 8,
        paddingHorizontal: 16,
        fontSize: 16,
        marginBottom: 16,
        borderColor: '#ccc',
        borderWidth: 1,
    },
    button: {
        height: 48,
        backgroundColor: '#007AFF',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
        shadowColor: '#007AFF',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 4,
        elevation: 3,
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
});
