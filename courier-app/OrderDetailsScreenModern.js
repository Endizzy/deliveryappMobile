import React, { useMemo, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Platform,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { ORIGIN } from './constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Phone,
  PlusCircle,
  Clock,
  CreditCard,
  Banknote,
  MapPin,
  User,
  ClipboardList,
} from 'lucide-react-native';

// Получение JWT токена из AsyncStorage
async function getAuthToken() {
  try {
    return await AsyncStorage.getItem('authToken');
  } catch {
    return null;
  }
}

function safeText(v, fallback = '—') {
  if (v === null || v === undefined) return fallback;
  const s = String(v).trim();
  return s.length ? s : fallback;
}

function formatMoney(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return safeText(v);
  return n.toFixed(2);
}

function parseItems(itemsValue) {
  try {
    if (!itemsValue) return [];
    if (Array.isArray(itemsValue)) return itemsValue;

    // иногда из базы приходит JSON строкой
    const s = String(itemsValue);
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function paymentLabel(method) {
  const m = (method || '').toLowerCase();
  if (m.includes('cash') || m.includes('нал')) return 'Наличные';
  if (m.includes('card') || m.includes('карт')) return 'Карта';
  return safeText(method);
}

function statusLabel(status) {
  const s = (status || '').toLowerCase();
  if (s === 'new') return { text: 'Новый', tone: 'info' };
  if (s === 'ready') return { text: 'Готов', tone: 'success' };
  if (s === 'active') return { text: 'В работе', tone: 'info' };
  if (s === 'cancelled') return { text: 'Отменён', tone: 'danger' };
  return { text: safeText(status), tone: 'neutral' };
}

function toneStyles(tone) {
  switch (tone) {
    case 'success':
      return { bg: '#eafaf0', bd: 'rgba(22,163,74,0.18)', fg: '#16a34a' };
    case 'danger':
      return { bg: '#fff1f2', bd: 'rgba(225,29,72,0.18)', fg: '#e11d48' };
    case 'info':
      return { bg: '#eaf2ff', bd: 'rgba(0,122,255,0.18)', fg: '#007AFF' };
    default:
      return { bg: '#f1f5f9', bd: 'rgba(148,163,184,0.25)', fg: '#64748b' };
  }
}

function buildFullAddress(o) {
  // Строим адрес только из отдельных полей (без кода домофона)
  const street = safeText(o.addressStreet, '');
  const house = o.addressHouse ? `д. ${o.addressHouse}` : '';
  const building = o.addressBuilding ? `к. ${o.addressBuilding}` : '';

  const parts = [street, house, building].filter(Boolean);
  if (parts.length) return parts.join(', ');

  // fallback на строковый address, если отдельных полей нет
  return safeText(o.address);
}

function buildAptLine(o) {
  return [
    o.addressApartment ? `кв. ${o.addressApartment}` : '',
    o.addressFloor ? `этаж ${o.addressFloor}` : '',
  ]
    .filter(Boolean)
    .join(', ');
}

export default function OrderDetailsScreenModern({
  order,
  outletName = '—',
  onBack,
  onTake,
  onCall,
}) {
  // Если передан только order.id, нужно загрузить детали
  // ВАЖНО: сервер отдаёт items (camelCase), а не items_json
  const [details, setDetails] = useState(order && (order.items || order.items_json) ? order : null);
  const [loading, setLoading] = useState(!(order?.items || order?.items_json));
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;

    async function fetchDetails() {
      if (!order?.id) return;

      // если детали уже есть — не грузим
      if (order?.items || order?.items_json) return;

      setLoading(true);
      setError(null);

      try {
        const token = await getAuthToken();
        const res = await fetch(`${ORIGIN}/api/mobile-orders/${order.id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        const data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Ошибка загрузки заказа');

        if (!ignore) setDetails(data.item);
      } catch (e) {
        if (!ignore) setError(e?.message || 'Ошибка сети');
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    fetchDetails();
    return () => {
      ignore = true;
    };
  }, [order]);

  const o = details || order || {};

  // items сервер отдаёт как "items" (array), но на всякий оставим fallback
  const items = useMemo(() => parseItems(o.items ?? o.items_json), [o.items, o.items_json]);

  const st = statusLabel(o.status);
  const stTone = toneStyles(st.tone);

  const titleNumber =
    o.orderSeq ? `№${o.orderSeq}` :
    o.orderNo ? String(o.orderNo) :
    o.id ? `#${o.id}` : '—';

  const createdAt = safeText(o.createdAt);
  const deliverAt = safeText(o.scheduledAt);

  const customerName = safeText(o.customer);
  const phone = safeText(o.phone, '');
  const canCall = phone.length > 0 && phone !== '—';

  const fullAddress = buildFullAddress(o);
  const aptLine = buildAptLine(o);

  const handleCall = () => {
    if (!canCall) return;
    if (onCall) return onCall(phone, o);
    Linking.openURL(`tel:${phone}`).catch(() => {});
  };

  const subtotal = formatMoney(o.amountSubtotal);
  const discount = formatMoney(o.amountDiscount);
  const total = formatMoney(o.amountTotal);

  const notes = safeText(o.notes);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="dark-content" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={{ marginTop: 12, color: COLORS.muted }}>Загрузка заказа...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="dark-content" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: 'red', fontWeight: '700' }}>{error}</Text>
          <TouchableOpacity
            onPress={() => {
              setError(null);
              setLoading(true);
              setDetails(null);
            }}
            style={{ marginTop: 16 }}
          >
            <Text style={{ color: COLORS.primary, fontWeight: '700' }}>Повторить</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" />

      {/* TOP BAR */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          activeOpacity={0.85}
          onPress={onBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronLeft size={22} color={COLORS.primary} strokeWidth={2.6} />
        </TouchableOpacity>

        <View style={styles.topCenter}>
          <Text style={styles.topTitle}>ЗАКАЗ {titleNumber}</Text>
          <View style={[styles.statusPill, { backgroundColor: stTone.bg, borderColor: stTone.bd }]}>
            <Text style={[styles.statusText, { color: stTone.fg }]}>{st.text}</Text>
          </View>
        </View>

        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* META CARD */}
        <View style={styles.card}>
          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Точка</Text>
              <Text style={styles.metaValue}>{safeText(outletName)}</Text>
            </View>

            <View style={styles.metaItemRight}>
              <View style={styles.metaRow}>
                <Clock size={16} color={COLORS.muted} strokeWidth={2.2} />
                <Text style={styles.metaLabelInline}>создан</Text>
                <Text style={styles.metaValueInline}>{createdAt}</Text>
              </View>

              <View style={[styles.metaRow, { marginTop: 8 }]}>
                <Clock size={16} color={COLORS.muted} strokeWidth={2.2} />
                <Text style={styles.metaLabelInline}>доставить</Text>
                <Text style={styles.metaValueInline}>{deliverAt}</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.payRow}>
            {String(o.paymentMethod || '').toLowerCase().includes('cash') ? (
              <Banknote size={18} color={COLORS.primary} strokeWidth={2.2} />
            ) : (
              <CreditCard size={18} color={COLORS.primary} strokeWidth={2.2} />
            )}
            <Text style={styles.payText}>{paymentLabel(o.paymentMethod)}</Text>
          </View>
        </View>

        {/* ACTIONS */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, !canCall && styles.actionBtnDisabled]}
            activeOpacity={0.9}
            onPress={handleCall}
            disabled={!canCall}
          >
            <View style={styles.actionIconCircle}>
              <Phone size={18} color="#fff" strokeWidth={2.2} />
            </View>
            <Text style={styles.actionText}>ЗВОНОК</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            activeOpacity={0.9}
            onPress={() => onTake?.(o)}
          >
            <View style={[styles.actionIconCircle, styles.actionIconCirclePrimary]}>
              <PlusCircle size={18} color="#fff" strokeWidth={2.2} />
            </View>
            <Text style={[styles.actionText, styles.actionTextPrimary]}>ВЗЯТЬ</Text>
          </TouchableOpacity>
        </View>

        {/* CUSTOMER */}
        <View style={styles.card}>
          <View style={styles.rowStart}>
            <View style={styles.avatar}>
              <User size={20} color={COLORS.primary} strokeWidth={2.4} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.customerName}>{customerName}</Text>
              <Text style={styles.customerPhone}>{phone}</Text>
            </View>
          </View>
        </View>

        {/* ADDRESS */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <MapPin size={18} color={COLORS.primary} strokeWidth={2.2} />
            <Text style={styles.sectionTitle}>Адрес</Text>
          </View>

          <Text style={styles.addressMain}>{safeText(fullAddress)}</Text>

          {aptLine ? <Text style={styles.addressSub}>{aptLine}</Text> : null}

          <View style={styles.smallFields}>
            <View style={styles.smallField}>
              <Text style={styles.smallLabel}>Домофон / код</Text>
              <Text style={styles.smallValue}>{safeText(o.addressCode)}</Text>
            </View>

            <View style={styles.smallField}>
              <Text style={styles.smallLabel}>Комментарий</Text>
              <Text style={styles.smallValue}>{notes}</Text>
            </View>
          </View>
        </View>

        {/* ITEMS */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <ClipboardList size={18} color={COLORS.primary} strokeWidth={2.2} />
            <Text style={styles.sectionTitle}>Состав заказа</Text>
          </View>

          {items.length === 0 ? (
            <Text style={styles.emptyText}>Позиции не найдены.</Text>
          ) : (
            <View style={{ marginTop: 8 }}>
              {items.map((it, idx) => {
              const name = safeText(it.name);
              const qty = Number(it.quantity ?? it.qty ?? 1);
              const unitPrice = Number(it.price ?? it.unit_price ?? it.unitPrice ?? 0);

              // discount = процент (например 5 означает 5%)
              const discPctRaw = it.discount ?? it.discount_percent ?? it.discountPercent ?? 0;
              const discPct = Number(discPctRaw) || 0;

              const base = unitPrice * qty;

              // защита: не даём скидке быть меньше 0 или больше 100
              const discPctClamped = Math.max(0, Math.min(100, discPct));

              const discountAmount = base * (discPctClamped / 100);
              const lineTotal = base - discountAmount;

                return (
                <View key={`${idx}-${name}`} style={styles.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName} numberOfLines={2}>{name}</Text>
                    <Text style={styles.itemMeta}>
                      {qty} × {formatMoney(unitPrice)}
                      {discPctClamped > 0 ? `  •  скидка ${discPctClamped}%` : ''}
                    </Text>
                  </View>
                  <Text style={styles.itemSum}>{formatMoney(lineTotal)}</Text>
                </View>
              );
            })}
            </View>
          )}

          <View style={styles.divider} />

          {/* TOTALS */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Итого по заказу</Text>
            <Text style={styles.totalValue}>{subtotal}</Text>
          </View>

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Скидка</Text>
            <Text style={styles.totalValue}>{discount}</Text>
          </View>

          <View style={[styles.totalRow, { marginTop: 6 }]}>
            <Text style={styles.totalLabelStrong}>Итого к оплате</Text>
            <Text style={styles.totalValueStrong}>{total}</Text>
          </View>
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const COLORS = {
  primary: '#007AFF',
  bg: '#f4f7fb',
  card: '#ffffff',
  text: '#0f172a',
  muted: '#64748b',
  line: '#e6e9ee',
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },

  topBar: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.line,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: Platform.OS === 'ios' ? 0.04 : 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 2,
  },
  topCenter: { flex: 1, alignItems: 'center' },
  topTitle: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.3,
    color: COLORS.text,
  },
  statusPill: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusText: { fontSize: 12, fontWeight: '900' },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 12, paddingBottom: 16 },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(230,233,238,0.9)',
    shadowColor: '#000',
    shadowOpacity: Platform.OS === 'ios' ? 0.04 : 0.10,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 2,
  },

  metaGrid: { flexDirection: 'row', gap: 12 },
  metaItem: { flex: 1 },
  metaItemRight: { flex: 1, alignItems: 'flex-end' },
  metaLabel: { fontSize: 12, fontWeight: '800', color: COLORS.muted },
  metaValue: { marginTop: 6, fontSize: 15, fontWeight: '900', color: COLORS.text },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaLabelInline: { fontSize: 12, fontWeight: '800', color: COLORS.muted },
  metaValueInline: { fontSize: 12, fontWeight: '900', color: COLORS.text },

  divider: {
    height: 1,
    backgroundColor: COLORS.line,
    marginVertical: 12,
  },

  payRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  payText: { fontSize: 13, fontWeight: '900', color: COLORS.text },

  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.line,
    shadowColor: '#000',
    shadowOpacity: Platform.OS === 'ios' ? 0.04 : 0.10,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 2,
    justifyContent: 'center',
  },
  actionBtnPrimary: {
    backgroundColor: '#eef6ff',
    borderColor: 'rgba(0,122,255,0.18)',
  },
  actionBtnDisabled: { opacity: 0.5 },

  actionIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconCirclePrimary: {
    backgroundColor: COLORS.primary,
  },
  actionText: { fontSize: 12, fontWeight: '900', color: COLORS.text, letterSpacing: 0.3 },
  actionTextPrimary: { color: COLORS.primary },

  rowStart: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#eef6ff',
    borderWidth: 1,
    borderColor: 'rgba(0,122,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerName: { fontSize: 16, fontWeight: '900', color: COLORS.text },
  customerPhone: { marginTop: 4, fontSize: 14, fontWeight: '800', color: COLORS.primary },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '900', color: COLORS.text },

  addressMain: { marginTop: 10, fontSize: 16, fontWeight: '900', color: COLORS.text, lineHeight: 22 },
  addressSub: { marginTop: 6, fontSize: 13, fontWeight: '800', color: COLORS.muted },

  smallFields: { marginTop: 12, gap: 10 },
  smallField: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    borderRadius: 14,
    padding: 12,
  },
  smallLabel: { fontSize: 12, fontWeight: '900', color: COLORS.muted },
  smallValue: { marginTop: 6, fontSize: 13, fontWeight: '800', color: COLORS.text, lineHeight: 18 },

  emptyText: { marginTop: 10, color: COLORS.muted, fontWeight: '700' },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(230,233,238,0.6)',
  },
  itemName: { fontSize: 13, fontWeight: '900', color: COLORS.text, lineHeight: 18 },
  itemMeta: { marginTop: 4, fontSize: 12, fontWeight: '800', color: COLORS.muted },
  itemSum: { fontSize: 13, fontWeight: '900', color: COLORS.text },

  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  totalLabel: { fontSize: 13, fontWeight: '800', color: COLORS.muted },
  totalValue: { fontSize: 13, fontWeight: '900', color: COLORS.text },
  totalLabelStrong: { fontSize: 14, fontWeight: '900', color: COLORS.text },
  totalValueStrong: { fontSize: 16, fontWeight: '900', color: COLORS.primary },
});
