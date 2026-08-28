
import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WS_URL, ORIGIN } from './constants';
import { notifyNewOrder } from './notificationSound';
import {
  PING_INTERVAL_MS,
  STALE_MS,
  markMessage,
  markHelloAck,
  markDisconnected,
  isLive,
  claimOrderNotification,
} from './wsLiveness';

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
    outlet,       // гарантируем наличие поля для фильтрации
    pickupName: raw.pickupName || raw.outlet || '', // и обратно для совместимости
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
    // Любое сообщение — доказательство живости канала (в т.ч. pong)
    markMessage();
    if (msg.type === 'hello_ok') { markHelloAck(); return; }
    if (msg.type === 'pong') return;

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
        // Свободный → добавить в доступные + оповещение (вибрация + звук).
        // claimOrderNotification — чтобы push по этому же заказу промолчал.
        setAvailableOrders((prev) => mergeById(prev, [o]));
        if (claimOrderNotification(o.id)) notifyNewOrder();
      } else if (myUnitId && o.courierId === myUnitId) {
        // Сразу назначен мне (admin создал заказ с курьером) → звук + in-app баннер
        setMyOrders((prev) => mergeById(prev, [o]));
        if (claimOrderNotification(o.id)) notifyNewOrder();
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

  // ── WebSocket: подключение, heartbeat, авто-реконнект ──────────────
  //
  // Живость канала определяется НЕ по ws.readyState (на мобильных он врёт:
  // при обрыве без FIN сокет вечно числится OPEN), а по факту получения
  // данных. Клиент раз в PING_INTERVAL_MS шлёт {type:'ping'} и ждёт ответ;
  // тишина дольше STALE_MS = канал мёртв → принудительный реконнект.
  //
  // Гарантия консистентности: на КАЖДЫЙ (ре)коннект — полный REST-ресинк.
  useEffect(() => {
    if (!unit) return;

    let ws;
    let reconnectTimer;
    let heartbeatTimer;
    let connectTimeout;
    let attempts  = 0;
    let destroyed = false;

    const clearTimers = () => {
      clearTimeout(reconnectTimer);
      clearInterval(heartbeatTimer);
      clearTimeout(connectTimeout);
    };

    const scheduleReconnect = () => {
      if (destroyed) return;
      clearTimeout(reconnectTimer);
      clearInterval(heartbeatTimer);
      // backoff с потолком 15 c + джиттер, чтобы не долбить сервер синхронно
      const delay =
        Math.min(15000, 1000 * 2 ** Math.min(attempts, 4)) +
        Math.floor(Math.random() * 300);
      attempts += 1;
      reconnectTimer = setTimeout(connect, delay);
    };

    // Разрываем текущий сокет и немедленно переподключаемся.
    // Нужен именно close(): сокет может числиться OPEN, будучи мёртвым.
    const forceReconnect = (reason) => {
      if (destroyed) return;
      console.warn('[WS] forced reconnect:', reason);
      markDisconnected();
      setConnected(false);
      const sock = wsRef.current;
      wsRef.current = null;
      try { sock?.close(); } catch {}
      clearTimers();
      attempts = 0;
      connect();
    };

    const connect = async () => {
      try {
        if (destroyed) return;
        // Защита от параллельных подключений. Проверяем не только readyState,
        // но и живость: «открытый», но молчащий сокет пересоздаём.
        const cur = wsRef.current;
        if (cur && cur.readyState <= 1 && isLive()) return;

        const token = await AsyncStorage.getItem(TOKEN_KEY);
        if (!token) { onUnauthorizedRef.current?.(); return; }
        const jwtPayload = decodeJwtPayload(token);
        const companyId  = jwtPayload?.companyId ?? jwtPayload?.company_id ?? null;

        markDisconnected();
        ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        // Подключение может зависнуть в CONNECTING без onopen/onclose —
        // тогда без таймаута реконнект не наступит никогда.
        clearTimeout(connectTimeout);
        connectTimeout = setTimeout(() => {
          if (destroyed) return;
          if (ws.readyState === 0) {
            console.warn('[WS] connect timeout');
            try { ws.close(); } catch {}
            scheduleReconnect();
          }
        }, 15000);

        ws.onopen = () => {
          attempts = 0;
          clearTimeout(connectTimeout);
          setConnected(true);
          markMessage(); // соединение открыто — считаем канал свежим
          ws.send(JSON.stringify({
            type:            'hello',
            role:            'courier',
            token,           // ← сервер авторизует hello по JWT
            courierId:       unit.unitId,
            courierNickname: unit.unitNickname ?? null,
            companyId,
          }));
          // Ресинк на каждый (ре)коннект — ключ к консистентности
          fetchAvailable();
          fetchMy();

          // Heartbeat: ping держит канал прогретым (NAT/Cloudflare), а его
          // pong — единственное подтверждение живости, видимое из JS.
          clearInterval(heartbeatTimer);
          heartbeatTimer = setInterval(() => {
            if (destroyed) return;
            if (!isLive()) {           // ответов нет дольше STALE_MS
              forceReconnect('stale (no pong)');
              return;
            }
            try {
              ws.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
            } catch (e) {
              forceReconnect('ping failed');
            }
          }, PING_INTERVAL_MS);
        };

        ws.onmessage = (evt) => {
          try {
            const msg = JSON.parse(evt.data);
            handleMessage(msg);
          } catch {}
        };

        ws.onclose = (e) => {
          clearInterval(heartbeatTimer);
          clearTimeout(connectTimeout);
          markDisconnected();
          setConnected(false);
          if (e?.code === 4401) {
            // токен невалиден/просрочен — реконнект бессмыслен, нужен перелогин
            onUnauthorizedRef.current?.();
            return;
          }
          scheduleReconnect();
        };

        ws.onerror = (e) => {
          console.warn('[WS] error', e?.message ?? e);
          try { ws.close(); } catch {}
        };
      } catch (e) {
        console.warn('[WS] connect error', e);
        scheduleReconnect();
      }
    };

    connect();

    // Возврат в foreground: в фоне ОС морозит таймеры, поэтому проверяем
    // живость сразу — состояние по REST, и сокет пересоздаём, если он молчит.
    const appStateSub = AppState.addEventListener('change', (s) => {
      if (s !== 'active' || destroyed) return;
      fetchAvailable();
      fetchMy();
      const sock = wsRef.current;
      if (!sock || sock.readyState > 1) {
        attempts = 0;
        clearTimeout(reconnectTimer);
        connect();
      } else if (!isLive()) {
        // сокет «открыт», но данных не было — типичный half-open после Doze
        forceReconnect('not live after foreground');
      }
    });

    return () => {
      destroyed = true;
      clearTimers();
      markDisconnected();
      try { appStateSub.remove(); } catch {}
      try { ws?.close(); } catch {}
    };
  }, [unit, handleMessage, fetchAvailable, fetchMy]);

  // ── Страховка поллингом ────────────────────────────────────────────
  // Второй рубеж на случай, если WS всё же не доставил событие: канал может
  // быть «живым» по pong, но пропустить рассылку (рестарт сервера между
  // heartbeat-ами, потеря пакета). Интервал адаптивный, чтобы не жечь
  // батарею курьера за смену:
  //   • WS подтверждён живым → сверка раз в 60 c;
  //   • тишина в канале      → опрос каждые 15 c, пока связь не вернётся.
  // В фоне поллинг не нужен: там за оповещение отвечает push, а при возврате
  // в foreground AppState-обработчик и так делает полный ресинк.
  useEffect(() => {
    if (!unit) return;

    let timer;
    let stopped = false;

    const tick = () => {
      if (stopped) return;
      if (AppState.currentState === 'active') {
        fetchAvailable();
        fetchMy();
      }
      schedule();
    };

    const schedule = () => {
      if (stopped) return;
      clearTimeout(timer);
      timer = setTimeout(tick, isLive() ? 60000 : 15000);
    };

    schedule();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [unit, fetchAvailable, fetchMy]);

  // ── Взять заказ ────────────────────────────────────────────────────
  // Сервер подтвердил — значит заказ мой, независимо от того, дошло ли
  // WS-эхо. Переносим его в «Мои» сразу: иначе при мёртвом канале заказ
  // продолжает висеть в «Все» и курьер думает, что не взял его.
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

    const myUnitId = unitRef.current?.unitId ?? null;
    setAvailableOrders((prev) => {
      const taken = prev.find((o) => String(o.id) === String(orderId));
      if (taken && myUnitId != null) {
        const mine = normalizeOrder({ ...taken, courierId: String(myUnitId) });
        if (mine) setMyOrders((cur) => mergeById(cur, [mine]));
      }
      return removeById(prev, orderId);
    });
    // сверка с сервером (статус, назначения других курьеров)
    fetchMy();
    return data;
  }, [fetchMy]);

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

    // Симметрично assign: не ждём эха, сразу возвращаем заказ в «Все»
    setMyOrders((prev) => {
      const released = prev.find((o) => String(o.id) === String(orderId));
      if (released) {
        const free = normalizeOrder({ ...released, courierId: null, courier_unit_id: null });
        if (free && !free.isFinished) setAvailableOrders((cur) => mergeById(cur, [free]));
      }
      return removeById(prev, orderId);
    });
    fetchAvailable();
    return data;
  }, [fetchAvailable]);

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