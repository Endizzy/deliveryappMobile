// ─────────────────────────────────────────────────────────────────────────────
// offlineQueue — персистентная очередь действий курьера.
//
// Проблема, которую решает: курьер в лифте/подвале нажимает «Готово», UI
// оптимистично помечает заказ выполненным, запрос падает с «Network request
// failed» — и действие исчезает бесследно. Через минуту поллинг возвращает
// заказ обратно, курьер уверен что закрыл его, диспетчер видит открытым.
//
// Теперь действие сначала попадает в очередь в AsyncStorage (переживает
// перезапуск приложения), а затем отправляется — сразу, если связь есть,
// либо при первой возможности.
//
// Ключевые свойства:
//   • строгий FIFO и отправка по одной операции: enroute не обгонит assign;
//   • токен берётся в момент отправки, а не сохраняется в очереди
//     (иначе после перелогина операции ушли бы со старым токеном);
//   • ответы 403/404/409 означают «операция больше не актуальна» — заказ забрал
//     другой курьер или его отменили; такие удаляем и сообщаем UI;
//   • сетевые ошибки и 5xx оставляют операцию в очереди для повтора.
// ─────────────────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ORIGIN } from './constants';

const QUEUE_KEY = 'offlineOpsQueue';
const TOKEN_KEY = 'authToken';

// Операции старше этого срока применять уже вредно — смена давно закончилась
export const OP_TTL_MS = 12 * 60 * 60 * 1000;

const BACKOFF_STEPS_MS = [3000, 6000, 12000, 30000];

export const OP_TYPES = ['assign', 'release', 'enroute', 'complete'];

// ── Состояние модуля ────────────────────────────────────────────────────────
let queue = [];             // кэш в памяти; источник правды — AsyncStorage
let loaded = false;
let flushing = false;       // мьютекс: таймер и AppState не должны запускать flush параллельно
let retryTimer = null;
let backoffIndex = 0;
let lastNetworkError = false;

const listeners = new Set();

// Запись в AsyncStorage сериализуется цепочкой промисов: без этого два быстрых
// нажатия могут перезаписать очередь друг друга и потерять операцию.
let writeChain = Promise.resolve();

function persist() {
  const snapshot = queue.slice();
  writeChain = writeChain
    .then(() => AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(snapshot)))
    .catch((e) => console.warn('[queue] persist failed', e?.message ?? e));
  return writeChain;
}

function emit(event) {
  for (const fn of listeners) {
    try { fn(event); } catch (e) { console.warn('[queue] listener', e); }
  }
}

function notifyChange() {
  emit({ type: 'change', pending: queue.length, offline: lastNetworkError, flushing });
}

/** Подписка на события очереди: change | conflict | unauthorized | synced */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getPendingCount() {
  return queue.length;
}

export function isOffline() {
  return lastNetworkError;
}

/** Незавершённые операции по заказу (для наложения на данные сервера). */
export function getPendingOps() {
  return queue.slice();
}

// ── Загрузка и очистка ──────────────────────────────────────────────────────

export async function loadQueue() {
  if (loaded) return queue;
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    queue = Array.isArray(parsed) ? parsed.filter(isValidOp) : [];
    dropExpired();
  } catch (e) {
    console.warn('[queue] load failed', e?.message ?? e);
    queue = [];
  }
  loaded = true;
  notifyChange();
  return queue;
}

function isValidOp(op) {
  return (
    op && typeof op === 'object' &&
    OP_TYPES.includes(op.type) &&
    op.orderId != null &&
    Number.isFinite(Number(op.createdAt))
  );
}

function dropExpired() {
  const now = Date.now();
  const before = queue.length;
  queue = queue.filter((op) => now - Number(op.createdAt) < OP_TTL_MS);
  if (queue.length !== before) persist();
}

/** Полная очистка — вызывается при выходе из аккаунта. */
export async function clearQueue() {
  queue = [];
  backoffIndex = 0;
  lastNetworkError = false;
  clearTimeout(retryTimer);
  await persist();
  notifyChange();
}

// ── Постановка в очередь ────────────────────────────────────────────────────

/**
 * Поставить действие в очередь и попытаться отправить немедленно.
 * @returns {Promise<{sent:boolean, queued:boolean, conflict?:string}>}
 */
export async function enqueue(type, orderId) {
  if (!OP_TYPES.includes(type)) throw new Error(`unknown op type: ${type}`);
  await loadQueue();

  const op = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    orderId,
    createdAt: Date.now(),
    attempts: 0,
    lastError: null,
  };

  queue.push(op);
  await persist();
  notifyChange();

  const result = await flush();
  // Операция ушла, если её больше нет в очереди
  const stillQueued = queue.some((q) => q.id === op.id);
  return {
    sent: !stillQueued && !result.conflicts.some((c) => c.op.id === op.id),
    queued: stillQueued,
    conflict: result.conflicts.find((c) => c.op.id === op.id)?.reason ?? null,
  };
}

// ── Отправка ────────────────────────────────────────────────────────────────

const ENDPOINT = {
  assign:   (id) => `${ORIGIN}/api/mobile-orders/${id}/assign`,
  release:  (id) => `${ORIGIN}/api/mobile-orders/${id}/release`,
  enroute:  (id) => `${ORIGIN}/api/mobile-orders/${id}/enroute`,
  complete: (id) => `${ORIGIN}/api/mobile-orders/${id}/complete`,
};

/**
 * Отправляет одну операцию.
 * @returns {'ok'|'conflict'|'unauthorized'|'retry'}
 */
async function sendOne(op) {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (!token) return 'unauthorized';

  let res;
  try {
    res = await fetch(ENDPOINT[op.type](op.orderId), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (e) {
    // нет сети / таймаут — операция остаётся в очереди
    op.lastError = e?.message ?? 'network error';
    return 'retry';
  }

  if (res.status === 401) return 'unauthorized';

  // 403/404/409 — заказ забрал другой курьер, отменён или уже закрыт.
  // Повторять бессмысленно: убираем из очереди и сообщаем пользователю.
  // Исключение: повторный release после успеха тоже даёт 403 — для UI это
  // не ошибка, поэтому помечаем отдельным признаком.
  if (res.status === 403 || res.status === 404 || res.status === 409) {
    let reason = null;
    try {
      const body = await res.json();
      reason = body?.error ?? null;
    } catch { /* тело может быть пустым */ }
    op.lastError = reason;
    return 'conflict';
  }

  if (!res.ok) {
    // 5xx и прочее — сервер жив, но не смог; пробуем позже
    op.lastError = `HTTP ${res.status}`;
    return 'retry';
  }

  return 'ok';
}

function scheduleRetry() {
  clearTimeout(retryTimer);
  const delay = BACKOFF_STEPS_MS[Math.min(backoffIndex, BACKOFF_STEPS_MS.length - 1)];
  backoffIndex += 1;
  retryTimer = setTimeout(() => { flush(); }, delay);
}

/**
 * Последовательно отправляет очередь. Безопасно вызывать из нескольких мест —
 * параллельные вызовы отсекаются мьютексом.
 */
export async function flush() {
  await loadQueue();
  if (flushing) return { sent: 0, conflicts: [] };
  if (queue.length === 0) {
    lastNetworkError = false;
    return { sent: 0, conflicts: [] };
  }

  flushing = true;
  notifyChange();

  let sent = 0;
  const conflicts = [];
  let unauthorized = false;

  try {
    dropExpired();

    // Строго по одной, в порядке добавления
    while (queue.length > 0) {
      const op = queue[0];
      op.attempts += 1;

      const outcome = await sendOne(op);

      if (outcome === 'ok') {
        queue.shift();
        await persist();
        sent += 1;
        lastNetworkError = false;
        backoffIndex = 0;
        notifyChange();
        continue;
      }

      if (outcome === 'conflict') {
        queue.shift();
        await persist();
        conflicts.push({ op, reason: op.lastError });
        lastNetworkError = false;
        backoffIndex = 0;
        notifyChange();
        continue;
      }

      if (outcome === 'unauthorized') {
        unauthorized = true;
        break; // очередь не трогаем: после перелогина сможет уйти
      }

      // retry — связи нет, дальше по очереди идти нельзя (нарушим порядок)
      lastNetworkError = true;
      break;
    }
  } finally {
    flushing = false;
    notifyChange();
  }

  if (conflicts.length) {
    for (const c of conflicts) emit({ type: 'conflict', op: c.op, reason: c.reason });
  }
  if (sent > 0 && queue.length === 0) emit({ type: 'synced', count: sent });
  if (unauthorized) emit({ type: 'unauthorized' });
  if (queue.length > 0 && !unauthorized) scheduleRetry();

  return { sent, conflicts };
}

// ── Наложение незавершённых операций на данные сервера ──────────────────────

/**
 * Сервер ещё не знает об операциях из очереди, поэтому его ответ «откатывает»
 * действия курьера и списки мигают. Здесь накладываем намерения курьера
 * поверх серверных данных.
 *
 * Чистая функция — не читает состояние модуля, кроме списка операций.
 */
export function applyPending({ available = [], my = [], myUnitId = null, ops = null }) {
  const pending = ops ?? queue;
  if (!pending.length) return { available, my };

  let nextAvailable = available.slice();
  let nextMy = my.slice();

  const sameId = (a, b) => String(a) === String(b);
  const findAndRemove = (list, orderId) => {
    const idx = list.findIndex((o) => sameId(o.id ?? o.order_id, orderId));
    if (idx === -1) return [null, list];
    const item = list[idx];
    return [item, [...list.slice(0, idx), ...list.slice(idx + 1)]];
  };
  const upsert = (list, item) => {
    const idx = list.findIndex((o) => sameId(o.id ?? o.order_id, item.id ?? item.order_id));
    if (idx === -1) return [...list, item];
    const copy = list.slice();
    copy[idx] = { ...copy[idx], ...item };
    return copy;
  };

  for (const op of pending) {
    switch (op.type) {
      case 'assign': {
        const [item, rest] = findAndRemove(nextAvailable, op.orderId);
        nextAvailable = rest;
        const source = item ?? nextMy.find((o) => sameId(o.id ?? o.order_id, op.orderId));
        if (source) {
          nextMy = upsert(nextMy, {
            ...source,
            courierId: myUnitId != null ? String(myUnitId) : source.courierId,
          });
        }
        break;
      }
      case 'release': {
        const [item, rest] = findAndRemove(nextMy, op.orderId);
        nextMy = rest;
        if (item) {
          nextAvailable = upsert(nextAvailable, { ...item, courierId: null, status: 'new' });
        }
        break;
      }
      case 'enroute': {
        nextMy = nextMy.map((o) =>
          sameId(o.id ?? o.order_id, op.orderId) ? { ...o, status: 'enroute' } : o
        );
        break;
      }
      case 'complete': {
        nextAvailable = nextAvailable.filter((o) => !sameId(o.id ?? o.order_id, op.orderId));
        nextMy = nextMy.map((o) =>
          sameId(o.id ?? o.order_id, op.orderId)
            ? { ...o, status: 'completed', completed: true, completedAt: o.completedAt || new Date(op.createdAt).toISOString() }
            : o
        );
        break;
      }
      default:
        break;
    }
  }

  return { available: nextAvailable, my: nextMy };
}
