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
import { RotateCw, ChevronLeft, PlusCircle, PackageOpen } from 'lucide-react-native';
import { ORIGIN } from './constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from './theme';

function formatTimeOnly(dateStr) {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  } catch {
    return null;
  }
}

function formatMoney(v) {
  const n = Number(v);
  if (isNaN(n)) return '—';
  return n.toFixed(2);
}

function statusLabel(status) {
  const s = (status || '').toLowerCase();

  if (s === 'new') {
    return {
      text: 'Новый',
      color: '#2F8CFF',
      bg: 'rgba(47, 140, 255, 0.12)',
      border: 'rgba(47, 140, 255, 0.22)',
    };
  }

  if (s === 'ready') {
    return {
      text: 'Готов',
      color: '#4ADE80',
      bg: 'rgba(74, 222, 128, 0.12)',
      border: 'rgba(74, 222, 128, 0.20)',
    };
  }

  if (s === 'enroute') {
    return {
      text: 'В пути',
      color: '#FBBF24',
      bg: 'rgba(251, 191, 36, 0.12)',
      border: 'rgba(251, 191, 36, 0.20)',
    };
  }

  if (s === 'cancelled') {
    return {
      text: 'Отменён',
      color: '#FF7B7B',
      bg: 'rgba(255, 123, 123, 0.12)',
      border: 'rgba(255, 123, 123, 0.20)',
    };
  }

  return {
    text: String(status || '—').toUpperCase(),
    color: '#8FA3B8',
    bg: 'rgba(143, 163, 184, 0.12)',
    border: 'rgba(143, 163, 184, 0.20)',
  };
}

async function getAuthToken() {
  try {
    return await AsyncStorage.getItem('authToken');
  } catch {
    return null;
  }
}

export default function OrdersListScreenModern({
  companyTitle = 'Предприятие',
  companyId = '',
  outletName = '',
  useSafeArea = true,
  orders: ordersProp = null,
  onRefresh,
  onOpenOrder,
  onActionPress,
  outlet,
  onBack,
}) {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const [fetchedOrders, setFetchedOrders] = useState([]);
  const [loading, setLoading] = useState(ordersProp === null);
  const [error, setError] = useState(null);

  const fetchOrders = useCallback(async () => {
    if (ordersProp !== null) return;

    setLoading(true);
    setError(null);

    try {
      const token = await getAuthToken();
      const res = await fetch(`${ORIGIN}/api/mobile-orders?tab=active`, {
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

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleRefresh = () => {
    fetchOrders();
    onRefresh?.();
  };

  const allOrders = ordersProp !== null ? ordersProp : fetchedOrders;
  const isLiveData = ordersProp !== null;

  const data = useMemo(() => {
    if (!outlet || outlet.id === 'all') return allOrders;
    const filterName = String(outlet.serverName || outlet.name || '').toLowerCase();
    if (!filterName) return allOrders;
    return allOrders.filter((o) => String(o.outlet || '').toLowerCase() === filterName);
  }, [allOrders, outlet]);

  const Wrapper = useSafeArea ? SafeAreaView : View;

  const renderItem = ({ item }) => {
    const status = statusLabel(item.status);
    const created = formatTimeOnly(item.createdAt);
    const scheduled = formatTimeOnly(item.scheduledAt);
    const primaryTime = scheduled || created || '—';
    const timeCaption = scheduled ? 'выдача' : 'принят';
    const orderNo = item.orderSeq || item.orderNo || item.id;

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.card}
        onPress={() => onOpenOrder?.({ id: item.id || item.order_id, ...item })}
      >
        <View style={styles.cardRow}>
          {/* Левый блок: время выдачи + статус */}
          <View style={styles.timeBox}>
            <Text style={styles.timeBig}>{primaryTime}</Text>
            <Text style={styles.timeCaption}>{timeCaption}</Text>
            <View
              style={[
                styles.statusPill,
                { backgroundColor: status.bg, borderColor: status.border },
              ]}
            >
              <Text style={[styles.statusPillText, { color: status.color }]} numberOfLines={1}>
                {status.text}
              </Text>
            </View>
          </View>

          {/* Центр: №/точка, адрес, клиент */}
          <View style={styles.infoCol}>
            <View style={styles.metaTop}>
              <Text style={styles.metaNum}>№{orderNo}</Text>
              <Text style={styles.metaOutlet} numberOfLines={1}> · {item.outlet || outletName}</Text>
            </View>

            <Text style={styles.address} numberOfLines={2}>
              {item.address || '—'}
            </Text>

            <Text style={styles.customerLine} numberOfLines={1}>
              {item.customer || '—'}
              {scheduled && created ? `  ·  принят ${created}` : ''}
            </Text>
          </View>

          {/* Право: сумма + кнопка «взять» */}
          <View style={styles.rightCol}>
            <Text style={styles.price}>{formatMoney(item.amountTotal)} €</Text>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.takeBtn}
              onPress={() => onActionPress?.(item)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <PlusCircle size={20} color={COLORS.onPrimary} strokeWidth={2.4} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Wrapper style={styles.safe} edges={useSafeArea ? ['top', 'left', 'right'] : undefined}>
      <StatusBar barStyle={COLORS.statusBar} backgroundColor={COLORS.bg} />

      {/* <View style={styles.bgCircleTop} pointerEvents="none" />
      <View style={styles.bgCircleBottom} pointerEvents="none" /> */}

      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack ?? handleRefresh}
          style={styles.headerIconBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          {onBack ? (
            <ChevronLeft size={20} color={COLORS.text} strokeWidth={2.2} />
          ) : (
            <RotateCw size={20} color={COLORS.text} strokeWidth={2.2} />
          )}
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{companyTitle}</Text>
          <Text style={styles.headerSubtitle}>
            id {companyId} • {outlet?.id === 'all' ? 'Все точки' : outlet?.name ?? outletName}
            {isLiveData ? '  ●' : ''}
          </Text>
        </View>

        <View style={styles.headerIconBtnPlaceholder} />
      </View>

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
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.stateText}>Загрузка заказов...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerState}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={handleRefresh} style={styles.retryBtn} activeOpacity={0.85}>
              <Text style={styles.retryBtnText}>Повторить</Text>
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
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <PackageOpen size={42} color={COLORS.muted} strokeWidth={1.8} />
                </View>
                <Text style={styles.emptyTitle}>Нет доступных заказов</Text>
                <Text style={styles.emptyText}>
                  Когда появятся новые заказы, они будут отображаться здесь
                </Text>
              </View>
            }
          />
        )}
      </View>
    </Wrapper>
  );
}

const makeStyles = (COLORS) => StyleSheet.create({
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
    backgroundColor: COLORS.circleTop,
    zIndex: 0,
  },

  bgCircleBottom: {
    position: 'absolute',
    bottom: -100,
    left: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: COLORS.circleBottom,
    zIndex: 0,
  },

  header: {
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    zIndex: 2,
  },

  headerIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.line,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerIconBtnPlaceholder: {
    width: 42,
    height: 42,
  },

  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 10,
  },

  headerTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  headerSubtitle: {
    marginTop: 4,
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },

  sheet: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  sectionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },

  counterPill: {
    minWidth: 36,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.softBlue,
    borderWidth: 1,
    borderColor: COLORS.softBlueBorder,
    alignItems: 'center',
  },

  counterText: {
    color: COLORS.primary,
    fontWeight: '900',
    fontSize: 12,
  },

  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 18,
  },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.lineSoft,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: COLORS.shadow,
    shadowOpacity: Platform.OS === 'ios' ? 0.35 : 0.25,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 22,
    elevation: 10,
  },

  cardRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 13,
    padding: 14,
  },

  timeBox: {
    minWidth: 74,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.softBlue,
    borderWidth: 1,
    borderColor: COLORS.softBlueBorder,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },

  timeBig: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    lineHeight: 22,
  },

  timeCaption: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.muted,
    marginTop: 3,
  },

  statusPill: {
    marginTop: 8,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderWidth: 1,
  },

  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
  },

  infoCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },

  metaTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },

  metaNum: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
  },

  metaOutlet: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.muted,
  },

  address: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    lineHeight: 20,
    marginTop: 4,
  },

  customerLine: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.muted,
    marginTop: 4,
  },

  rightCol: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },

  price: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },

  takeBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
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
    borderColor: COLORS.softBlueBorder,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },

  retryBtnText: {
    color: COLORS.primary,
    fontWeight: '800',
  },

  emptyState: {
    marginTop: 40,
    backgroundColor: COLORS.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.line,
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 10,
  },

  emptyIconWrap: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.cardStrong,
    borderWidth: 1,
    borderColor: COLORS.line,
  },

  emptyTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },

  emptyText: {
    marginTop: 8,
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
});