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
  Navigation,
} from 'lucide-react-native';

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

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '—';

    const day = date.getDate();
    const month = new Intl.DateTimeFormat('ru-RU', { month: 'long' }).format(date);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${day} ${month}, ${hours}:${minutes}`;
  } catch {
    return '—';
  }
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
      return { bg: 'rgba(74, 222, 128, 0.12)', bd: 'rgba(74, 222, 128, 0.20)', fg: '#4ADE80' };
    case 'danger':
      return { bg: 'rgba(255, 123, 123, 0.12)', bd: 'rgba(255, 123, 123, 0.20)', fg: '#FF7B7B' };
    case 'info':
      return { bg: 'rgba(47, 140, 255, 0.12)', bd: 'rgba(47, 140, 255, 0.20)', fg: '#2F8CFF' };
    default:
      return { bg: 'rgba(143, 163, 184, 0.12)', bd: 'rgba(143, 163, 184, 0.20)', fg: '#8FA3B8' };
  }
}

function buildFullAddress(o) {
  const street = safeText(o.addressStreet, '');
  const house = o.addressHouse ? `д. ${o.addressHouse}` : '';
  const building = o.addressBuilding ? `к. ${o.addressBuilding}` : '';

  const parts = [street, house, building].filter(Boolean);
  if (parts.length) return parts.join(', ');

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
  const [details, setDetails] = useState(order && (order.items || order.items_json) ? order : null);
  const [loading, setLoading] = useState(!(order?.items || order?.items_json));
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;

    async function fetchDetails() {
      if (!order?.id) return;
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
  const items = useMemo(() => parseItems(o.items ?? o.items_json), [o.items, o.items_json]);

  const st = statusLabel(o.status);
  const stTone = toneStyles(st.tone);

  const titleNumber =
    o.orderSeq ? `№${o.orderSeq}` :
    o.orderNo ? String(o.orderNo) :
    o.id ? `#${o.id}` : '—';

  const createdAt = formatDateTime(o.createdAt);
  const deliverAt = formatDateTime(o.scheduledAt);

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
        <StatusBar barStyle="light-content" backgroundColor="#010B13" />
        <View style={styles.bgCircleTop} pointerEvents="none" />
        <View style={styles.bgCircleBottom} pointerEvents="none" />
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.stateText}>Загрузка заказа...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="light-content" backgroundColor="#010B13" />
        <View style={styles.bgCircleTop} pointerEvents="none" />
        <View style={styles.bgCircleBottom} pointerEvents="none" />
        <View style={styles.centerState}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            onPress={() => {
              setError(null);
              setLoading(true);
              setDetails(null);
            }}
            style={styles.retryBtn}
            activeOpacity={0.85}
          >
            <Text style={styles.retryBtnText}>Повторить</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#010B13" />

      <View style={styles.bgCircleTop} pointerEvents="none" />
      <View style={styles.bgCircleBottom} pointerEvents="none" />

      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          activeOpacity={0.85}
          onPress={onBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronLeft size={22} color="#FFFFFF" strokeWidth={2.6} />
        </TouchableOpacity>

        <View style={styles.topCenter}>
          <Text style={styles.topTitle}>ЗАКАЗ {titleNumber}</Text>
          <View style={[styles.statusPill, { backgroundColor: stTone.bg, borderColor: stTone.bd }]}>
            <Text style={[styles.statusText, { color: stTone.fg }]}>{st.text}</Text>
          </View>
        </View>

        <View style={{ width: 42 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.cardAccent} />
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
            <Text style={styles.actionText}>Звонок</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, !canCall && styles.actionBtnDisabled]}
            activeOpacity={0.9}
            onPress={handleCall}
            disabled={!canCall}
          >
            <View style={styles.actionIconCircle}>
              <Navigation size={18} color="#fff" strokeWidth={2.2} />
            </View>
            <Text style={styles.actionText}>Waze</Text>
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

        <View style={styles.card}>
          <View style={styles.cardAccentSoft} />
          <View style={styles.rowStart}>
            <View style={styles.avatar}>
              <User size={20} color={COLORS.primary} strokeWidth={2.4} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.customerName}>{customerName}</Text>
              <Text style={styles.customerPhone}>{phone || '—'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardAccentSoft} />
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

        <View style={styles.card}>
          <View style={styles.cardAccentSoft} />
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
                const discPctRaw = it.discount ?? it.discount_percent ?? it.discountPercent ?? 0;
                const discPct = Number(discPctRaw) || 0;
                const base = unitPrice * qty;
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

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Итого по заказу</Text>
            <Text style={styles.totalValue}>{subtotal}</Text>
          </View>

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Скидка</Text>
            <Text style={styles.totalValue}>{discount}</Text>
          </View>

          <View style={[styles.totalRow, { marginTop: 8 }]}>
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
  primary: '#2F8CFF',
  bg: '#010B13',
  card: '#0B1722',
  cardStrong: '#0F2232',
  text: '#FFFFFF',
  muted: '#8FA3B8',
  line: 'rgba(255,255,255,0.08)',
  softBlue: 'rgba(47, 140, 255, 0.12)',
  softGray: 'rgba(255,255,255,0.03)',
  success: '#4ADE80',
  danger: '#FF7B7B',
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  bgCircleTop: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(0, 122, 255, 0.12)',
    zIndex: 0,
  },

  bgCircleBottom: {
    position: 'absolute',
    bottom: -100,
    left: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(0, 180, 255, 0.08)',
    zIndex: 0,
  },

  topBar: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 2,
  },

  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  topCenter: {
    flex: 1,
    alignItems: 'center',
  },

  topTitle: {
    fontSize: 17,
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

  statusText: {
    fontSize: 12,
    fontWeight: '900',
  },

  scroll: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: 12,
    paddingBottom: 16,
  },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 16,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000',
    shadowOpacity: Platform.OS === 'ios' ? 0.35 : 0.25,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 22,
    elevation: 10,
    overflow: 'hidden',
  },

  cardAccent: {
    position: 'absolute',
    top: 16,
    bottom: 16,
    left: 0,
    width: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: COLORS.primary,
  },

  cardAccentSoft: {
    position: 'absolute',
    top: 16,
    bottom: 16,
    left: 0,
    width: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: 'rgba(47, 140, 255, 0.45)',
  },

  metaGrid: {
    flexDirection: 'row',
    gap: 12,
  },

  metaItem: {
    flex: 1,
    paddingLeft: 6,
  },

  metaItemRight: {
    flex: 1,
    alignItems: 'flex-end',
  },

  metaLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.muted,
  },

  metaValue: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.text,
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },

  metaLabelInline: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.muted,
  },

  metaValueInline: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.text,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.line,
    marginVertical: 14,
  },

  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 6,
  },

  payText: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.text,
  },

  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },

  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: Platform.OS === 'ios' ? 0.28 : 0.20,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
    elevation: 8,
  },

  actionBtnPrimary: {
    backgroundColor: COLORS.softBlue,
    borderColor: 'rgba(47,140,255,0.20)',
  },

  actionBtnDisabled: {
    opacity: 0.45,
  },

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

  actionText: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: 0.3,
  },

  actionTextPrimary: {
    color: COLORS.primary,
  },

  rowStart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 6,
  },

  avatar: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: COLORS.softBlue,
    borderWidth: 1,
    borderColor: 'rgba(47,140,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  customerName: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.text,
  },

  customerPhone: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 6,
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.text,
  },

  addressMain: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.text,
    lineHeight: 22,
    paddingLeft: 6,
  },

  addressSub: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.muted,
    paddingLeft: 6,
  },

  smallFields: {
    marginTop: 14,
    gap: 10,
    paddingLeft: 6,
  },

  smallField: {
    backgroundColor: COLORS.softGray,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 12,
  },

  smallLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.muted,
  },

  smallValue: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
    lineHeight: 18,
  },

  emptyText: {
    marginTop: 10,
    color: COLORS.muted,
    fontWeight: '700',
    paddingLeft: 6,
  },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    paddingLeft: 6,
  },

  itemName: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.text,
    lineHeight: 18,
  },

  itemMeta: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.muted,
  },

  itemSum: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.text,
  },

  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingLeft: 6,
  },

  totalLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.muted,
  },

  totalValue: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.text,
  },

  totalLabelStrong: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.text,
  },

  totalValueStrong: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.primary,
  },

  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },

  stateText: {
    marginTop: 12,
    color: COLORS.muted,
    fontWeight: '700',
  },

  errorText: {
    color: COLORS.danger,
    fontWeight: '800',
    textAlign: 'center',
  },

  retryBtn: {
    marginTop: 16,
    backgroundColor: COLORS.softBlue,
    borderWidth: 1,
    borderColor: 'rgba(47,140,255,0.20)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },

  retryBtnText: {
    color: COLORS.primary,
    fontWeight: '800',
  },
});