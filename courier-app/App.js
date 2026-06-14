import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CourierShiftScreen from './CourierShiftScreen';
import LoginScreen from './LoginScreen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './theme';
import { LanguageProvider } from './i18n';

// Истёк ли срок действия JWT (по полю exp). Нет exp → не можем судить локально.
function isTokenExpired(token) {
  try {
    const part = token.split('.')[1];
    if (!part) return false;
    let p = part.replace(/-/g, '+').replace(/_/g, '/');
    const pad = p.length % 4;
    if (pad) p += '='.repeat(4 - pad);
    const json =
      typeof globalThis.atob === 'function'
        ? globalThis.atob(p)
        : Buffer.from(p, 'base64').toString('utf8');
    const payload = JSON.parse(json);
    if (!payload?.exp) return false;
    return Date.now() >= payload.exp * 1000 - 5000;
  } catch {
    return false;
  }
}

export default function App() {
  const [isAuth, setIsAuth] = useState(null); // null — состояние загрузки

  useEffect(() => {
    const checkAuth = async () => {
      const token = await AsyncStorage.getItem('authToken');
      if (!token || isTokenExpired(token)) {
        // нет токена или он истёк → на экран авторизации
        try { await AsyncStorage.removeItem('authToken'); } catch {}
        setIsAuth(false);
        return;
      }
      setIsAuth(true);
    };
    checkAuth();
  }, []);

  if (isAuth === null) {
    return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator />
        </View>
    );
  }

  return (
      // <- ThemeProvider и SafeAreaProvider должны быть НАД всем UI
      <LanguageProvider>
        <ThemeProvider>
          <SafeAreaProvider>
            {!isAuth ? (
                <LoginScreen onLoginSuccess={() => setIsAuth(true)} />
            ) : (
                <CourierShiftScreen onLogout={() => setIsAuth(false)} />
            )}
          </SafeAreaProvider>
        </ThemeProvider>
      </LanguageProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
