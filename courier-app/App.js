import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Button, StyleSheet, Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TASK_NAME } from './locationTask';
import { WS_URL } from './constants';

const FOREGROUND_SERVICE = {
  notificationTitle: 'Смена активна',
  notificationBody: 'Идёт передача геолокации для заказов.',
};

export default function App() {
  const [courierId, setCourierId] = useState(null);
  const [status, setStatus] = useState('offline');
  const wsRef = useRef(null);

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem('courierId');
      if (saved) setCourierId(Number(saved));
      else {
        const id = Math.floor(Math.random() * 100000);
        await AsyncStorage.setItem('courierId', String(id));
        setCourierId(id);
      }
    })();
  }, []);

  useEffect(() => {
    if (!courierId) return;
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'hello', role: 'courier' }));
    };
    ws.onclose = () => {};
    return () => ws.close();
  }, [courierId]);

  const ensurePermissions = async () => {
    let fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== 'granted') {
      fg = await Location.requestForegroundPermissionsAsync();
      if (fg.status !== 'granted') throw new Error('Нужны права на геолокацию');
    }
    let bg = await Location.getBackgroundPermissionsAsync();
    if (bg.status !== 'granted') {
      bg = await Location.requestBackgroundPermissionsAsync();
      if (bg.status !== 'granted') throw new Error('Нужны права на геолокацию в фоне');
    }
  };

  const startShift = async () => {
    try {
      await ensurePermissions();

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('location', {
          name: 'Location',
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      }

      await AsyncStorage.setItem('onShift', '1');

      const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
      if (!isRegistered) {
        await Location.startLocationUpdatesAsync(TASK_NAME, {
          accuracy: Location.Accuracy.High,      // можно High/BestForNavigation, но батарея
          timeInterval: 5000,                         // не чаще чем раз в 5с
          distanceInterval: 10,                       // или раз в 10м
          pausesUpdatesAutomatically: false,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: FOREGROUND_SERVICE.notificationTitle,
            notificationBody: FOREGROUND_SERVICE.notificationBody,
            notificationColor: '#000000',
          },
        });
      }
      setStatus('online');
    } catch (e) {
      console.log(e);
      alert(e.message || 'Не удалось запустить смену');
    }
  };

  const stopShift = async () => {
    try {
      await AsyncStorage.removeItem('onShift');
      const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
      if (isRegistered) await Location.stopLocationUpdatesAsync(TASK_NAME);
      setStatus('offline');
    } catch (e) {
      console.log(e);
    }
  };

  return (
      <View style={styles.container}>
        <Text>Courier ID: {courierId ?? '...'}</Text>
        <Text>Status: {status}</Text>
        <View style={{ height: 8 }} />
        <Button title="Start Shift" onPress={startShift} />
        <View style={{ height: 8 }} />
        <Button title="Stop Shift" onPress={stopShift} />
      </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
