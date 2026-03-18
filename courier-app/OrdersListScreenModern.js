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
import { RotateCw, ChevronRight, ChevronLeft, PlusCircle, PackageOpen } from 'lucide-react-native';
import { ORIGIN } from './constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.card}
        onPress={() => onOpenOrder?.({ id: item.id || item.order_id, ...item })}
      >
        <View style={styles.cardAccent} />

        <View style={styles.cardContent}>
          <View style={styles.leftCol}>
            <View style={styles.orderNumPill}>
              <Text style={styles.orderNumPrefix}>№</Text>
              <Text style={styles.orderNumText}>{item.orderSeq || item.orderNo || item.id}</Text>
            </View>

            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: status.bg,
                  borderColor: status.border,
                },
              ]}
            >
              <Text style={[styles.statusBadgeText, { color: status.color }]}>
                {status.text}
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

          <View style={styles.centerCol}>
            <Text style={styles.customerText} numberOfLines={1}>
              {item.customer || '—'}
            </Text>

            <Text style={styles.address} numberOfLines={2}>
              {item.address || '—'}
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

          <View style={styles.rightCol}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.actionBtn}
              onPress={() => onActionPress?.(item)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <PlusCircle size={18} color={COLORS.primary} strokeWidth={2.2} />
            </TouchableOpacity>

            <ChevronRight size={18} color={COLORS.muted} strokeWidth={2.2} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Wrapper style={styles.safe} edges={useSafeArea ? ['top', 'left', 'right'] : undefined}>
      <StatusBar barStyle="light-content" backgroundColor="#010B13" />

      {/* <View style={styles.bgCircleTop} pointerEvents="none" />
      <View style={styles.bgCircleBottom} pointerEvents="none" /> */}

      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack ?? handleRefresh}
          style={styles.headerIconBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          {onBack ? (
            <ChevronLeft size={20} color="#FFFFFF" strokeWidth={2.2} />
          ) : (
            <RotateCw size={20} color="#FFFFFF" strokeWidth={2.2} />
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

const COLORS = {
  primary: '#2F8CFF',
  bg: '#010B13',
  card: '#0B1722',
  cardStrong: '#0F2232',
  text: '#FFFFFF',
  muted: '#8FA3B8',
  line: 'rgba(255,255,255,0.08)',
  softBlue: 'rgba(47, 140, 255, 0.12)',
  softBlueStrong: 'rgba(47, 140, 255, 0.18)',
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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
    color: '#FFFFFF',
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
    borderColor: 'rgba(47, 140, 255, 0.18)',
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
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: Platform.OS === 'ios' ? 0.35 : 0.25,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 22,
    elevation: 10,
  },

  cardAccent: {
    position: 'absolute',
    top: 14,
    bottom: 14,
    left: 0,
    width: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: COLORS.primary,
  },

  cardContent: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingLeft: 18,
  },

  leftCol: {
    width: 92,
    justifyContent: 'center',
  },

  orderNumPill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    alignSelf: 'flex-start',
    backgroundColor: COLORS.softBlue,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(47,140,255,0.18)',
  },

  orderNumPrefix: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.primary,
    marginRight: 6,
  },

  orderNumText: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.primary,
  },

  statusBadge: {
    marginTop: 8,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    borderWidth: 1,
  },

  statusBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },

  metaRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },

  metaText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.muted,
  },

  metaDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(143,163,184,0.5)',
    marginHorizontal: 8,
  },

  centerCol: {
    flex: 1,
    justifyContent: 'center',
  },

  customerText: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.primary,
    marginBottom: 5,
  },

  address: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
    lineHeight: 18,
  },

  bottomRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },

  outletChip: {
    backgroundColor: COLORS.softGray,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  outletChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.muted,
  },

  priceChip: {
    backgroundColor: COLORS.softBlue,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(47,140,255,0.18)',
  },

  priceChipText: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.primary,
  },

  rightCol: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },

  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: COLORS.softBlue,
    borderWidth: 1,
    borderColor: 'rgba(47,140,255,0.16)',
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
    borderColor: 'rgba(47,140,255,0.20)',
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
    shadowColor: '#000',
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