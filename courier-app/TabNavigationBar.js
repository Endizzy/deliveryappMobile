import React, { useMemo, useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Menu as MenuIcon, List as ListIcon, User as UserIcon } from 'lucide-react-native';
import { useTheme } from './theme';
import { useT } from './i18n';

const TABS = {
  MENU: 'MENU',
  ALL: 'ALL',
  MY: 'MY',
};

// Сколько секунд счётчик «горит» после появления нового заказа
const ALERT_MS = 4000;
// Больше не влезает в кружок, да и точное число уже неважно
const MAX_COUNT = 99;

/**
 * Счётчик заказов на вкладке.
 *
 * В покое — спокойный акцентный кружок. Когда число выросло (приехал заказ),
 * он подпрыгивает, краснеет и несколько секунд пульсирует расходящимся кольцом:
 * курьер замечает это боковым зрением, даже находясь в другой вкладке. Затем
 * badge сам успокаивается, чтобы не мельтешить всю смену.
 */
const TabBadge = ({ count, COLORS, styles }) => {
    const prev = useRef(count);
    const [alert, setAlert] = useState(false);

    const pop = useRef(new Animated.Value(1)).current;
    const ring = useRef(new Animated.Value(0)).current;

    // Реагируем только на РОСТ: уменьшение (заказ взяли/закрыли) — обычное дело
    useEffect(() => {
        const grew = count > prev.current;
        prev.current = count;
        if (!grew) return;

        setAlert(true);
        pop.setValue(0.4);
        Animated.spring(pop, {
            toValue: 1,
            useNativeDriver: true,
            speed: 14,
            bounciness: 16,
        }).start();

        const tm = setTimeout(() => setAlert(false), ALERT_MS);
        return () => clearTimeout(tm);
    }, [count]);

    useEffect(() => {
        if (!alert) { ring.stopAnimation(); ring.setValue(0); return; }
        const loop = Animated.loop(
            Animated.timing(ring, {
                toValue: 1,
                duration: 1800,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
            })
        );
        loop.start();
        return () => loop.stop();
    }, [alert]);

    if (!count || count <= 0) return null; // ноль не показываем — выглядит как ошибка

    const text = count > MAX_COUNT ? `${MAX_COUNT}+` : String(count);
    const bg = alert ? COLORS.danger : COLORS.primary;

    return (
        <View style={styles.badgeWrap} pointerEvents="none">
            {alert && (
                <Animated.View
                    style={[
                        styles.badgeRing,
                        {
                            borderColor: COLORS.danger,
                            opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
                            transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.9] }) }],
                        },
                    ]}
                />
            )}
            <Animated.View
                style={[
                    styles.badge,
                    { backgroundColor: bg, borderColor: COLORS.surface, transform: [{ scale: pop }] },
                ]}
            >
                <Text style={styles.badgeText} numberOfLines={1}>{text}</Text>
            </Animated.View>
        </View>
    );
};

// Кнопка вкладки с пружинным «отскоком» активной иконки.
const TabButton = ({ tab, label, Icon, isActive, onPress, COLORS, styles, count = 0 }) => {
  const scale = useRef(new Animated.Value(isActive ? 1 : 0.9)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: isActive ? 1 : 0.9,
      useNativeDriver: true,
      speed: 18,
      bounciness: 12,
    }).start();
  }, [isActive]);

  return (
    <TouchableOpacity
      style={[styles.tabButton, isActive && styles.tabButtonActive]}
      onPress={() => onPress(tab)}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.iconWrap, { transform: [{ scale }] }]}>
        <Icon
          width={22}
          height={22}
          color={isActive ? COLORS.primary : COLORS.muted}
          strokeWidth={2.2}
        />
        <TabBadge count={count} COLORS={COLORS} styles={styles} />
      </Animated.View>
      <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const TabNavigationBar = ({ activeTab, onTabChange, counts = null }) => {
  const insets = useSafeAreaInsets();
  const { colors: COLORS } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const bottomInset = Math.max(insets.bottom, 8);

  const items = [
    { tab: TABS.MENU, label: t('tabs.menu'), Icon: MenuIcon },
    { tab: TABS.ALL, label: t('tabs.all'), Icon: ListIcon },
    { tab: TABS.MY, label: t('tabs.my'), Icon: UserIcon },
  ];

  return (
    <View style={[styles.outerWrapper, { paddingBottom: bottomInset }]}>
      <View style={styles.tabBar}>
        {items.map(({ tab, label, Icon }) => (
          <TabButton
            key={tab}
            tab={tab}
            label={label}
            Icon={Icon}
            isActive={activeTab === tab}
            onPress={onTabChange}
            COLORS={COLORS}
            styles={styles}
            count={counts?.[tab] ?? 0}
          />
        ))}
      </View>
    </View>
  );
};

export default TabNavigationBar;
export { TABS };

const makeStyles = (COLORS) => StyleSheet.create({
  outerWrapper: {
    backgroundColor: COLORS.bg,
    paddingHorizontal: 16,
    // paddingTop: 10,
  },

  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 24,

    // paddingHorizontal: 8,
    // paddingVertical: 8,

    shadowColor: COLORS.shadow,
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 10,
  },

  tabButton: {
    flex: 1,
    minHeight: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },

  tabButtonActive: {
    backgroundColor: COLORS.ghost,
    borderWidth: 1,
    borderColor: COLORS.softBlueStrong,
  },

  // Иконка — точка отсчёта для badge, поэтому обёртка с relative-позицией
  iconWrap: {
    position: 'relative',
  },

  badgeWrap: {
    position: 'absolute',
    top: -6,
    right: -10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  badge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 999,
    borderWidth: 2,          // отбивка от иконки, чтобы число читалось
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Расходящееся кольцо: живёт только пока счётчик «горит»
  badgeRing: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
  },

  badgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#0B1220',
    includeFontPadding: false,
  },

  tabLabel: {
    fontSize: 12,
    // marginTop: 6,
    color: COLORS.muted,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  tabLabelActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },
});
