import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Trash2, ChevronRight, CheckCircle2, Clock } from 'lucide-react-native';
import { useTheme } from './theme';
import { useT } from './i18n';

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

export default function MyOrdersScreen({
  myOrders = [],
  useSafeArea = true,
  onOpenOrder,
  onRemoveOrder,
  onCompleteOrder,
}) {
  const { colors: COLORS } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const { active, completed } = useMemo(() => {
    return {
      active: myOrders.filter((o) => !o.completed),
      completed: myOrders.filter((o) => o.completed),
    };
  }, [myOrders]);

  const Wrapper = useSafeArea ? SafeAreaView : View;

  const handleCompleteOrder = (orderId, orderNumber) => {
    Alert.alert(
      t('myOrders.closeTitle'),
      t('myOrders.closeBody', { number: orderNumber }),
      [
        {
          text: t('common.cancel'),
          onPress: () => { },
          style: 'cancel',
        },
        {
          text: t('myOrders.yesDone'),
          onPress: () => onCompleteOrder?.(orderId),
          style: 'destructive',
        },
      ],
      { cancelable: false }
    );
  };

  const renderOrderItem = ({ item, index, isCompleted }) => {
    const number = item.orderSeq || item.orderNo || item.number || `#${item.id}`;
    const address = item.address || item.addressStreet || '—';
    const customer = item.customer || '—';
    const timeCreated = formatTimeOnly(item.createdAt) || '—';
    const timeDelivery = formatTimeOnly(item.scheduledAt);

    return (
      <View style={[styles.card, isCompleted && styles.cardCompleted]}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.cardContent}
          onPress={() => !isCompleted && onOpenOrder?.(item)}
        >
          <View style={styles.leftCol}>
            <View style={[styles.orderNumPill, isCompleted && styles.orderNumPillCompleted]}>
              <Text style={[styles.orderNumPrefix, isCompleted && styles.orderNumPrefixCompleted]}>
                №
              </Text>
              <Text style={[styles.orderNumText, isCompleted && styles.orderNumTextCompleted]}>
                {number}
              </Text>
            </View>

            <View style={styles.timeRow}>
              <Text style={[styles.timeText, isCompleted && styles.timeTextCompleted]}>
                {timeCreated}
              </Text>
              {timeDelivery && (
                <>
                  <View style={styles.timeDot} />
                  <Text style={[styles.timeText, isCompleted && styles.timeTextCompleted]}>
                    {timeDelivery}
                  </Text>
                </>
              )}
            </View>
          </View>

          <View style={styles.centerCol}>
            <Text style={[styles.address, isCompleted && styles.addressCompleted]} numberOfLines={2}>
              {address}
            </Text>
            <Text
              style={[styles.customerText, isCompleted && styles.customerTextCompleted]}
              numberOfLines={1}
            >
              {customer}
            </Text>
          </View>

          {!isCompleted && <ChevronRight size={18} color={COLORS.muted} strokeWidth={2.2} />}
          {isCompleted && <CheckCircle2 size={20} color={COLORS.success} strokeWidth={2.2} />}
        </TouchableOpacity>

        {!isCompleted && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.completeBtn}
              activeOpacity={0.85}
              onPress={() => handleCompleteOrder(item.id, number)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <CheckCircle2 size={18} color={COLORS.success} strokeWidth={2.2} />
              <Text style={styles.completeBtnText}>{t('myOrders.done')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.removeBtn}
              activeOpacity={0.85}
              onPress={() => onRemoveOrder?.(item.id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Trash2 size={18} color={COLORS.danger} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const content = (
    <>
      <StatusBar barStyle={COLORS.statusBar} backgroundColor={COLORS.bg} />

      {/* <View style={styles.bgCircleTop} pointerEvents="none" />
      <View style={styles.bgCircleBottom} pointerEvents="none" /> */}

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
    marginBottom: 22,
  },

  sectionCompleted: {
    opacity: 0.88,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 12,
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
    gap: 10,
  },

  // card: {
  //   backgroundColor: COLORS.card,
  //   borderRadius: 20,
  //   borderWidth: 1,
  //   borderColor: COLORS.line,
  //   overflow: 'hidden',
  //   shadowColor: '#000',
  //   shadowOpacity: Platform.OS === 'ios' ? 0.22 : 0.18,
  //   shadowOffset: { width: 0, height: 10 },
  //   shadowRadius: 18,
  //   elevation: 8,
  // },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.lineSoft,

    marginBottom: 10,

    shadowColor: COLORS.shadow,
    shadowOpacity: Platform.OS === 'ios' ? 0.35 : 0.25,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 22,
    elevation: 10,
  },

  // cardCompleted: {
  //   backgroundColor: 'rgba(255,255,255,0.03)',
  //   borderColor: 'rgba(74, 222, 128, 0.14)',
  // },
  cardCompleted: {
    backgroundColor: COLORS.cardCompleted,
    borderColor: COLORS.softGreenBorder,
  },

  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },

  leftCol: {
    width: 88,
    alignItems: 'flex-start',
  },

  orderNumPill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: COLORS.softBlue,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: COLORS.softBlueBorder,
  },

  orderNumPillCompleted: {
    backgroundColor: COLORS.softGreen,
    borderColor: COLORS.softGreenBorder,
  },

  orderNumPrefix: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.primary,
    marginRight: 4,
  },

  orderNumPrefixCompleted: {
    color: COLORS.success,
  },

  orderNumText: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.primary,
  },

  orderNumTextCompleted: {
    color: COLORS.success,
  },

  timeRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
  },

  timeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.muted,
  },

  timeTextCompleted: {
    color: COLORS.muted,
  },

  timeDot: {
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

  address: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    lineHeight: 20,
  },

  addressCompleted: {
    color: COLORS.muted,
  },

  customerText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.muted,
  },

  customerTextCompleted: {
    color: COLORS.muted,
  },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 8,
  },

  completeBtn: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 14,
    backgroundColor: COLORS.softGreen,
    borderWidth: 1,
    borderColor: COLORS.softGreenBorder,
  },

  completeBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.success,
  },

  removeBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.softRed,
    borderWidth: 1,
    borderColor: COLORS.softRedBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
});