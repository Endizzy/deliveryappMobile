import React, { useMemo, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Menu as MenuIcon, List as ListIcon, User as UserIcon } from 'lucide-react-native';
import { useTheme } from './theme';
import { useT } from './i18n';

const TABS = {
  MENU: 'MENU',
  ALL: 'ALL',
  MY: 'MY',
};

// Кнопка вкладки с пружинным «отскоком» активной иконки.
const TabButton = ({ tab, label, Icon, isActive, onPress, COLORS, styles }) => {
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
      <Animated.View style={{ transform: [{ scale }] }}>
        <Icon
          width={22}
          height={22}
          color={isActive ? COLORS.primary : COLORS.muted}
          strokeWidth={2.2}
        />
      </Animated.View>
      <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const TabNavigationBar = ({ activeTab, onTabChange }) => {
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
