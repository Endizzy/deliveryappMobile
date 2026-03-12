// OrdersListScreenModern.js
import React, { useMemo, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RotateCw, ArrowDownToLine, ChevronRight, ChevronLeft } from 'lucide-react-native';
import { ORIGIN } from './constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

function formatTimeOnly(dateStr) {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  } catch { return null; }
}

function formatMoney(v) {
  const n = Number(v);
  if (isNaN(n)) return '—';
  return n.toFixed(2);
}

function statusLabel(status) {
  const s = (status || '').toLowerCase();
  if (s === 'new')       return { text: 'Новый',   color: '#007AFF' };
  if (s === 'ready')     return { text: 'Готов',    color: '#16a34a' };
  if (s === 'enroute')   return { text: 'В пути',   color: '#f59e0b' };
  if (s === 'cancelled') return { text: 'Отменён',  color: '#e11d48' };
  return { text: String(status || '—').toUpperCase(), color: '#64748b' };
}

async function getAuthToken() {
  try { return await AsyncStorage.getItem('authToken'); } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Пропы:
//   orders       — если передан (из useOrdersWebSocket), fetch не делается
//   onRefresh    — вызывается при pull-to-refresh (fetchAvailable из хука)
//   outlet       — { id, name, serverName }
// ─────────────────────────────────────────────────────────────────────────────
export default function OrdersListScreenModern({
  companyTitle  = 'Предприятие',
  companyId     = '',
  outletName    = '',
  useSafeArea   = true,
  orders: ordersProp = null,  // << данные из useOrdersWebSocket (реалтайм)
  onRefresh,
  onOpenOrder,
  onActionPress,
  outlet,
  onBack,
}) {
  const [fetchedOrders, setFetchedOrders] = useState([]);
  const [loading,       setLoading]       = useState(ordersProp === null);
  const [error,         setError]         = useState(null);

  // Если orders НЕ переданы пропом — делаем собственный fetch (fallback)
  const fetchOrders = useCallback(async () => {
    if (ordersProp !== null) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      const res   = await fetch(`${ORIGIN}/api/mobile-orders?tab=active`, {
        headers: { Authorization: token ? `Bearer ${token}` : undefined },
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Ошибка загрузки заказов');
      setFetchedOrders(data.items || []);
    } catch (e) {
      setError(e.message || 'Ошибка сети');
    } finally {
      setLoading(false);
    }
  }, [ordersProp]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleRefresh = () => {
    fetchOrders();
    onRefresh?.();
  };

  // Источник данных: проп (реалтайм WS) или локальный fetch
  const allOrders = ordersProp !== null ? ordersProp : fetchedOrders;
  const isLiveData = ordersProp !== null;

  // Фильтрация по точке выдачи
  const data = useMemo(() => {
    if (!outlet || outlet.id === 'all') return allOrders;
    const filterName = String(outlet.serverName || outlet.name || '').toLowerCase();
    if (!filterName) return allOrders;
    return allOrders.filter((o) => String(o.outlet || '').toLowerCase() === filterName);
  }, [allOrders, outlet]);

  const Wrapper = useSafeArea ? SafeAreaView : View;

  const renderItem = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.85}
      style={styles.card}
      onPress={() => onOpenOrder?.({ id: item.id || item.order_id, ...item })}
    >
      {/* LEFT: номер + статус + время */}
      <View style={styles.leftCol}>
        <View style={styles.orderNumPill}>
          <Text style={styles.orderNumPrefix}>№</Text>
          <Text style={styles.orderNumText}>{item.orderSeq || item.orderNo || item.id}</Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: statusLabel(item.status).color + '20' }]}>
          <Text style={[styles.statusBadgeText, { color: statusLabel(item.status).color }]}>
            {statusLabel(item.status).text}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{formatTimeOnly(item.createdAt) || '—'}</Text>
          {formatTimeOnly(item.scheduledAt) && (
            <>
              <View style={styles.metaDot} />
              <Text style={styles.metaText}>{formatTimeOnly(item.scheduledAt)}</Text>
            </>
          )}
        </View>
      </View>

      {/* CENTER: клиент + адрес + точка + цена */}
      <View style={styles.centerCol}>
        <Text style={styles.customerText} numberOfLines={1}>
          {item.customer || '—'}
        </Text>
        <Text style={styles.address} numberOfLines={2}>
          {item.address}
        </Text>
        <View style={styles.bottomRow}>
          <View style={styles.outletChip}>
            <Text style={styles.outletChipText}>{item.outlet || outletName}</Text>
          </View>
          <View style={styles.priceChip}>
            <Text style={styles.priceChipText}>{formatMoney(item.amountTotal)} €</Text>
          </View>
        </View>
      </View>

      {/* RIGHT */}
      <View style={styles.rightCol}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.actionBtn}
          onPress={() => onActionPress?.(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowDownToLine size={18} color={COLORS.primary} strokeWidth={2.2} />
        </TouchableOpacity>
        <ChevronRight size={18} color={COLORS.muted} strokeWidth={2.2} />
      </View>
    </TouchableOpacity>
  );

  return (
    <Wrapper style={styles.safe} edges={useSafeArea ? ['top', 'left', 'right'] : undefined}>
      <StatusBar barStyle="light-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack ?? handleRefresh}
          style={styles.headerIconBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          {onBack
            ? <ChevronLeft  size={20} color="#fff" strokeWidth={2.2} />
            : <RotateCw     size={20} color="#fff" strokeWidth={2.2} />
          }
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{companyTitle}</Text>
          <Text style={styles.headerSubtitle}>
            id {companyId} • {outlet?.id === 'all' ? 'Все точки' : (outlet?.name ?? outletName)}
            {isLiveData ? '  ●' : ''}
          </Text>
        </View>

        <View style={styles.headerIconBtnPlaceholder} />
      </View>

      {/* CONTENT */}
      <View style={styles.sheet}>
        <View style={styles.sectionTop}>
          <Text style={styles.sectionTitle}>
            {outlet?.id === 'all' ? 'Все заказы' : `${outlet?.name ?? outletName} — активные`}
          </Text>
          <View style={styles.counterPill}>
            <Text style={styles.counterText}>{data.length}</Text>
          </View>
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 40 }}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={{ marginTop: 12, color: COLORS.muted }}>Загрузка заказов...</Text>
          </View>
        ) : error ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 40 }}>
            <Text style={{ color: 'red', fontWeight: '700' }}>{error}</Text>
            <TouchableOpacity onPress={handleRefresh} style={{ marginTop: 16 }}>
              <Text style={{ color: COLORS.primary, fontWeight: '700' }}>Повторить</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={data}
            keyExtractor={(it) => String(it.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshing={loading}
            onRefresh={handleRefresh}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', marginTop: 40 }}>
                <Text style={{ color: COLORS.muted, fontWeight: '700' }}>Нет доступных заказов</Text>
              </View>
            }
          />
        )}
      </View>
    </Wrapper>
  );
}

const COLORS = {
  primary: '#007AFF',
  bg:      '#f4f7fb',
  sheet:   '#ffffff',
  text:    '#0f172a',
  muted:   '#64748b',
  line:    '#e6e9ee',
  soft:    '#f1f5f9',
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.primary },

  header: {
    paddingTop:       8,
    paddingBottom:    14,
    paddingHorizontal: 14,
    flexDirection:    'row',
    alignItems:       'center',
  },
  headerIconBtn: {
    width:           38,
    height:          38,
    borderRadius:    12,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  headerIconBtnPlaceholder: { width: 38, height: 38 },
  headerCenter: {
    flex:       1,
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  headerTitle: {
    color:      '#fff',
    fontSize:   18,
    fontWeight: '800',
  },
  headerSubtitle: {
    marginTop:  3,
    color:      'rgba(255,255,255,0.85)',
    fontSize:   12,
    fontWeight: '600',
  },

  sheet: {
    flex:                 1,
    backgroundColor:      COLORS.bg,
    borderTopLeftRadius:  22,
    borderTopRightRadius: 22,
    paddingTop:           14,
  },
  sectionTop: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom:  10,
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  counterPill: {
    paddingHorizontal: 10,
    paddingVertical:   6,
    borderRadius:      999,
    backgroundColor:   '#eaf2ff',
    borderWidth:       1,
    borderColor:       'rgba(0,122,255,0.18)',
  },
  counterText: { color: COLORS.primary, fontWeight: '900', fontSize: 12 },
  listContent:  { paddingHorizontal: 14, paddingBottom: 18 },

  card: {
    flexDirection:   'row',
    gap:             12,
    padding:         14,
    borderRadius:    16,
    backgroundColor: COLORS.sheet,
    marginBottom:    10,
    borderWidth:     1,
    borderColor:     'rgba(230,233,238,0.9)',
    shadowColor:     '#000',
    shadowOpacity:   Platform.OS === 'ios' ? 0.05 : 0.12,
    shadowOffset:    { width: 0, height: 6 },
    shadowRadius:    14,
    elevation:       2,
  },

  leftCol: { width: 92, justifyContent: 'center' },
  orderNumPill: {
    flexDirection:    'row',
    alignItems:       'baseline',
    alignSelf:        'flex-start',
    backgroundColor:  '#eef6ff',
    borderRadius:     12,
    paddingHorizontal: 10,
    paddingVertical:  6,
    borderWidth:      1,
    borderColor:      'rgba(0,122,255,0.18)',
  },
  orderNumPrefix: { fontSize: 11, fontWeight: '900', color: COLORS.primary, marginRight: 6 },
  orderNumText:   { fontSize: 16, fontWeight: '900', color: COLORS.primary },

  statusBadge: {
    marginTop:        6,
    borderRadius:     8,
    paddingHorizontal: 8,
    paddingVertical:  4,
    alignSelf:        'flex-start',
  },
  statusBadgeText: { fontSize: 11, fontWeight: '900' },

  metaRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center' },
  metaText: { fontSize: 12, fontWeight: '700', color: COLORS.muted },
  metaDot: {
    width:        4,
    height:       4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    marginHorizontal: 8,
  },

  centerCol: { flex: 1, justifyContent: 'center' },
  customerText: { fontSize: 13, fontWeight: '900', color: COLORS.primary, marginBottom: 4 },
  address:      { fontSize: 13, fontWeight: '800', color: COLORS.text, lineHeight: 18 },
  bottomRow:    { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },

  outletChip: {
    backgroundColor:  COLORS.soft,
    borderRadius:     999,
    paddingHorizontal: 10,
    paddingVertical:  6,
    borderWidth:      1,
    borderColor:      'rgba(148,163,184,0.25)',
  },
  outletChipText: { fontSize: 12, fontWeight: '800', color: COLORS.muted },

  priceChip: {
    backgroundColor:  '#eef6ff',
    borderRadius:     999,
    paddingHorizontal: 10,
    paddingVertical:  6,
    borderWidth:      1,
    borderColor:      'rgba(0,122,255,0.18)',
  },
  priceChipText: { fontSize: 12, fontWeight: '900', color: COLORS.primary },

  rightCol: {
    alignItems:    'flex-end',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  actionBtn: {
    width:           38,
    height:          38,
    borderRadius:    14,
    backgroundColor: '#f3f8ff',
    borderWidth:     1,
    borderColor:     'rgba(0,122,255,0.16)',
    alignItems:      'center',
    justifyContent:  'center',
  },
});