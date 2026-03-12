// useOrdersWebSocket.js
// Хук управляет WebSocket-соединением и двумя списками заказов:
//   availableOrders — свободные заказы (вкладка ALL / ACTIVE)
//   myOrders        — заказы назначенные на текущего курьера (вкладка MY)
//
// Использование:
//   const { availableOrders, myOrders, connected, assignOrder, releaseOrder } =
//       useOrdersWebSocket({ unit });

import { useEffect, useRef, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WS_URL, ORIGIN } from './constants';

const TOKEN_KEY = 'authToken';

// ─── Утилиты ─────────────────────────────────────────────────────────────────

function decodeJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    let p = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = p.length % 4;
    if (pad) p += '='.repeat(4 - pad);
    const json =
      typeof atob === 'function'
        ? atob(p)
        : Buffer.from(p, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// Слить массив новых элементов в существующий по id, отсортировать по дате (новые сверху)
function mergeById(arr, incoming) {
  const map = new Map(arr.map((o) => [o.id, o]));
  incoming.forEach((o) => map.set(o.id, o));
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
}

// Убрать элемент по id
function removeById(arr, id) {
  return arr.filter((o) => String(o.id) !== String(id));
}

// ─────────────────────────────────────────────────────────────────────────────

export function useOrdersWebSocket({ unit }) {
  const [availableOrders, setAvailableOrders] = useState([]);
  const [myOrders,        setMyOrders]        = useState([]);
  const [connected,       setConnected]       = useState(false);

  const wsRef   = useRef(null);
  const unitRef = useRef(unit);
  unitRef.current = unit; // всегда актуальный unit без перепривязки эффектов

  // ── REST: загрузить свободные заказы ────────────────────────────────────
  const fetchAvailable = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      const res   = await fetch(`${ORIGIN}/api/mobile-orders?tab=active`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.ok) setAvailableOrders(data.items || []);
    } catch (e) {
      console.warn('[useOrdersWebSocket] fetchAvailable error', e);
    }
  }, []);

  // ── REST: загрузить мои заказы ───────────────────────────────────────────
  const fetchMy = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      const res   = await fetch(`${ORIGIN}/api/mobile-orders?tab=my`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.ok) setMyOrders(data.items || []);
    } catch (e) {
      console.warn('[useOrdersWebSocket] fetchMy error', e);
    }
  }, []);

  // ── Обработка входящего WS-сообщения ────────────────────────────────────
  const handleMessage = useCallback((msg) => {
    const myUnitId = unitRef.current?.unitId;

    // Игнорируем демо/снапшоты геолокаций
    if (
      msg.type === 'snapshot' ||
      msg.type === 'orders_snapshot' ||
      msg.type === 'location' ||
      msg.type === 'remove'
    ) return;

    // ─ Новый заказ ─────────────────────────────────────────────────────
    if (msg.type === 'order_created' && msg.order) {
      const o = msg.order;

      if (!o.courierId) {
        setAvailableOrders((prev) => mergeById(prev, [o]));
      } else if (myUnitId && String(o.courierId) === String(myUnitId)) {
        setMyOrders((prev) => mergeById(prev, [o]));
      }
      return;
    }

    // ─ Обновление заказа ───────────────────────────────────────────────
    if (msg.type === 'order_updated' && msg.order) {
      const o         = msg.order;
      const isMine    = myUnitId && String(o.courierId) === String(myUnitId);
      const isFree    = !o.courierId;
      const isFinished =
        o.status === 'cancelled' ||
        o.status === 'completed' ||
        o.orderType === 'completed';

      if (isFinished) {
        // Убрать отовсюду
        setAvailableOrders((prev) => removeById(prev, o.id));
        setMyOrders        ((prev) => removeById(prev, o.id));
        return;
      }

      if (isMine) {
        // Добавить/обновить в My, убрать из Available
        setMyOrders        ((prev) => mergeById(prev, [o]));
        setAvailableOrders ((prev) => removeById(prev, o.id));
      } else if (isFree) {
        // Заказ освободился (отказ) -> в Available, убрать из My
        setAvailableOrders ((prev) => mergeById(prev, [o]));
        setMyOrders        ((prev) => removeById(prev, o.id));
      } else {
        // Взял другой курьер -> убрать из Available
        setAvailableOrders ((prev) => removeById(prev, o.id));
        setMyOrders        ((prev) => removeById(prev, o.id));
      }
      return;
    }

    // ─ Удаление заказа ─────────────────────────────────────────────────
    if (msg.type === 'order_deleted' && msg.orderId) {
      setAvailableOrders ((prev) => removeById(prev, msg.orderId));
      setMyOrders        ((prev) => removeById(prev, msg.orderId));
    }
  }, []);

  // ── WebSocket: подключение с авто-реконнектом ────────────────────────────
  useEffect(() => {
    if (!unit) return;

    let ws;
    let reconnectTimer;
    let destroyed = false;

    const connect = async () => {
      try {
        const token     = await AsyncStorage.getItem(TOKEN_KEY);
        const jwtPayload = token ? decodeJwtPayload(token) : null;
        const companyId  = jwtPayload?.companyId ?? jwtPayload?.company_id ?? null;

        ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          setConnected(true);
          ws.send(
            JSON.stringify({
              type:            'hello',
              role:            'courier',
              courierId:       unit.unitId,
              courierNickname: unit.unitNickname ?? null,
              companyId,
            })
          );
        };

        ws.onmessage = (evt) => {
          try {
            const msg = JSON.parse(evt.data);
            handleMessage(msg);
          } catch {}
        };

        ws.onclose = () => {
          setConnected(false);
          if (!destroyed) {
            reconnectTimer = setTimeout(connect, 2000);
          }
        };

        ws.onerror = (e) => {
          console.warn('[useOrdersWebSocket] WS error', e?.message ?? e);
          try { ws.close(); } catch {}
        };
      } catch (e) {
        console.warn('[useOrdersWebSocket] connect error', e);
        if (!destroyed) reconnectTimer = setTimeout(connect, 2000);
      }
    };

    connect();

    fetchAvailable();
    fetchMy();

    return () => {
      destroyed = true;
      clearTimeout(reconnectTimer);
      try { ws?.close(); } catch {}
    };
  }, [unit, handleMessage, fetchAvailable, fetchMy]);

  // ── Взять заказ ─────────────────────────────────────────────────────────
  const assignOrder = useCallback(async (orderId) => {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    const res   = await fetch(`${ORIGIN}/api/mobile-orders/${orderId}/assign`, {
      method:  'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Не удалось взять заказ');
    return data;
  }, []);

  // ── Отказаться от заказа ────────────────────────────────────────────────
  const releaseOrder = useCallback(async (orderId) => {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    const res   = await fetch(`${ORIGIN}/api/mobile-orders/${orderId}/release`, {
      method:  'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Не удалось отказаться от заказа');
    return data;
  }, []);

  return {
    availableOrders,  // свободные заказы для вкладки ALL
    myOrders,         // MY orders
    setMyOrders,      // для ручного управления (например, отметить выполненным)
    connected,        // true если WS соединение активно, proverka
    fetchAvailable,   // принудительно перезагрузить свободные
    fetchMy,          // принудительно перезагрузить мои
    assignOrder,      // (orderId) => Promise — взять заказ
    releaseOrder,     // (orderId) => Promise — отказаться от заказа
  };
}