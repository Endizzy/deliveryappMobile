import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CourierShiftScreen from './CourierShiftScreen';
import LoginScreen from './LoginScreen';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function App() {
  const [isAuth, setIsAuth] = useState(null); // null — состояние загрузки

  useEffect(() => {
    const checkAuth = async () => {
      const token = await AsyncStorage.getItem('authToken');
      setIsAuth(!!token);
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
      // <- SafeAreaProvider должен быть НАД всем UI
      <SafeAreaProvider>
        {!isAuth ? (
            <LoginScreen onLoginSuccess={() => setIsAuth(true)} />
        ) : (
            <CourierShiftScreen onLogout={() => setIsAuth(false)} />
        )}
      </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
