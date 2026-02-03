/**
 * Tab Navigation Layout
 * Main app navigation with bottom tabs
 */

import React, { useCallback } from 'react';
import { View, Pressable, Text, Platform, StyleSheet } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { DrawerMenu } from '../../src/components/DrawerMenu';
import { HeaderBrand } from '../../src/components/HeaderBrand';
import { useAuth } from '../../src/context/AuthContext';
import { useColors } from '../../src/context/ThemeContext';
import { DrawerProvider, useDrawer } from '../../src/context/DrawerContext';
import { useTabCustomization } from '../../src/context/TabCustomizationContext';
import { useNotifications } from '../../src/context/NotificationsContext';
import { fontSize, spacing, borderRadius } from '../../src/theme/spacing';

type IconName = keyof typeof Ionicons.glyphMap;

interface TabIconProps {
  name: IconName;
  focusedName: IconName;
  focused: boolean;
  color: string;
}

function TabsLayoutContent() {
  const router = useRouter();
  const { isEnterprise } = useAuth();
  const colors = useColors();
  const { isDrawerOpen, openDrawer, closeDrawer } = useDrawer();
  const { selectedTabs } = useTabCustomization();
  const { totalCount: notificationCount } = useNotifications();
  
  const handleOpenDrawer = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    openDrawer();
  }, [openDrawer]);
  
  const goToSettings = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/settings');
  }, [router]);

  const goToNotifications = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/notifications' as any);
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
      onPress={handleOpenDrawer}
      style={{
        padding: spacing.sm,
      }}
      hitSlop={8}
    >
      <Ionicons name="menu-outline" size={24} color={colors.text.secondary} />
    </Pressable>
  );

  // Notification bell button with badge
  const NotificationButton = () => (
    <Pressable 
      onPress={goToNotifications}
      style={headerStyles.notificationButton}
      hitSlop={8}
    >
      <Ionicons 
        name={notificationCount > 0 ? 'notifications' : 'notifications-outline'} 
        size={22} 
        color={notificationCount > 0 ? colors.brand.primary : colors.text.secondary} 
      />
      {notificationCount > 0 && (
        <View style={[headerStyles.badge, { backgroundColor: colors.status.error }]}>
          <Text style={headerStyles.badgeText}>
            {notificationCount > 9 ? '9+' : notificationCount}
          </Text>
        </View>
      )}
    </Pressable>
  );

  // Settings cog button for header right  
  const HeaderRight = () => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      <NotificationButton />
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
      <DrawerMenu visible={isDrawerOpen} onClose={closeDrawer} />
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
          height: Platform.OS === 'android' ? 56 : 70,
          paddingTop: Platform.OS === 'android' ? spacing.xs : spacing.sm,
          paddingBottom: Platform.OS === 'android' ? spacing.xs : spacing.sm,
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.brand.primary,
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarHideOnKeyboard: true,
      }}
    >
      {/* Dashboard - always needs to be defined for routing */}
      <Tabs.Screen
        name="index"
        options={{
          href: selectedTabs.some(t => t.id === 'dashboard') ? '/' : null,
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
      
      {/* Projects */}
      <Tabs.Screen
        name="projects"
        options={{
          href: selectedTabs.some(t => t.id === 'projects') ? '/projects' : null,
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
      
      {/* Deployments/Tasks */}
      <Tabs.Screen
        name="deployments"
        options={{
          href: selectedTabs.some(t => t.id === 'deployments') ? '/deployments' : null,
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
      
      {/* Search */}
      <Tabs.Screen
        name="search"
        options={{
          href: selectedTabs.some(t => t.id === 'search') ? '/search' : null,
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
      
      {/* Runbooks */}
      <Tabs.Screen
        name="runbooks"
        options={{
          href: selectedTabs.some(t => t.id === 'runbooks') ? '/runbooks' : null,
          title: 'Runbooks',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon 
              name="book-outline" 
              focusedName="book" 
              focused={focused} 
              color={color}
            />
          ),
        }}
      />
      
      {/* Targets */}
      <Tabs.Screen
        name="targets"
        options={{
          href: selectedTabs.some(t => t.id === 'targets') ? '/targets' : null,
          title: 'Targets',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon 
              name="server-outline" 
              focusedName="server" 
              focused={focused} 
              color={color}
            />
          ),
        }}
      />
      
      {/* Environments */}
      <Tabs.Screen
        name="environments"
        options={{
          href: selectedTabs.some(t => t.id === 'environments') ? '/environments' : null,
          title: 'Environments',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon 
              name="layers-outline" 
              focusedName="layers" 
              focused={focused} 
              color={color}
            />
          ),
        }}
      />
      
      {/* Events/Audit Log */}
      <Tabs.Screen
        name="events"
        options={{
          href: selectedTabs.some(t => t.id === 'events') ? '/events' : null,
          title: 'Audit Log',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon 
              name="time-outline" 
              focusedName="time" 
              focused={focused} 
              color={color}
            />
          ),
        }}
      />
      
      {/* Insights */}
      <Tabs.Screen
        name="insights"
        options={{
          href: (isEnterprise && selectedTabs.some(t => t.id === 'insights')) ? '/insights' : null,
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
      
      {/* Tenants */}
      <Tabs.Screen
        name="tenants"
        options={{
          href: selectedTabs.some(t => t.id === 'tenants') ? '/tenants' : null,
          title: 'Tenants',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon 
              name="business-outline" 
              focusedName="business" 
              focused={focused} 
              color={color}
            />
          ),
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

const headerStyles = StyleSheet.create({
  notificationButton: {
    padding: spacing.sm,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});

export default function TabsLayout() {
  return (
    <DrawerProvider>
      <TabsLayoutContent />
    </DrawerProvider>
  );
}
