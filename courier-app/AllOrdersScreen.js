// AllOrdersScreen.js
import React from 'react';
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

// Список точек выдачи — serverName должен совпадать со значением поля outlet в заказе
const OUTLETS = [
  { id: 'all', name: 'Все точки', serverName: null, isAll: true },
  { id: 'briana', name: 'Briana', serverName: 'Briana' },
  { id: 'saga', name: 'Saga', serverName: 'Saga' },
  { id: 'zep', name: 'Зепчик', serverName: 'Ziepniekkalns' },
];

const AllOrdersScreen = ({
  useSafeArea = true,
  onOpenOutlet,
  outletCounts = {},
}) => {
  const getCount = (item) => {
    if (item.isAll) {
      return Object.values(outletCounts).reduce((sum, v) => sum + v, 0);
    }
    const key = (item.serverName || item.name || '').toLowerCase();
    return outletCounts[key] ?? 0;
  };

  const renderItem = ({ item }) => {
    const count = getCount(item);
    const isActive = count > 0;

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        style={[
          styles.card,
          item.isAll && styles.cardAll,
          isActive && styles.cardWithOrders,
        ]}
        onPress={() => onOpenOutlet?.(item)}
      >
        <View style={styles.cardMain}>
          <View style={styles.cardTitleWrapper}>
            <View style={styles.titleRow}>
              <Text
                style={[styles.cardTitle, item.isAll && styles.cardTitleAll]}
                numberOfLines={1}
              >
                {item.name}
              </Text>

              {item.isAll && (
                <View style={styles.allPill}>
                  <Text style={styles.allPillText}>ВСЕ</Text>
                </View>
              )}
            </View>

            <Text style={styles.cardSubtitle}>
              {item.isAll ? 'Все активные точки выдачи' : 'Открыть список заказов точки'}
            </Text>
          </View>

          <View style={[styles.badge, isActive && styles.badgeActive]}>
            <Text style={[styles.badgeText, isActive && styles.badgeTextActive]}>
              {count}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const content = (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#010B13" />

      {/* <View style={styles.bgCircleTop} pointerEvents="none" />
      <View style={styles.bgCircleBottom} pointerEvents="none" /> */}

      <View style={styles.header}>
        <Text style={styles.headerTitle}>ЗАКАЗЫ</Text>
        <Text style={styles.headerSubtitle}>Выберите точку выдачи</Text>
      </View>

      <View style={styles.content}>
        <FlatList
          data={OUTLETS}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </>
  );

  if (useSafeArea) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {content}
      </SafeAreaView>
    );
  }

  return <View style={styles.safeArea}>{content}</View>;
};

export default AllOrdersScreen;

const COLORS = {
  primary: '#2F8CFF',
  bg: '#010B13',
  card: '#0B1722',
  cardAlt: '#0F2232',
  text: '#FFFFFF',
  muted: '#8FA3B8',
  line: 'rgba(255,255,255,0.08)',
  softBlue: 'rgba(47, 140, 255, 0.12)',
  softBlueStrong: 'rgba(47, 140, 255, 0.18)',
};

const styles = StyleSheet.create({
  safeArea: {
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

  content: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  listContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 24,
  },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.line,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: Platform.OS === 'ios' ? 0.35 : 0.25,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 22,
    elevation: 10,
  },

  cardAll: {
    backgroundColor: COLORS.cardAlt,
    borderColor: 'rgba(47, 140, 255, 0.16)',
  },

  cardWithOrders: {
    borderColor: 'rgba(47, 140, 255, 0.18)',
  },

  cardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },

  cardTitleWrapper: {
    flex: 1,
    paddingRight: 12,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  cardTitle: {
    fontSize: 17,
    color: COLORS.text,
    fontWeight: '700',
  },

  cardTitleAll: {
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  cardSubtitle: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 6,
    lineHeight: 18,
  },

  allPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: COLORS.softBlue,
    borderWidth: 1,
    borderColor: 'rgba(47, 140, 255, 0.18)',
  },

  allPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.4,
  },

  badge: {
    minWidth: 40,
    height: 40,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  badgeActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 6,
  },

  badgeText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.muted,
  },

  badgeTextActive: {
    color: '#FFFFFF',
  },
});