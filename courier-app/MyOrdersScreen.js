import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Trash2, ChevronRight, CheckCircle2, Clock, Navigation } from 'lucide-react-native';
import { useTheme } from './theme';
import { useT } from './i18n';
import FadeInView from './components/anim/FadeInView';
import PressableScale from './components/anim/PressableScale';
import FreshHighlight from './components/anim/FreshHighlight';

// Форматирование только времени (например: "14:16")
function formatTimeOnly(dateStr) {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch {
    return null;
  }
}

// Сколько времени прошло с момента появления заказа (по createdAt).
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

// Цвет/подпись статуса (тот же язык, что и на экране «Все заказы»)
function statusMeta(status, t) {
  const s = (status || '').toLowerCase();
  if (s === 'new') {
    return { text: t('ordersList.statusNew'), color: '#2F8CFF', bg: 'rgba(47, 140, 255, 0.12)', border: 'rgba(47, 140, 255, 0.22)' };
  }
  if (s === 'ready') {
    return { text: t('ordersList.statusReady'), color: '#4ADE80', bg: 'rgba(74, 222, 128, 0.12)', border: 'rgba(74, 222, 128, 0.20)' };
  }
  if (s === 'enroute') {
    return { text: t('ordersList.statusEnroute'), color: '#FBBF24', bg: 'rgba(251, 191, 36, 0.12)', border: 'rgba(251, 191, 36, 0.20)' };
  }
  if (s === 'cancelled') {
    return { text: t('ordersList.statusCancelled'), color: '#FF7B7B', bg: 'rgba(255, 123, 123, 0.12)', border: 'rgba(255, 123, 123, 0.20)' };
  }
  return { text: String(status || '—').toUpperCase(), color: '#8FA3B8', bg: 'rgba(143, 163, 184, 0.12)', border: 'rgba(143, 163, 184, 0.20)' };
}

export default function MyOrdersScreen({
  myOrders = [],
  useSafeArea = true,
  highlightOrderId = null,   // заказ из push — подсвечиваем, чтобы курьер его нашёл
  onOpenOrder,
  onRemoveOrder,
  onEnrouteOrder,
  onCompleteOrder,
}) {
  const { colors: COLORS } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  // Тик раз в минуту — чтобы таймер «сколько висит» оживал
  const [nowTs, setNowTs] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const { active, completed } = useMemo(() => {
    const isDone = (o) => o.completed || (o.status || '').toLowerCase() === 'completed';
    return {
      active: myOrders.filter((o) => !isDone(o)),
      completed: myOrders.filter(isDone),
    };
  }, [myOrders]);

  const Wrapper = useSafeArea ? SafeAreaView : View;

  // Подтверждение спрашивает экран (общий нижний лист OrderDialog) — здесь
  // системного Alert быть не должно, иначе диалога было два подряд.
  const handleCompleteOrder = (orderId) => {
    onCompleteOrder?.(orderId);
  };

  const renderOrderItem = ({ item, index, isCompleted }) => {
    const number = item.orderSeq || item.orderNo || item.number || `#${item.id}`;
    const address = item.address || item.addressStreet || '—';
    const customer = item.customer || '—';
    const created = formatTimeOnly(item.createdAt) || '—';
    const elapsed = isCompleted ? null : formatElapsed(item.createdAt, nowTs, t);

    const meta = statusMeta(item.status, t);
    const stripeColor = isCompleted ? COLORS.success : meta.color;
    // Пока заказ не «в пути» — показываем «В путь»; после — «Готово».
    const isEnroute = (item.status || '').toLowerCase() === 'enroute';

    const metaText = [`№${number}`, customer].filter(Boolean).join(' · ');
    const isHighlighted =
      highlightOrderId != null && String(item.id) === String(highlightOrderId);

    return (
      <FadeInView
        index={index}
        style={[styles.card, isCompleted && styles.cardCompleted]}
      >
        {/* Тот же механизм подсветки, что и в списке заказов точки */}
        <FreshHighlight active={isHighlighted} color={COLORS.softBlueStrong ?? COLORS.softBlue} />
        {/* Цветная полоса статуса слева */}
        <View style={[styles.stripe, { backgroundColor: stripeColor }]} />

        <PressableScale style={styles.cardBody} onPress={() => onOpenOrder?.(item)}>
          {/* Строка 1: адрес + индикатор/чек */}
          <View style={styles.rowTop}>
            <Text
              style={[styles.address, isCompleted && styles.addressCompleted]}
              numberOfLines={1}
            >
              {address}
            </Text>
            {isCompleted ? (
              <CheckCircle2 size={20} color={COLORS.success} strokeWidth={2.2} />
            ) : (
              <ChevronRight size={18} color={COLORS.muted} strokeWidth={2.2} />
            )}
          </View>

          {/* Строка 2: № · клиент */}
          <Text style={styles.metaLine} numberOfLines={1}>
            {metaText}
          </Text>

          {/* Строка 3: время создания | сколько висит + статус */}
          <View style={styles.rowBottom}>
            <View style={styles.timeChip}>
              <Clock size={13} color={COLORS.primary} strokeWidth={2.2} />
              <Text style={styles.timeCreated}>{created}</Text>
              {elapsed ? <Text style={styles.timeDivider}>|</Text> : null}
              {elapsed ? <Text style={styles.timeElapsed}>{elapsed}</Text> : null}
            </View>

            {!isCompleted && (
              <View style={[styles.statusPill, { backgroundColor: meta.bg, borderColor: meta.border }]}>
                <Text style={[styles.statusPillText, { color: meta.color }]} numberOfLines={1}>
                  {meta.text}
                </Text>
              </View>
            )}
          </View>
        </PressableScale>

        {/* Действия — только для активных заказов.
            Сначала «В путь», после смены статуса на enroute — «Готово». */}
        {!isCompleted && (
          <View style={styles.actions}>
            {isEnroute ? (
              <PressableScale
                style={styles.completeBtn}
                onPress={() => handleCompleteOrder(item.id)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <CheckCircle2 size={17} color={COLORS.success} strokeWidth={2.2} />
                <Text style={styles.completeBtnText}>{t('myOrders.done')}</Text>
              </PressableScale>
            ) : (
              <PressableScale
                style={styles.enrouteBtn}
                onPress={() => onEnrouteOrder?.(item.id)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Navigation size={17} color={COLORS.primary} strokeWidth={2.2} />
                <Text style={styles.enrouteBtnText}>{t('myOrders.enroute', { defaultValue: 'В путь' })}</Text>
              </PressableScale>
            )}

            <PressableScale
              style={styles.removeBtn}
              onPress={() => onRemoveOrder?.(item.id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              scaleTo={0.9}
            >
              <Trash2 size={17} color={COLORS.danger} strokeWidth={2.2} />
            </PressableScale>
          </View>
        )}
      </FadeInView>
    );
  };

  const content = (
    <>
      <StatusBar barStyle={COLORS.statusBar} backgroundColor={COLORS.bg} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('myOrders.title')}</Text>
        <Text style={styles.headerSubtitle}>{t('myOrders.subtitle')}</Text>
      </View>

      <ScrollView
        style={styles.sheet}
        contentContainerStyle={styles.sheetContent}
        showsVerticalScrollIndicator={false}
      >
        {myOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Clock size={42} color={COLORS.muted} strokeWidth={1.8} />
            </View>
            <Text style={styles.emptyTitle}>{t('myOrders.empty')}</Text>
            <Text style={styles.emptyText}>{t('myOrders.emptyHint')}</Text>
          </View>
        ) : (
          <>
            {active.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{t('myOrders.inWork')}</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{active.length}</Text>
                  </View>
                </View>

                <View style={styles.cardsList}>
                  {active.map((item, idx) => (
                    <View key={`active-${item.id}-${idx}`}>
                      {renderOrderItem({ item, index: idx, isCompleted: false })}
                    </View>
                  ))}
                </View>
              </View>
            )}

            {completed.length > 0 && (
              <View style={[styles.section, styles.sectionCompleted]}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, styles.sectionTitleCompleted]}>
                    {t('myOrders.completed')}
                  </Text>
                  <View style={[styles.badge, styles.badgeCompleted]}>
                    <Text style={[styles.badgeText, styles.badgeTextCompleted]}>
                      {completed.length}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardsList}>
                  {completed.map((item, idx) => (
                    <View key={`completed-${item.id}-${idx}`}>
                      {renderOrderItem({ item, index: idx, isCompleted: true })}
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </>
  );

  if (useSafeArea) {
    return (
      <Wrapper style={styles.safe} edges={['top', 'left', 'right']}>
        {content}
      </Wrapper>
    );
  }

  return <View style={styles.safe}>{content}</View>;
}

const makeStyles = (COLORS) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: 'transparent',
    zIndex: 2,
  },

  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.3,
    color: COLORS.text,
  },

  headerSubtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.muted,
  },

  sheet: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  sheetContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 16,
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

  section: {
    marginBottom: 20,
  },

  sectionCompleted: {
    opacity: 0.9,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 10,
  },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.text,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  sectionTitleCompleted: {
    color: COLORS.muted,
  },

  badge: {
    minWidth: 34,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.softBlue,
    borderWidth: 1,
    borderColor: COLORS.softBlueBorder,
    alignItems: 'center',
  },

  badgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.primary,
  },

  badgeCompleted: {
    backgroundColor: COLORS.softGreen,
    borderColor: COLORS.softGreenBorder,
  },

  badgeTextCompleted: {
    color: COLORS.success,
  },

  cardsList: {
    gap: 8,
  },

  // ── Карточка (единый стиль с экраном «Все заказы») ──
  card: {
    position: 'relative',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.lineSoft,
    overflow: 'hidden',
    shadowColor: COLORS.shadow,
    shadowOpacity: Platform.OS === 'ios' ? 0.18 : 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 4,
  },

  cardCompleted: {
    backgroundColor: COLORS.cardCompleted,
    borderColor: COLORS.softGreenBorder,
  },

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

  addressCompleted: {
    color: COLORS.muted,
  },

  metaLine: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.muted,
    marginTop: 3,
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

  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderWidth: 1,
  },

  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
  },

  // ── Действия ──
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 15,
    paddingRight: 11,
    paddingBottom: 10,
    paddingTop: 2,
  },

  completeBtn: {
    flex: 1,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    backgroundColor: COLORS.softGreen,
    borderWidth: 1,
    borderColor: COLORS.softGreenBorder,
  },

  completeBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.success,
  },

  enrouteBtn: {
    flex: 1,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    backgroundColor: COLORS.softBlue,
    borderWidth: 1,
    borderColor: COLORS.softBlueBorder,
  },

  enrouteBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.primary,
  },

  removeBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.softRed,
    borderWidth: 1,
    borderColor: COLORS.softRedBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
