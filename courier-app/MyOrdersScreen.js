import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Trash2, ChevronRight, CheckCircle2, Clock } from 'lucide-react-native';

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
  // Разделяем активные и завершенные заказы
  const { active, completed } = useMemo(() => {
    return {
      active: myOrders.filter((o) => !o.completed),
      completed: myOrders.filter((o) => o.completed),
    };
  }, [myOrders]);

  const Wrapper = useSafeArea ? SafeAreaView : View;

  const handleCompleteOrder = (orderId, orderNumber) => {
    Alert.alert(
      'Закрыть заказ',
      `Вы уверены что хотите закрыть заказ №${orderNumber}?`,
      [
        {
          text: 'Отмена',
          onPress: () => {},
          style: 'cancel',
        },
        {
          text: 'Да, готово',
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
          {/* LEFT: номер и время */}
          <View style={styles.leftCol}>
            <View style={[styles.orderNumPill, isCompleted && styles.orderNumPillCompleted]}>
              <Text style={[styles.orderNumPrefix, isCompleted && styles.orderNumPrefixCompleted]}>№</Text>
              <Text style={[styles.orderNumText, isCompleted && styles.orderNumTextCompleted]}>{number}</Text>
            </View>

            <View style={styles.timeRow}>
              <Text style={[styles.timeText, isCompleted && styles.timeTextCompleted]}>{timeCreated}</Text>
              {timeDelivery && (
                <>
                  <View style={styles.timeDot} />
                  <Text style={[styles.timeText, isCompleted && styles.timeTextCompleted]}>{timeDelivery}</Text>
                </>
              )}
            </View>
          </View>

          {/* CENTER: адрес и клиент */}
          <View style={styles.centerCol}>
            <Text style={[styles.address, isCompleted && styles.addressCompleted]} numberOfLines={2}>
              {address}
            </Text>
            <Text style={[styles.customerText, isCompleted && styles.customerTextCompleted]} numberOfLines={1}>
              {customer}
            </Text>
          </View>

          {/* RIGHT: иконка */}
          {!isCompleted && <ChevronRight size={18} color={COLORS.muted} strokeWidth={2.2} />}
          {isCompleted && <CheckCircle2 size={20} color={COLORS.success} strokeWidth={2.2} />}
        </TouchableOpacity>

        {/* ACTIONS */}
        {!isCompleted && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.completeBtn}
              activeOpacity={0.85}
              onPress={() => handleCompleteOrder(item.id, number)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <CheckCircle2 size={18} color={COLORS.success} strokeWidth={2.2} />
              <Text style={styles.completeBtnText}>Готово</Text>
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
      <StatusBar barStyle="dark-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>МОИ ЗАКАЗЫ</Text>
      </View>

      {/* CONTENT */}
      <ScrollView style={styles.sheet} showsVerticalScrollIndicator={false}>
        {myOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Clock size={48} color={COLORS.muted} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>Нет заказов</Text>
            <Text style={styles.emptyText}>Нажимайте "ВЗЯТЬ" на странице заказов</Text>
          </View>
        ) : (
          <>
            {/* АКТИВНЫЕ ЗАКАЗЫ */}
            {active.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>В работе</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{active.length}</Text>
                  </View>
                </View>
                <View>
                  {active.map((item, idx) => (
                    <View key={`active-${item.id}-${idx}`}>
                      {renderOrderItem({ item, index: idx, isCompleted: false })}
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ЗАВЕРШЕННЫЕ ЗАКАЗЫ */}
            {completed.length > 0 && (
              <View style={[styles.section, styles.sectionCompleted]}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, styles.sectionTitleCompleted]}>Завершено</Text>
                  <View style={[styles.badge, styles.badgeCompleted]}>
                    <Text style={[styles.badgeText, styles.badgeTextCompleted]}>{completed.length}</Text>
                  </View>
                </View>
                <View>
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

const COLORS = {
  primary: '#007AFF',
  success: '#16a34a',
  danger: '#e11d48',
  bg: '#f4f7fb',
  sheet: '#ffffff',
  text: '#0f172a',
  muted: '#64748b',
  line: '#e6e9ee',
  soft: '#f1f5f9',
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.2,
    color: COLORS.text,
  },

  sheet: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 16,
  },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.text,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 13,
    color: COLORS.muted,
    textAlign: 'center',
  },

  section: {
    marginBottom: 20,
  },
  sectionCompleted: {
    opacity: 0.7,
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
    letterSpacing: 0.3,
  },
  sectionTitleCompleted: {
    color: COLORS.muted,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#eaf2ff',
    borderWidth: 1,
    borderColor: 'rgba(0,122,255,0.18)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.primary,
  },
  badgeCompleted: {
    backgroundColor: 'rgba(22,163,74,0.1)',
    borderColor: 'rgba(22,163,74,0.2)',
  },
  badgeTextCompleted: {
    color: COLORS.success,
  },

  listContent: {
    gap: 10,
    paddingBottom: 12,
  },

  card: {
    backgroundColor: COLORS.sheet,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(230,233,238,0.9)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: Platform.OS === 'ios' ? 0.04 : 0.10,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 2,
  },
  cardCompleted: {
    backgroundColor: '#f9fafb',
    borderColor: 'rgba(22,163,74,0.2)',
  },

  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },

  leftCol: {
    width: 80,
    alignItems: 'flex-start',
  },
  orderNumPill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: '#eef6ff',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,122,255,0.18)',
  },
  orderNumPillCompleted: {
    backgroundColor: 'rgba(22,163,74,0.08)',
    borderColor: 'rgba(22,163,74,0.2)',
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
  timeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.muted,
  },
  timeTextCompleted: {
    color: 'rgba(100,116,139,0.6)',
  },
  timeRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  timeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    marginHorizontal: 8,
  },

  centerCol: {
    flex: 1,
    justifyContent: 'center',
  },
  address: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.text,
    lineHeight: 18,
  },
  addressCompleted: {
    color: 'rgba(15,23,42,0.6)',
  },
  customerText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.muted,
  },
  customerTextCompleted: {
    color: 'rgba(100,116,139,0.6)',
  },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 8,
  },
  completeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(22,163,74,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(22,163,74,0.2)',
  },
  completeBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.success,
  },
  removeBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(225,29,72,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(225,29,72,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
