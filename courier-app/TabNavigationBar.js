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
  const tabBarPaddingBottom = Math.max(12, insets.bottom);

  return (
    <View style={[styles.tabBar, { paddingBottom: tabBarPaddingBottom }]}>
      <TouchableOpacity
        style={[styles.tabButton, activeTab === TABS.MENU && styles.tabButtonActive]}
        onPress={() => onTabChange(TABS.MENU)}
        accessibilityRole="button"
        accessibilityLabel="МЕНЮ"
      >
        <MenuIcon width={20} height={20} />
        <Text style={[styles.tabLabel, activeTab === TABS.MENU && styles.tabLabelActive]}>
          МЕНЮ
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tabButton, activeTab === TABS.ALL && styles.tabButtonActive]}
        onPress={() => onTabChange(TABS.ALL)}
        accessibilityRole="button"
        accessibilityLabel="ВСЕ"
      >
        <ListIcon width={20} height={20} />
        <Text style={[styles.tabLabel, activeTab === TABS.ALL && styles.tabLabelActive]}>
          ВСЕ
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tabButton, activeTab === TABS.MY && styles.tabButtonActive]}
        onPress={() => onTabChange(TABS.MY)}
        accessibilityRole="button"
        accessibilityLabel="МОИ"
      >
        <UserIcon width={20} height={20} />
        <Text style={[styles.tabLabel, activeTab === TABS.MY && styles.tabLabelActive]}>
          МОИ
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default TabNavigationBar;

export { TABS };

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e6e9ee',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  tabButtonActive: {
    backgroundColor: '#f0f6ff',
  },
  tabLabel: {
    fontSize: 12,
    marginTop: 4,
    color: '#444',
  },
  tabLabelActive: {
    color: '#007AFF',
    fontWeight: '700',
  },
});
