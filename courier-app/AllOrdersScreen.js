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

const OUTLETS = [
  { id: 'all', name: 'Все точки', count: 0, isAll: true },
  { id: 'briana', name: 'Briana', count: 0 },
  { id: 'saga', name: 'Saga', count: 0 },
  { id: 'zepchik', name: 'Зепчик', count: 0 },
];

const AllOrdersScreen = ({ useSafeArea = true }) => {
  const handleRefresh = () => {
    // TODO: запрос обновления точек
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.8}
      style={[styles.card, item.isAll && styles.cardAll]}
      // onPress={() => {}}
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

      <View style={styles.badge}>
        <Text style={styles.badgeText}>{item.count}</Text>
      </View>
    </TouchableOpacity>
  );

  const content = (
    <>
      <StatusBar barStyle="light-content" />
      {/* ШАПКА */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleRefresh}
          style={styles.iconButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <RotateCw size={22} strokeWidth={2.2} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrapper}>
          <Text style={styles.headerTitle}>Предприятие</Text>
          <Text style={styles.headerSubtitle}>id 6741</Text>
        </View>

        <View style={styles.headerRightPlaceholder} />
      </View>

      {/* КОНТЕНТ */}
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

//   if (useSafeArea) {
//     return (
//       <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
//         {content}
//       </SafeAreaView>
//     );
//   }

  return (
    <View style={styles.safeArea}>
      {content}
    </View>
  );
};

export default AllOrdersScreen;

const PRIMARY = '#00B4D8';
const BACKGROUND = '#F4F6F8';

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PRIMARY,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  headerTitleWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  headerRightPlaceholder: {
    width: 36,
    height: 36,
  },
  content: {
    flex: 1,
    backgroundColor: BACKGROUND,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  cardAll: {
    backgroundColor: '#E0F7FF',
  },
  cardTitleWrapper: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '500',
  },
  cardTitleAll: {
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  cardSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 3,
  },
  badge: {
    minWidth: 32,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: PRIMARY,
  },
});
