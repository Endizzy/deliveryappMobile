
import { useEffect, useRef, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WS_URL, ORIGIN } from './constants';
import { notifyNewOrder } from './notificationSound';

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
    raw.courierId       != null ? raw.courierId       :
    raw.courier_unit_id != null ? raw.courier_unit_id :
    null;

  const courierId = rawCourierId != null ? String(rawCourierId) : null;

  const status    = raw.status    ?? '';
  const orderType = raw.orderType ?? raw.order_type ?? 'active';

  const isFinished =
    status === 'cancelled' ||
    status === 'completed' ||
    orderType === 'completed';

  // outlet — используется для фильтрации по точке в OrdersListScreenModern.
  // currentOrdersRouter присылает это поле как pickupName (без outlet).
  // mobileOrdersRouter присылает оба поля: outlet + pickupName.
  const outlet = raw.outlet || raw.pickupName || '';

  return {
    ...raw,
    id,
    courierId,
    status,
    orderType,
    isFinished,
    outlet,       // ← гарантируем наличие поля для фильтрации
    pickupName: raw.pickupName || raw.outlet || '', // ← и обратно для совместимости
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export function useOrdersWebSocket({ unit, onAssignedOrder, onUnauthorized }) {
  const [availableOrders, setAvailableOrders] = useState([]);
  const [myOrders,        setMyOrders]        = useState([]);
  const [connected,       setConnected]       = useState(false);

  const wsRef     = useRef(null);
  const unitRef   = useRef(unit);
  unitRef.current = unit;

  // Колбэк «заказ назначен мне» держим в ref, чтобы handleMessage не пересоздавался
  const onAssignedOrderRef = useRef(onAssignedOrder);
  onAssignedOrderRef.current = onAssignedOrder;

  // Колбэк «токен недействителен» (401) — тоже в ref
  const onUnauthorizedRef = useRef(onUnauthorized);
  onUnauthorizedRef.current = onUnauthorized;

  // ── REST: загрузить свободные заказы ──────────────────────────────────
  const fetchAvailable = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      const res   = await fetch(`${ORIGIN}/api/mobile-orders?tab=active`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.status === 401) { onUnauthorizedRef.current?.(); return; }
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
      if (res.status === 401) { onUnauthorizedRef.current?.(); return; }
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
        // Свободный → добавить в доступные + оповещение (вибрация + звук)
        setAvailableOrders((prev) => mergeById(prev, [o]));
        notifyNewOrder();
      } else if (myUnitId && o.courierId === myUnitId) {
        // Сразу назначен мне (admin создал заказ с курьером) → звук + in-app баннер
        setMyOrders((prev) => mergeById(prev, [o]));
        notifyNewOrder();
        onAssignedOrderRef.current?.(o);
      }
      return;
    }

    // ─ Обновление заказа ─────────────────────────────────────────────
    if (msg.type === 'order_updated' && msg.order) {
      const o = normalizeOrder(msg.order);
      if (!o) return;

      const isMine   = myUnitId && o.courierId === myUnitId;
      const statusLc = (o.status || '').toLowerCase();

      // Завершён курьером → оставляем в «Мои» как выполненный (секция completed),
      // если это мой заказ; иначе убираем отовсюду.
      if (statusLc === 'completed') {
        setAvailableOrders((prev) => removeById(prev, o.id));
        if (isMine) {
          setMyOrders((prev) => {
            const marked = {
              ...o,
              completed: true,
              completedAt: o.completedAt || new Date().toISOString(),
            };
            const exists = prev.some((x) => String(x.id) === String(o.id));
            return exists
              ? prev.map((x) => (String(x.id) === String(o.id) ? { ...x, ...marked } : x))
              : [...prev, marked];
          });
        } else {
          setMyOrders((prev) => removeById(prev, o.id));
        }
        return;
      }

      // Прочие финальные статусы (отменён) → убрать отовсюду
      if (o.isFinished) {
        setAvailableOrders((prev) => removeById(prev, o.id));
        setMyOrders        ((prev) => removeById(prev, o.id));
        return;
      }

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
    if (res.status === 401) { onUnauthorizedRef.current?.(); throw new Error('unauthorized'); }
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
    if (res.status === 401) { onUnauthorizedRef.current?.(); throw new Error('unauthorized'); }
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Не удалось отказаться от заказа');
    return data;
  }, []);

  // ── Завершить заказ (Done) ─────────────────────────────────────────
  const completeOrder = useCallback(async (orderId) => {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    const res   = await fetch(`${ORIGIN}/api/mobile-orders/${orderId}/complete`, {
      method:  'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (res.status === 401) { onUnauthorizedRef.current?.(); throw new Error('unauthorized'); }
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Не удалось завершить заказ');
    return data;
  }, []);

  // ── В путь (enroute) ───────────────────────────────────────────────
  const enrouteOrder = useCallback(async (orderId) => {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    const res   = await fetch(`${ORIGIN}/api/mobile-orders/${orderId}/enroute`, {
      method:  'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (res.status === 401) { onUnauthorizedRef.current?.(); throw new Error('unauthorized'); }
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Не удалось обновить заказ');
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
    completeOrder,
    enrouteOrder,
  };
}