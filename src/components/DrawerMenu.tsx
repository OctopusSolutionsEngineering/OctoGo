/**
 * DrawerMenu Component
 * Full navigation menu that slides in from the left
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useColors } from '../context/ThemeContext';
import { SpaceSelector } from './SpaceSelector';
import { InstanceSelector } from './InstanceSelector';
import { fontSize, spacing, borderRadius } from '../theme/spacing';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH * 0.85;

const octoGoLogo = require('../../assets/icon.png');

interface MenuItem {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconFilled: keyof typeof Ionicons.glyphMap;
  route: string;
  badge?: number;
}

interface MenuSection {
  title?: string;
  items: MenuItem[];
}

interface DrawerMenuProps {
  visible: boolean;
  onClose: () => void;
}

export const DrawerMenu: React.FC<DrawerMenuProps> = ({ visible, onClose }) => {
  const router = useRouter();
  const pathname = usePathname();
  const colors = useColors();
  const { user, isEnterprise, logout, instances, currentInstance } = useAuth();
  const hasMultipleInstances = instances.length > 1;
  const insets = useSafeAreaInsets();
  
  // Track if modal should be shown (delayed hide for exit animation)
  const [showModal, setShowModal] = React.useState(false);

  const slideAnim = React.useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      // Show modal immediately, then animate in
      setShowModal(true);
      // Reset position before animating (in case it was mid-animation)
      slideAnim.setValue(-DRAWER_WIDTH);
      backdropAnim.setValue(0);
      
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (showModal) {
      // Animate out, then hide modal
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowModal(false);
      });
    }
  }, [visible]);

  const menuSections: MenuSection[] = [
    {
      title: 'Main',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: 'grid-outline', iconFilled: 'grid', route: '/' },
        { id: 'projects', label: 'Projects', icon: 'cube-outline', iconFilled: 'cube', route: '/projects' },
        { id: 'deployments', label: 'Task Log', icon: 'rocket-outline', iconFilled: 'rocket', route: '/deployments' },
        { id: 'search', label: 'Search', icon: 'search-outline', iconFilled: 'search', route: '/search' },
      ],
    },
    {
      title: 'Operations',
      items: [
        { id: 'runbooks', label: 'Runbooks', icon: 'book-outline', iconFilled: 'book', route: '/runbooks' },
        { id: 'targets', label: 'Targets', icon: 'server-outline', iconFilled: 'server', route: '/targets' },
        { id: 'environments', label: 'Environments', icon: 'layers-outline', iconFilled: 'layers', route: '/environments' },
        { id: 'tenants', label: 'Tenants', icon: 'business-outline', iconFilled: 'business', route: '/tenants' },
        { id: 'events', label: 'Audit Log', icon: 'time-outline', iconFilled: 'time', route: '/events' },
        ...(isEnterprise ? [{ id: 'insights', label: 'Insights', icon: 'analytics-outline' as keyof typeof Ionicons.glyphMap, iconFilled: 'analytics' as keyof typeof Ionicons.glyphMap, route: '/insights' }] : []),
      ],
    },
  ];

  const handleNavigate = useCallback((route: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
    setTimeout(() => {
      router.push(route as any);
    }, 100);
  }, [router, onClose]);

  const handleLogout = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
    await logout();
  }, [logout, onClose]);

  const isActive = (route: string) => {
    if (route === '/') return pathname === '/' || pathname === '/index';
    return pathname.startsWith(route);
  };

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      flexDirection: 'row',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    drawer: {
      width: DRAWER_WIDTH,
      backgroundColor: colors.background.secondary,
      borderRightWidth: 1,
      borderRightColor: colors.border.muted,
    },
    safeArea: {
      flex: 1,
    },
    header: {
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.muted,
    },
    logoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    logoContainer: {
      width: 44,
      height: 44,
      borderRadius: borderRadius.md,
      overflow: 'hidden',
      marginRight: spacing.md,
    },
    logo: {
      width: 44,
      height: 44,
    },
    appName: {
      color: colors.text.primary,
      fontSize: fontSize.xl,
      fontWeight: '800',
    },
    userInfo: {
      marginBottom: spacing.md,
    },
    userName: {
      color: colors.text.primary,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    userEmail: {
      color: colors.text.secondary,
      fontSize: fontSize.sm,
      marginTop: 2,
    },
    content: {
      flex: 1,
    },
    section: {
      paddingTop: spacing.md,
    },
    sectionTitle: {
      color: colors.text.tertiary,
      fontSize: fontSize.xs,
      fontWeight: '600',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.sm,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      marginHorizontal: spacing.sm,
      borderRadius: borderRadius.md,
    },
    menuItemActive: {
      backgroundColor: colors.brand.primary + '15',
    },
    menuIcon: {
      width: 32,
      alignItems: 'center',
    },
    menuLabel: {
      color: colors.text.primary,
      fontSize: fontSize.md,
      marginLeft: spacing.sm,
      flex: 1,
    },
    menuLabelActive: {
      color: colors.brand.primary,
      fontWeight: '600',
    },
    badge: {
      backgroundColor: colors.status.error,
      borderRadius: 10,
      paddingHorizontal: 6,
      paddingVertical: 2,
      minWidth: 20,
      alignItems: 'center',
    },
    badgeText: {
      color: colors.white,
      fontSize: fontSize.xs,
      fontWeight: '600',
    },
    footer: {
      padding: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.border.muted,
    },
    logoutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.md,
      backgroundColor: colors.background.tertiary,
      borderRadius: borderRadius.md,
    },
    logoutText: {
      color: colors.status.error,
      fontSize: fontSize.md,
      fontWeight: '600',
      marginLeft: spacing.sm,
    },
    closeButton: {
      position: 'absolute',
      top: spacing.md,
      right: spacing.md,
      padding: spacing.sm,
    },
  });

  if (!showModal) return null;

  return (
    <Modal
      visible={showModal}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View 
          style={[styles.backdrop, { opacity: backdropAnim }]}
        >
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>
        
        <Animated.View 
          style={[
            styles.drawer, 
            { 
              transform: [{ translateX: slideAnim }],
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
              paddingLeft: insets.left,
            }
          ]}
        >
          <View style={styles.safeArea}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.logoRow}>
                <View style={styles.logoContainer}>
                  <Image source={octoGoLogo} style={styles.logo} resizeMode="contain" />
                </View>
                <Text style={styles.appName}>OctoGo</Text>
              </View>
              
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user?.DisplayName || 'User'}</Text>
                {user?.EmailAddress && (
                  <Text style={styles.userEmail}>{user.EmailAddress}</Text>
                )}
              </View>
              
              {/* Instance Selector - show if multiple instances or always allow adding */}
              <InstanceSelector onInstanceSwitch={onClose} />

              <SpaceSelector />
            </View>

            {/* Navigation */}
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {menuSections.map((section, sectionIndex) => (
                <View key={sectionIndex} style={styles.section}>
                  {section.title && (
                    <Text style={styles.sectionTitle}>{section.title}</Text>
                  )}
                  {section.items.map((item) => {
                    const active = isActive(item.route);
                    return (
                      <Pressable
                        key={item.id}
                        style={[styles.menuItem, active && styles.menuItemActive]}
                        onPress={() => handleNavigate(item.route)}
                      >
                        <View style={styles.menuIcon}>
                          <Ionicons
                            name={active ? item.iconFilled : item.icon}
                            size={22}
                            color={active ? colors.brand.primary : colors.text.secondary}
                          />
                        </View>
                        <Text style={[styles.menuLabel, active && styles.menuLabelActive]}>
                          {item.label}
                        </Text>
                        {item.badge && item.badge > 0 && (
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>{item.badge}</Text>
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
              <Pressable style={styles.logoutButton} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={20} color={colors.status.error} />
                <Text style={styles.logoutText}>Sign Out</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

