import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Menu as MenuIcon, List as ListIcon, User as UserIcon } from 'lucide-react-native';

const TABS = {
  MENU: 'MENU',
  ALL: 'ALL',
  MY: 'MY',
};

const TabNavigationBar = ({ activeTab, onTabChange }) => {
  const insets = useSafeAreaInsets();

  const bottomInset = Math.max(insets.bottom, 8);

  const renderTab = (tab, label, Icon) => {
    const isActive = activeTab === tab;

    return (
      <TouchableOpacity
        key={tab}
        style={[styles.tabButton, isActive && styles.tabButtonActive]}
        onPress={() => onTabChange(tab)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Icon
          width={22}
          height={22}
          color={isActive ? '#2F8CFF' : '#8FA3B8'}
          strokeWidth={2.2}
        />
        <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.outerWrapper, { paddingBottom: bottomInset }]}>
      <View style={styles.tabBar}>
        {renderTab(TABS.MENU, 'МЕНЮ', MenuIcon)}
        {renderTab(TABS.ALL, 'ВСЕ', ListIcon)}
        {renderTab(TABS.MY, 'МОИ', UserIcon)}
      </View>
    </View>
  );
};

export default TabNavigationBar;
export { TABS };

const styles = StyleSheet.create({
  outerWrapper: {
    backgroundColor: '#010B13',
    paddingHorizontal: 16,
    // paddingTop: 10,
  },

  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,

    // paddingHorizontal: 8,
    // paddingVertical: 8,

    shadowColor: '#000',
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
    backgroundColor: '#0B1722',
    borderWidth: 1,
    borderColor: 'rgba(47, 140, 255, 0.22)',
  },

  tabLabel: {
    fontSize: 12,
    // marginTop: 6,
    color: '#8FA3B8',
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  tabLabelActive: {
    color: '#2F8CFF',
    fontWeight: '800',
  },
});