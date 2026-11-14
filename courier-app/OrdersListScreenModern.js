
import React, { useMemo, useEffect, useState, useCallback, useRef } from 'react';
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
import { RotateCw, ChevronLeft, PlusCircle, PackageOpen, Clock, CalendarClock } from 'lucide-react-native';
import { ORIGIN } from './constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from './theme';
import { useT } from './i18n';
import FadeInView from './components/anim/FadeInView';
import PressableScale from './components/anim/PressableScale';
import FreshHighlight from './components/anim/FreshHighlight';

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

const LOCALES = { ru: 'ru-RU', en: 'en-GB', lv: 'lv-LV' };

// Дата+время выдачи предзаказа для карточки, напр. «7 сен, 18:30».
function formatScheduled(dateStr, locale) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const date = d.toLocaleDateString(locale || 'ru-RU', { day: 'numeric', month: 'short' });
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${date}, ${time}`;
}

// Сколько времени прошло с момента появления заказа (по createdAt).
// nowTs передаётся снаружи и обновляется раз в минуту → строка «оживает».
function formatElapsed(createdAt, nowTs, t) {
  if (!createdAt) return null;
  const start = new Date(createdAt).getTime();
  if (!Number.isFinite(start)) return null;
  const diffMin = Math.floor((nowTs - start) / 60000);
  if (diffMin < 1) return t('ordersList.justNow');
  if (diffMin < 60) return t('ordersList.minAgo', { m: diffMin });
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return t('ordersList.hourMin', { h, m });
}

function statusLabel(status, t) {
  const s = (status || '').toLowerCase();

  if (s === 'new') {
    return {
      text: t('ordersList.statusNew'),
      color: '#2F8CFF',
      bg: 'rgba(47, 140, 255, 0.12)',
      border: 'rgba(47, 140, 255, 0.22)',
    };
  }

  if (s === 'preparing') {
    return {
      text: t('ordersList.statusPreparing', { defaultValue: 'Готовится' }),
      color: '#8B5CF6',
      bg: 'rgba(139, 92, 246, 0.12)',
      border: 'rgba(139, 92, 246, 0.22)',
    };
  }

  if (s === 'ready') {
    return {
      text: t('ordersList.statusReady'),
      color: '#4ADE80',
      bg: 'rgba(74, 222, 128, 0.12)',
      border: 'rgba(74, 222, 128, 0.20)',
    };
  }

  if (s === 'enroute') {
    return {
      text: t('ordersList.statusEnroute'),
      color: '#FBBF24',
      bg: 'rgba(251, 191, 36, 0.12)',
      border: 'rgba(251, 191, 36, 0.20)',
    };
  }

  if (s === 'cancelled') {
    return {
      text: t('ordersList.statusCancelled'),
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
  highlightOrderId = null,   // заказ из push — подсвечиваем и прокручиваем к нему
}) {
  const { colors: COLORS } = useTheme();
  const { t, lang } = useT();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const [fetchedOrders, setFetchedOrders] = useState([]);
  const [loading, setLoading] = useState(ordersProp === null);
  const [error, setError] = useState(null);

  // Тик раз в минуту — для пересчёта таймера «прошло с появления заказа»
  const [nowTs, setNowTs] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

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

  // Прокрутка к заказу, ради которого курьер пришёл по уведомлению:
  // без неё подсветка бесполезна, если заказ оказался внизу длинного списка.
  const listRef = useRef(null);
  useEffect(() => {
    if (!highlightOrderId) return;
    const idx = data.findIndex(
      (o) => String(o.id || o.order_id) === String(highlightOrderId)
    );
    if (idx < 0) return;
    const tm = setTimeout(() => {
      try {
        listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.3 });
      } catch (e) { /* onScrollToIndexFailed подстрахует */ }
    }, 350);
    return () => clearTimeout(tm);
  }, [highlightOrderId, data]);

  const renderItem = ({ item, index }) => {
    const status = statusLabel(item.status, t);
    const created = formatTimeOnly(item.createdAt);
    const elapsed = formatElapsed(item.createdAt, nowTs, t);
    // Предзаказ определяем по наличию scheduledAt — время выдачи остаётся видно
    // на карточке даже после того, как крон переведёт заказ в «активные».
    const scheduledLabel = formatScheduled(item.scheduledAt, LOCALES[lang] || 'ru-RU');
    const isPreorder = !!scheduledLabel;
    const orderNo = item.orderSeq || item.orderNo || item.id;
    const outletLabel = item.outlet || outletName;

    // Мета-строка: № · точка · клиент (без пустых сегментов)
    const metaText = [
      `№${orderNo}`,
      outletLabel || null,
      item.customer || null,
    ].filter(Boolean).join(' · ');

    // «Свежий» заказ — пришёл недавно (для мягкой подсветки при появлении)
    const createdMs = item.createdAt ? new Date(item.createdAt).getTime() : NaN;
    const isFresh = Number.isFinite(createdMs) && Date.now() - createdMs < 12000;

    // Заказ, ради которого курьер пришёл по уведомлению — выделяем явно
    const isHighlighted =
      highlightOrderId != null &&
      String(item.id || item.order_id) === String(highlightOrderId);

    return (
      <FadeInView index={index}>
        <PressableScale
          style={styles.card}
          onPress={() => onOpenOrder?.({ id: item.id || item.order_id, ...item })}
        >
          {/* Подсветка — тем же готовым механизмом, что и для свежих заказов */}
          <FreshHighlight
            active={isFresh || isHighlighted}
            color={isHighlighted ? (COLORS.softBlueStrong ?? COLORS.softBlue) : COLORS.softBlue}
          />

          {/* Цветная полоса статуса слева */}
          <View style={[styles.stripe, { backgroundColor: status.color }]} />

          <View style={styles.cardBody}>
            {/* Строка 1: адрес + кнопка «взять» */}
            <View style={styles.rowTop}>
              <Text style={styles.address} numberOfLines={1}>
                {item.address || '—'}
              </Text>
              <PressableScale
                style={styles.takeBtn}
                onPress={() => onActionPress?.(item)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                scaleTo={0.9}
              >
                <PlusCircle size={18} color={COLORS.onPrimary} strokeWidth={2.4} />
              </PressableScale>
            </View>

            {/* Строка 2: № · точка · клиент */}
            <Text style={styles.metaLine} numberOfLines={1}>
              {metaText}
            </Text>

            {/* Строка 3: предзаказ → дата/время выдачи; иначе создан | сколько висит */}
            <View style={styles.rowBottom}>
              {isPreorder ? (
                <View style={styles.preorderChip}>
                  <CalendarClock size={13} color="#6366F1" strokeWidth={2.2} />
                  <Text style={styles.preorderChipText}>{scheduledLabel}</Text>
                </View>
              ) : (
                <View style={styles.timeChip}>
                  <Clock size={13} color={COLORS.primary} strokeWidth={2.2} />
                  <Text style={styles.timeCreated}>{created || '—'}</Text>
                  {elapsed ? <Text style={styles.timeDivider}>|</Text> : null}
                  {elapsed ? <Text style={styles.timeElapsed}>{elapsed}</Text> : null}
                </View>
              )}

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
          </View>
        </PressableScale>
      </FadeInView>
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
            id {companyId} • {outlet?.id === 'all' ? t('allOrders.allOutlets') : outlet?.name ?? outletName}
            {isLiveData ? '  ●' : ''}
          </Text>
        </View>

        <View style={styles.headerIconBtnPlaceholder} />
      </View>

      <View style={styles.sheet}>
        <View style={styles.sectionTop}>
          <Text style={styles.sectionTitle}>
            {outlet?.id === 'all'
              ? t('ordersList.allOrders')
              : `${outlet?.name ?? outletName} — ${t('ordersList.activeSuffix')}`}
          </Text>

          <View style={styles.counterPill}>
            <Text style={styles.counterText}>{data.length}</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.stateText}>{t('ordersList.loading')}</Text>
          </View>
        ) : error ? (
          <View style={styles.centerState}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={handleRefresh} style={styles.retryBtn} activeOpacity={0.85}>
              <Text style={styles.retryBtnText}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={data}
            extraData={`${nowTs}-${highlightOrderId ?? ''}`}
            keyExtractor={(it) => String(it.id)}
            renderItem={renderItem}
            // прокрутка к подсвеченному заказу может не сработать, если элемент
            // ещё не измерен — тогда доскроллим приблизительно и повторим
            onScrollToIndexFailed={(info) => {
              listRef.current?.scrollToOffset({
                offset: info.averageItemLength * info.index,
                animated: true,
              });
            }}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshing={loading}
            onRefresh={handleRefresh}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <PackageOpen size={42} color={COLORS.muted} strokeWidth={1.8} />
                </View>
                <Text style={styles.emptyTitle}>{t('ordersList.empty')}</Text>
                <Text style={styles.emptyText}>
                  {t('ordersList.emptyHint')}
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
    position: 'relative',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.lineSoft,
    marginBottom: 8,
    overflow: 'hidden',
    shadowColor: COLORS.shadow,
    shadowOpacity: Platform.OS === 'ios' ? 0.18 : 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 4,
  },

  // Цветная полоса статуса слева
  stripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },

  cardBody: {
    paddingVertical: 9,
    paddingRight: 11,
    paddingLeft: 15,
  },

  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },

  address: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },

  takeBtn: {
    // width: 28,
    // height: 28,
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  metaLine: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.muted,
    marginBottom: 4
  },

  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 7,
  },

  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.softBlue,
    borderWidth: 1,
    borderColor: COLORS.softBlueBorder,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },

  timeCreated: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },

  timeDivider: {
    fontSize: 12,
    color: COLORS.muted,
  },

  timeElapsed: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.warning,
  },

  // Чип предзаказа: индиго-акцент, дата+время выдачи
  preorderChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(99, 102, 241, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.30)',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },

  preorderChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6366F1',
  },

  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderWidth: 1,
  },

  statusPillText: {
    fontSize: 12,
    fontWeight: '800',
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