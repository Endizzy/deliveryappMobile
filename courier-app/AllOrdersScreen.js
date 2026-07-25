
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
import { useTheme } from './theme';
import { useT } from './i18n';
import FadeInView from './components/anim/FadeInView';
import PressableScale from './components/anim/PressableScale';

const AllOrdersScreen = ({
  useSafeArea = true,
  onOpenOutlet,
  outlets = [],
  totalCount = 0,
}) => {
  const { colors: COLORS } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  // Карточка «Все точки» + динамические точки из заказов
  const data = useMemo(
    () => [{ id: 'all', name: t('allOrders.allOutlets'), isAll: true }, ...outlets],
    [outlets, t]
  );

  const getCount = (item) => (item.isAll ? totalCount : (item.count ?? 0));

  const renderItem = ({ item, index }) => {
    const count = getCount(item);
    const isActive = count > 0;

    return (
      <FadeInView index={index}>
        <PressableScale
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
                {item.isAll ? t('allOrders.allOutlets') : item.name}
              </Text>

              {item.isAll && (
                <View style={styles.allPill}>
                  <Text style={styles.allPillText}>{t('allOrders.allPill')}</Text>
                </View>
              )}
            </View>

            <Text style={styles.cardSubtitle}>
              {item.isAll ? t('allOrders.allActive') : t('allOrders.openList')}
            </Text>
          </View>

          <View style={[styles.badge, isActive && styles.badgeActive]}>
            <Text style={[styles.badgeText, isActive && styles.badgeTextActive]}>
              {count}
            </Text>
          </View>
        </View>
        </PressableScale>
      </FadeInView>
    );
  };

  const content = (
    <>
      <StatusBar barStyle={COLORS.statusBar} backgroundColor={COLORS.bg} />

      {/* <View style={styles.bgCircleTop} pointerEvents="none" />
      <View style={styles.bgCircleBottom} pointerEvents="none" /> */}

      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('allOrders.title')}</Text>
        <Text style={styles.headerSubtitle}>{t('allOrders.subtitle')}</Text>
      </View>

      <View style={styles.content}>
        <FlatList
          data={data}
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

const makeStyles = (COLORS) => StyleSheet.create({
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
    shadowColor: COLORS.shadow,
    shadowOpacity: Platform.OS === 'ios' ? 0.35 : 0.25,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 22,
    elevation: 10,
  },

  cardAll: {
    backgroundColor: COLORS.cardAlt,
    borderColor: COLORS.softBlueBorder,
  },

  cardWithOrders: {
    borderColor: COLORS.softBlueBorder,
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
    borderColor: COLORS.softBlueBorder,
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
    borderColor: COLORS.lineStrong,
    backgroundColor: COLORS.softGray,
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
    color: COLORS.onPrimary,
  },
});