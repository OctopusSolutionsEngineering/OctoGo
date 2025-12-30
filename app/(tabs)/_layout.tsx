/**
 * Tab Navigation Layout
 * Main app navigation with bottom tabs
 */

import React, { useState, useCallback } from 'react';
import { View, Pressable, Text } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { DrawerMenu } from '../../src/components/DrawerMenu';
import { HeaderBrand } from '../../src/components/HeaderBrand';
import { useAuth } from '../../src/context/AuthContext';
import { useColors } from '../../src/context/ThemeContext';
import { fontSize, spacing } from '../../src/theme/spacing';

type IconName = keyof typeof Ionicons.glyphMap;

interface TabIconProps {
  name: IconName;
  focusedName: IconName;
  focused: boolean;
  color: string;
}

export default function TabsLayout() {
  const router = useRouter();
  const { isEnterprise } = useAuth();
  const colors = useColors();
  const [drawerVisible, setDrawerVisible] = useState(false);
  
  const openDrawer = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDrawerVisible(true);
  }, []);
  
  const closeDrawer = useCallback(() => {
    setDrawerVisible(false);
  }, []);
  
  const goToSettings = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/settings');
  }, [router]);
  
  // Icons only, purple when active
  const TabIcon: React.FC<TabIconProps> = ({ name, focusedName, focused }) => (
    <Ionicons 
      name={focused ? focusedName : name} 
      size={28} 
      color={focused ? colors.brand.primary : colors.text.tertiary}
    />
  );

  // Brand on the left (large)
  const HeaderLeftBrand = () => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <HeaderBrand size="large" />
    </View>
  );

  // Hamburger menu button (for drawer access)
  const MenuButton = () => (
    <Pressable 
      onPress={openDrawer}
      style={{
        padding: spacing.sm,
      }}
      hitSlop={8}
    >
      <Ionicons name="menu-outline" size={24} color={colors.text.secondary} />
    </Pressable>
  );

  // Settings cog button for header right  
  const HeaderRight = () => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      <MenuButton />
      <Pressable 
        onPress={goToSettings}
        style={{
          padding: spacing.sm,
        }}
        hitSlop={8}
      >
        <Ionicons name="settings-outline" size={22} color={colors.text.secondary} />
      </Pressable>
    </View>
  );
  
  return (
    <>
      <DrawerMenu visible={drawerVisible} onClose={closeDrawer} />
      <Tabs
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.background.secondary,
            borderBottomWidth: 1,
            borderBottomColor: colors.border.muted,
            height: 110, // Taller header for larger branding
          },
          headerTitleStyle: {
            color: colors.text.primary,
            fontWeight: '600',
            fontSize: fontSize.lg,
          },
          headerTitleAlign: 'left',
          headerTintColor: colors.text.primary,
          headerTitle: () => null,
          headerLeft: () => <HeaderLeftBrand />,
          headerRight: () => <HeaderRight />,
          headerLeftContainerStyle: {
            paddingLeft: spacing.md,
          },
          headerRightContainerStyle: {
            paddingRight: spacing.md,
          },
        tabBarStyle: {
          backgroundColor: colors.background.secondary,
          borderTopWidth: 1,
          borderTopColor: colors.border.muted,
          height: 70,
          paddingTop: spacing.sm,
          paddingBottom: spacing.sm,
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.brand.primary,
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon 
              name="grid-outline" 
              focusedName="grid" 
              focused={focused} 
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: 'Projects',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon 
              name="cube-outline" 
              focusedName="cube" 
              focused={focused} 
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="deployments"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon 
              name="rocket-outline" 
              focusedName="rocket" 
              focused={focused} 
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon 
              name="search-outline" 
              focusedName="search" 
              focused={focused} 
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="runbooks"
        options={{
          href: null, // Accessible via drawer menu
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          href: null, // Accessible via drawer menu
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          // Only show Insights tab for Enterprise/Unlimited licenses
          href: isEnterprise ? '/insights' : null,
          title: 'Insights',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon 
              name="analytics-outline" 
              focusedName="analytics" 
              focused={focused} 
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="environments"
        options={{
          href: null, // Accessible via drawer menu
        }}
      />
      <Tabs.Screen
        name="targets"
        options={{
          href: null, // Accessible via drawer menu and home screen
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null, // Accessible via header cog icon
          title: 'Settings',
          headerTitle: 'Settings', // Show "Settings" as title
          headerLeft: undefined, // Use default back button
          headerRight: () => null, // No cog on settings page itself
        }}
      />
    </Tabs>
    </>
  );
}
