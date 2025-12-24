import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RotateCw, ArrowDownToLine, ChevronRight, ChevronLeft } from 'lucide-react-native';

/**
 * ДЕМО-ДАННЫЕ (замени на свои)
 */
const ORDERS = [
  {
    id: '28',
    number: 28,
    time: '19:23',
    eta: '00:39',
    address: 'Aristida Briana iela, дом 16, квартира 5, этаж 2, код ieeja no pagalma k0ds 147',
    outlet: 'Briana',
  },
  {
    id: '10',
    number: 10,
    time: '19:23',
    eta: '00:39',
    address: 'Aristida Briana iela, дом 16, квартира 5, этаж 2, код ieeja no pagalma k0ds 147',
    outlet: 'Briana',
  },
  {
    id: '11',
    number: 11,
    time: '19:23',
    eta: '00:39',
    address: 'Aristida Briana iela, дом 16, квартира 5, этаж 2, код ieeja no pagalma k0ds 147',
    outlet: 'Briana',
  },
  {
    id: '12',
    number: 12,
    time: '19:23',
    eta: '00:39',
    address: 'Aristida Briana iela, дом 16, квартира 5, этаж 2, код ieeja no pagalma k0ds 147',
    outlet: 'Briana',
  },
  {
    id: '13',
    number: 13,
    time: '19:23',
    eta: '00:39',
    address: 'Aristida Briana iela, дом 16, квартира 5, этаж 2, код ieeja no pagalma k0ds 147',
    outlet: 'Briana',
  },
  {
    id: '30',
    number: 30,
    time: '19:35',
    eta: '00:29',
    address: 'Purvciema iela, дом 57, квартира 33, этаж 5, код 33atsleg2911',
    outlet: 'Briana',
  },
  {
    id: '31',
    number: 31,
    time: '19:38',
    eta: '00:24',
    address: 'Sliezu iela, Sarkandaugava, дом 9a, квартира 45, этаж 2, код 680',
    outlet: 'Briana',
  },
  {
    id: '16',
    number: 16,
    time: '19:38',
    eta: '00:24',
    address: 'Sliezu iela, Sarkandaugava, дом 9a, квартира 45, этаж 2, код 680',
    outlet: 'Saga',
  },
  {
    id: '17',
    number: 17,
    time: '19:38',
    eta: '00:24',
    address: 'Sliezu iela, Sarkandaugava, дом 9a, квартира 45, этаж 2, код 680',
    outlet: 'Зепчик',
  },
  {
    id: '18',
    number: 18,
    time: '19:38',
    eta: '00:24',
    address: 'Sliezu iela, Sarkandaugava, дом 9a, квартира 45, этаж 2, код 680',
    outlet: 'Зепчик',
  },
];

export default function OrdersListScreenModern({
  companyTitle = 'Предприятие',
  companyId = '6741',
  outletName = 'Briana', // fallback name
  useSafeArea = true,
  onRefresh,
  onOpenOrder,
  onActionPress,
  outlet, // { id, name }
  onBack,
}) {
  const data = useMemo(() => {
    // when no outlet provided or a special "all" outlet — return all orders
    if (!outlet || outlet.id === 'all' || !outlet.name) return ORDERS;
    const name = String(outlet.name).toLowerCase();
    return ORDERS.filter((o) => String(o.outlet || '').toLowerCase() === name);
  }, [outlet]);

  const Wrapper = useSafeArea ? SafeAreaView : View;

  const handleRefresh = () => {
    onRefresh?.();
  };

  const renderItem = ({ item }) => {
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.card}
        onPress={() => onOpenOrder?.(item)}
      >
        {/* LEFT: номер */}
        <View style={styles.leftCol}>
          <View style={styles.orderNumPill}>
            <Text style={styles.orderNumPrefix}>№</Text>
            <Text style={styles.orderNumText}>{item.number}</Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{item.time}</Text>
            <View style={styles.metaDot} />
            <Text style={styles.metaText}>{item.eta}</Text>
          </View>
        </View>

        {/* CENTER: адрес + точка */}
        <View style={styles.centerCol}>
          <Text style={styles.address} numberOfLines={2}>
            {item.address}
          </Text>

          <View style={styles.bottomRow}>
            <View style={styles.outletChip}>
              <Text style={styles.outletChipText}>{item.outlet || outletName}</Text>
            </View>

            {/* можно сюда добавить ещё метки: "срочно", "оплачен", и т.д. */}
          </View>
        </View>

        {/* RIGHT: action */}
        <View style={styles.rightCol}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.actionBtn}
            onPress={() => onActionPress?.(item)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {/* вариант 1: “скачать/взять” */}
            <ArrowDownToLine size={18} color={COLORS.primary} strokeWidth={2.2} />
          </TouchableOpacity>

          <ChevronRight size={18} color={COLORS.muted} strokeWidth={2.2} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Wrapper style={styles.safe} edges={useSafeArea ? ['top', 'left', 'right'] : undefined}>
      <StatusBar barStyle="light-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack ? onBack : handleRefresh}
          style={styles.headerIconBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          {onBack ? (
            <ChevronLeft size={20} color="#fff" strokeWidth={2.2} />
          ) : (
            <RotateCw size={20} color="#fff" strokeWidth={2.2} />
          )}
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{companyTitle}</Text>
          <Text style={styles.headerSubtitle}>
            id {companyId} • {outlet?.id === 'all' ? 'Все точки' : (outlet?.name ?? outletName)}
          </Text>
        </View>

        <View style={styles.headerIconBtnPlaceholder} />
      </View>

      {/* CONTENT */}
      <View style={styles.sheet}>
        <View style={styles.sectionTop}>
          <Text style={styles.sectionTitle}>{outlet?.id === 'all' ? 'Все заказы' : (outlet?.name ? `${outlet.name} — активные` : 'Активные заказы')}</Text>
          <View style={styles.counterPill}>
            <Text style={styles.counterText}>{data.length}</Text>
          </View>
        </View>

        <FlatList
          data={data}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </Wrapper>
  );
}

const COLORS = {
  primary: '#007AFF',
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
    backgroundColor: COLORS.primary,
  },

  // header
  header: {
    paddingTop: 8,
    paddingBottom: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconBtnPlaceholder: {
    width: 38,
    height: 38,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    marginTop: 3,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '600',
  },

  // white sheet
  sheet: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 14,
  },
  sectionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  counterPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#eaf2ff',
    borderWidth: 1,
    borderColor: 'rgba(0,122,255,0.18)',
  },
  counterText: {
    color: COLORS.primary,
    fontWeight: '900',
    fontSize: 12,
  },

  listContent: {
    paddingHorizontal: 14,
    paddingBottom: 18,
  },

  // card
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: COLORS.sheet,
    marginBottom: 10,

    borderWidth: 1,
    borderColor: 'rgba(230,233,238,0.9)',

    shadowColor: '#000',
    shadowOpacity: Platform.OS === 'ios' ? 0.05 : 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 2,
  },

  leftCol: {
    width: 92,
    justifyContent: 'center',
  },
  orderNumPill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    alignSelf: 'flex-start',
    backgroundColor: '#eef6ff',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,122,255,0.18)',
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

  metaRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
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
    backgroundColor: '#cbd5e1',
    marginHorizontal: 8,
  },

  centerCol: {
    flex: 1,
    justifyContent: 'center',
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
  },
  outletChip: {
    backgroundColor: COLORS.soft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
  },
  outletChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.muted,
  },

  rightCol: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#f3f8ff',
    borderWidth: 1,
    borderColor: 'rgba(0,122,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
