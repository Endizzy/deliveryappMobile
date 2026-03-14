import { useEffect, useRef, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WS_URL, ORIGIN } from './constants';

const TOKEN_KEY = 'authToken';

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

function mergeById(arr, incoming) {
  const map = new Map(arr.map((o) => [o.id, o]));
  incoming.forEach((o) => map.set(o.id, o));
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
}

function removeById(arr, id) {
  return arr.filter((o) => String(o.id) !== String(id));
}

function normalizeOrder(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const id = raw.id ?? raw.order_id;
  if (id === undefined || id === null) return null;

  // courierId — берём первое непустое значение из возможных вариантов
  const rawCourierId =
    raw.courierId      != null ? raw.courierId      :
    raw.courier_unit_id != null ? raw.courier_unit_id :
    null;

  const courierId = rawCourierId != null ? String(rawCourierId) : null;

  const status    = raw.status    ?? '';
  const orderType = raw.orderType ?? raw.order_type ?? 'active';

  const isFinished =
    status === 'cancelled' ||
    status === 'completed' ||
    orderType === 'completed';

  return {
    ...raw,
    id,
    courierId,
    status,
    orderType,
    isFinished,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export function useOrdersWebSocket({ unit }) {
  const [availableOrders, setAvailableOrders] = useState([]);
  const [myOrders,        setMyOrders]        = useState([]);
  const [connected,       setConnected]       = useState(false);

  const wsRef     = useRef(null);
  const unitRef   = useRef(unit);
  unitRef.current = unit;

  // ── REST: загрузить свободные заказы ──────────────────────────────────
  const fetchAvailable = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      const res   = await fetch(`${ORIGIN}/api/mobile-orders?tab=active`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.ok) setAvailableOrders(data.items || []);
    } catch (e) {
      console.warn('[WS] fetchAvailable', e);
    }
  }, []);

  // ── REST: загрузить мои заказы ─────────────────────────────────────────
  const fetchMy = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      const res   = await fetch(`${ORIGIN}/api/mobile-orders?tab=my`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.ok) setMyOrders(data.items || []);
    } catch (e) {
      console.warn('[WS] fetchMy', e);
    }
  }, []);

  // ── Обработка входящего WS-сообщения ──────────────────────────────────
  const handleMessage = useCallback((msg) => {

    // Пропускаем служебные/геолокационные сообщения
    if (
      msg.type === 'snapshot'              ||
      msg.type === 'orders_snapshot'       ||
      msg.type === 'location'              ||
      msg.type === 'remove'                ||
      msg.type === 'demo_orders_snapshot'  ||
      msg.type === 'demo_order_created'    ||
      msg.type === 'demo_order_updated'    ||
      msg.type === 'demo_order_deleted'
    ) return;

    const myUnitId = unitRef.current?.unitId
      ? String(unitRef.current.unitId)
      : null;

    // ─ Новый заказ ───────────────────────────────────────────────────
    if (msg.type === 'order_created' && msg.order) {
      const o = normalizeOrder(msg.order);
      if (!o || o.isFinished) return;

      if (!o.courierId) {
        // Свободный → добавить в доступные
        setAvailableOrders((prev) => mergeById(prev, [o]));
      } else if (myUnitId && o.courierId === myUnitId) {
        // Сразу назначен мне (admin создал заказ с курьером)
        setMyOrders((prev) => mergeById(prev, [o]));
      }
      // Назначен другому — нас не касается
      return;
    }

    // ─ Обновление заказа ─────────────────────────────────────────────
    if (msg.type === 'order_updated' && msg.order) {
      const o = normalizeOrder(msg.order);
      if (!o) return;

      // Завершён/отменён → убрать отовсюду
      if (o.isFinished) {
        setAvailableOrders((prev) => removeById(prev, o.id));
        setMyOrders        ((prev) => removeById(prev, o.id));
        return;
      }

      const isMine = myUnitId && o.courierId === myUnitId;
      const isFree = !o.courierId;

      if (isMine) {
        // Назначен мне → добавить/обновить в My, убрать из Available
        setMyOrders        ((prev) => mergeById(prev, [o]));
        setAvailableOrders ((prev) => removeById(prev, o.id));
      } else if (isFree) {
        // Освободился → добавить в Available, убрать из My
        setAvailableOrders ((prev) => mergeById(prev, [o]));
        setMyOrders        ((prev) => removeById(prev, o.id));
      } else {
        // Взят другим курьером → убрать из обоих
        setAvailableOrders ((prev) => removeById(prev, o.id));
        setMyOrders        ((prev) => removeById(prev, o.id));
      }
      return;
    }

    // ─ Удаление заказа ───────────────────────────────────────────────
    if (msg.type === 'order_deleted' && msg.orderId) {
      setAvailableOrders ((prev) => removeById(prev, msg.orderId));
      setMyOrders        ((prev) => removeById(prev, msg.orderId));
    }
  }, []);

  // ── WebSocket: подключение с авто-реконнектом ──────────────────────
  useEffect(() => {
    if (!unit) return;

    let ws;
    let reconnectTimer;
    let destroyed = false;

    const connect = async () => {
      try {
        const token      = await AsyncStorage.getItem(TOKEN_KEY);
        const jwtPayload = token ? decodeJwtPayload(token) : null;
        const companyId  = jwtPayload?.companyId ?? jwtPayload?.company_id ?? null;

        ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          setConnected(true);
          ws.send(JSON.stringify({
            type:            'hello',
            role:            'courier',
            courierId:       unit.unitId,
            courierNickname: unit.unitNickname ?? null,
            companyId,
          }));
        };

        ws.onmessage = (evt) => {
          try {
            const msg = JSON.parse(evt.data);
            handleMessage(msg);
          } catch {}
        };

        ws.onclose = () => {
          setConnected(false);
          if (!destroyed) reconnectTimer = setTimeout(connect, 2000);
        };

        ws.onerror = (e) => {
          console.warn('[WS] error', e?.message ?? e);
          try { ws.close(); } catch {}
        };
      } catch (e) {
        console.warn('[WS] connect error', e);
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

  // ── Взять заказ ────────────────────────────────────────────────────
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

  // ── Отказаться от заказа ───────────────────────────────────────────
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
    availableOrders,
    myOrders,
    setMyOrders,
    connected,
    fetchAvailable,
    fetchMy,
    assignOrder,
    releaseOrder,
  };
}