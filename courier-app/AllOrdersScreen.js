// AllOrdersScreen.js
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RotateCw } from 'lucide-react-native';

// Список точек выдачи — serverName должен совпадать со значением поля outlet в заказе
const OUTLETS = [
  { id: 'all',    name: 'Все точки',  serverName: null,              isAll: true },
  { id: 'briana', name: 'Briana',     serverName: 'Briana'                       },
  { id: 'saga',   name: 'Saga',       serverName: 'Saga'                         },
  { id: 'zep',    name: 'Зепчик',     serverName: 'Ziepniekkalns'                },
];

// outletCounts — объект { 'briana': 2, 'saga': 1, ... }
// Ключи должны быть в нижнем регистре (serverName.toLowerCase())
const AllOrdersScreen = ({
  useSafeArea   = true,
  onOpenOutlet,
  outletCounts  = {},  // << динамические счётчики из useOrdersWebSocket
}) => {

  // Считаем badge для каждой точки
  const getCount = (item) => {
    if (item.isAll) {
      return Object.values(outletCounts).reduce((sum, v) => sum + v, 0);
    }
    const key = (item.serverName || item.name || '').toLowerCase();
    return outletCounts[key] ?? 0;
  };

  const renderItem = ({ item }) => {
    const count = getCount(item);

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        style={[styles.card, item.isAll && styles.cardAll]}
        onPress={() => onOpenOutlet?.(item)}
      >
        <View style={styles.cardTitleWrapper}>
          <Text
            style={[styles.cardTitle, item.isAll && styles.cardTitleAll]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          {item.isAll && (
            <Text style={styles.cardSubtitle}>Все активные точки</Text>
          )}
        </View>

        <View style={[styles.badge, count > 0 && styles.badgeActive]}>
          <Text style={[styles.badgeText, count > 0 && styles.badgeTextActive]}>
            {count}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const content = (
    <>
      <StatusBar barStyle="light-content" />

      {/* ШАПКА */}
      <View style={styles.header}>
        <View style={styles.iconButton} />

        <View style={styles.headerTitleWrapper}>
          <Text style={styles.headerTitle}>Заказы</Text>
          <Text style={styles.headerSubtitle}>Выберите точку выдачи</Text>
        </View>

        <View style={styles.headerRightPlaceholder} />
      </View>

      {/* СПИСОК ТОЧЕК */}
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

const PRIMARY    = '#00B4D8';
const BACKGROUND = '#F4F6F8';

const styles = StyleSheet.create({
  safeArea: {
    flex:            1,
    backgroundColor: PRIMARY,
  },
  header: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingHorizontal: 20,
    paddingBottom:   16,
    paddingTop:      8,
  },
  iconButton: {
    width:           36,
    height:          36,
    borderRadius:    18,
    justifyContent:  'center',
    alignItems:      'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  headerTitleWrapper: {
    flex:       1,
    alignItems: 'center',
  },
  headerTitle: {
    color:      '#FFFFFF',
    fontSize:   18,
    fontWeight: '700',
  },
  headerSubtitle: {
    color:     'rgba(255,255,255,0.8)',
    fontSize:  12,
    marginTop: 2,
  },
  headerRightPlaceholder: {
    width:  36,
    height: 36,
  },
  content: {
    flex:                1,
    backgroundColor:     BACKGROUND,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop:          16,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom:     24,
  },
  card: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius:    18,
    backgroundColor: '#FFFFFF',
    marginBottom:    12,
    elevation:       2,
    shadowColor:     '#000',
    shadowOpacity:   0.06,
    shadowOffset:    { width: 0, height: 2 },
    shadowRadius:    6,
  },
  cardAll: {
    backgroundColor: '#E0F7FF',
  },
  cardTitleWrapper: { flex: 1 },
  cardTitle: {
    fontSize:   16,
    color:      '#1E293B',
    fontWeight: '500',
  },
  cardTitleAll: {
    fontWeight:    '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  cardSubtitle: {
    fontSize:  11,
    color:     '#64748B',
    marginTop: 3,
  },
  badge: {
    minWidth:        32,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius:    999,
    borderWidth:     1,
    borderColor:     PRIMARY,
    alignItems:      'center',
    justifyContent:  'center',
  },
  badgeActive: {
    backgroundColor: PRIMARY,
  },
  badgeText: {
    fontSize:   14,
    fontWeight: '600',
    color:      PRIMARY,
  },
  badgeTextActive: {
    color: '#fff',
  },
});