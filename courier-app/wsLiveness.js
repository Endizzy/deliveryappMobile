// ─────────────────────────────────────────────────────────────────────────────
// wsLiveness — единственный источник правды о том, жив ли WebSocket.
//
// Зачем отдельный модуль, а не поле в хуке:
//   1) ws.readyState на мобильных врать. Курьер-клиент после hello ничего не
//      пишет в сокет (геолокация уходит по REST), поэтому при обрыве без FIN
//      (Doze, смена вышки, NAT-таймаут) состояние остаётся OPEN бесконечно —
//      и приложение считает мёртвый канал рабочим.
//   2) К этому знанию нужен доступ из setNotificationHandler в
//      pushNotifications.js, который живёт вне React-дерева. Push обязан
//      прозвучать, если WS не подтверждён живым, — иначе курьер не узнает
//      о заказе вообще.
//
// Живость определяется фактом получения данных: любое входящее сообщение
// (в том числе pong на наш ping) двигает lastMessageAt. Тишина дольше
// STALE_MS = канал мёртв, что бы ни говорил readyState.
// ─────────────────────────────────────────────────────────────────────────────

export const PING_INTERVAL_MS = 25_000; // < NAT/Cloudflare-таймаутов
export const STALE_MS         = 60_000; // 2 пропущенных ping+pong подряд

let lastMessageAt = 0;
let helloAckAt    = 0;

/** Любое входящее сообщение — доказательство, что канал живой. */
export function markMessage() {
  lastMessageAt = Date.now();
}

/** hello_ok от сервера: соединение установлено и авторизовано. */
export function markHelloAck() {
  helloAckAt = Date.now();
  lastMessageAt = helloAckAt;
}

/** Сокет закрыт/пересоздаётся — живость сбрасываем. */
export function markDisconnected() {
  lastMessageAt = 0;
  helloAckAt = 0;
}

/** Сколько мс назад приходили данные (Infinity — не приходили вовсе). */
export function silenceMs() {
  return lastMessageAt ? Date.now() - lastMessageAt : Infinity;
}

/**
 * Канал подтверждён живым: hello прошёл и данные приходили недавно.
 * Именно это, а не readyState, должно решать «нужен ли реконнект»
 * и «показывать ли push при открытом приложении».
 */
export function isLive() {
  return helloAckAt > 0 && silenceMs() < STALE_MS;
}

// ── Дедупликация оповещений о заказе ────────────────────────────────────────
// Один и тот же заказ может прийти двумя каналами (WS order_created и push).
// Тот, кто просигналил первым, помечает заказ здесь; второй молчит.

const notified = new Map(); // orderId -> timestamp
const NOTIFY_TTL_MS = 5 * 60 * 1000;

/**
 * Пометить заказ озвученным. Возвращает true, если сигнал нужно подать
 * (по этому заказу ещё не сигналили), и false, если это дубль.
 */
export function claimOrderNotification(orderId) {
  if (orderId == null) return true; // не смогли опознать — лучше просигналить
  const key = String(orderId);
  const now = Date.now();

  for (const [k, ts] of notified) {
    if (now - ts > NOTIFY_TTL_MS) notified.delete(k);
  }

  if (notified.has(key)) return false;
  notified.set(key, now);
  return true;
}
