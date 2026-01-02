/**
 * Settings Screen
 * Server configuration, account info, and app settings
 */

import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
  Pressable,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { useAuth } from '../../src/context/AuthContext';
import { useSpaces } from '../../src/hooks/useOctopusQuery';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { colors as staticColors } from '../../src/theme/colors';
import { fontSize, spacing, borderRadius } from '../../src/theme/spacing';
import { maskApiKey, getCredentials } from '../../src/lib/security';
import { 
  getBiometricStatus, 
  getBiometricTypeName,
  getBiometricIcon,
  isBiometricEnabled,
  setBiometricEnabled,
  authenticateWithBiometrics,
  type BiometricType,
} from '../../src/lib/biometric';
import { useTheme } from '../../src/context/ThemeContext';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, serverVersion, licenseStatus, logout, isLoading } = useAuth();
  const { data: spaces } = useSpaces();
  const { mode, setThemeMode, colors } = useTheme();
  const [maskedKey, setMaskedKey] = useState<string>('');
  
  // Biometric state
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<BiometricType>('none');
  const [biometricEnabled, setBiometricEnabledState] = useState(false);

  // Load masked API key and biometric status on mount
  useEffect(() => {
    getCredentials().then(creds => {
      if (creds?.apiKey) {
        setMaskedKey(maskApiKey(creds.apiKey));
      }
    });
    
    // Check biometric status
    getBiometricStatus().then(status => {
      setBiometricAvailable(status.isAvailable && status.isEnrolled);
      setBiometricType(status.biometricType);
    });
    
    // Check if biometric is enabled
    isBiometricEnabled().then(enabled => {
      setBiometricEnabledState(enabled);
    });
  }, []);

  const handleBiometricToggle = useCallback(async (value: boolean) => {
    if (value) {
      // Verify biometric before enabling
      const result = await authenticateWithBiometrics(
        `Authenticate to enable ${getBiometricTypeName(biometricType)}`
      );
      
      if (result.success) {
        await setBiometricEnabled(true);
        setBiometricEnabledState(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert('Authentication Failed', result.error || 'Could not enable biometric login');
      }
    } else {
      await setBiometricEnabled(false);
      setBiometricEnabledState(false);
      Haptics.selectionAsync();
    }
  }, [biometricType]);

  const handleThemeChange = useCallback((newMode: 'light' | 'dark' | 'system') => {
    Haptics.selectionAsync();
    setThemeMode(newMode);
  }, [setThemeMode]);

  const handleLogout = useCallback(() => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? You will need to enter your API key again.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            logout();
          },
        },
      ]
    );
  }, [logout]);

  const openDocs = useCallback(() => {
    Linking.openURL('https://octopus.com/docs/octopus-rest-api');
  }, []);

  const openGitHub = useCallback(() => {
    Linking.openURL('https://github.com/OctopusDeploy');
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          
          <Card style={styles.accountCard}>
            <View style={styles.accountHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {user?.DisplayName?.charAt(0) || '?'}
                </Text>
              </View>
              <View style={styles.accountInfo}>
                <Text style={styles.displayName}>{user?.DisplayName || 'Unknown'}</Text>
                <Text style={styles.username}>@{user?.Username || 'unknown'}</Text>
              </View>
            </View>
            
            {user?.EmailAddress && (
              <View style={styles.accountRow}>
                <Text style={styles.rowLabel}>Email</Text>
                <Text style={styles.rowValue}>{user.EmailAddress}</Text>
              </View>
            )}
            
            <View style={styles.accountRow}>
              <Text style={styles.rowLabel}>API Key</Text>
              <Text style={styles.rowValue}>{maskedKey}</Text>
            </View>
          </Card>
        </View>

        {/* Server Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Server</Text>
          
          <Card>
            <View style={styles.serverRow}>
              <Text style={styles.rowLabel}>Version</Text>
              <Text style={styles.rowValue}>{serverVersion || 'Unknown'}</Text>
            </View>
            
            <View style={styles.serverRow}>
              <Text style={styles.rowLabel}>Spaces</Text>
              <Text style={styles.rowValue}>{spaces?.length || 0}</Text>
            </View>

            <View style={styles.serverRow}>
              <Text style={styles.rowLabel}>License</Text>
              <Text style={styles.rowValue}>{licenseStatus?.LicenseType || 'Unknown'}</Text>
            </View>
          </Card>
        </View>

        {/* Security Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          
          <Card>
            {biometricAvailable ? (
              <View style={styles.switchRow}>
                <View style={styles.switchRowLeft}>
                  <Ionicons 
                    name={getBiometricIcon(biometricType) as any} 
                    size={22} 
                    color={colors.octopus.primary} 
                    style={{ marginRight: spacing.sm }}
                  />
                  <View>
                    <Text style={styles.rowLabel}>{getBiometricTypeName(biometricType)}</Text>
                    <Text style={styles.rowHint}>Require biometric to open app</Text>
                  </View>
                </View>
                <Switch
                  value={biometricEnabled}
                  onValueChange={handleBiometricToggle}
                  trackColor={{ false: colors.border.default, true: colors.octopus.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
            ) : (
              <View style={styles.serverRow}>
                <Text style={styles.rowLabel}>Biometric Login</Text>
                <Text style={styles.rowValue}>Not available</Text>
              </View>
            )}
          </Card>
        </View>

        {/* Appearance Section - Theme toggle temporarily hidden until light mode is fixed */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          
          {/* <Card>
            <Text style={[styles.rowLabel, { marginBottom: spacing.sm }]}>Theme</Text>
            <View style={styles.themeButtons}>
              {(['system', 'light', 'dark'] as const).map((themeOption) => (
                <Pressable
                  key={themeOption}
                  onPress={() => handleThemeChange(themeOption)}
                  style={[
                    styles.themeButton,
                    mode === themeOption && styles.themeButtonActive,
                  ]}
                >
                  <Ionicons 
                    name={
                      themeOption === 'system' ? 'phone-portrait-outline' :
                      themeOption === 'light' ? 'sunny-outline' : 'moon-outline'
                    } 
                    size={18} 
                    color={mode === themeOption ? '#FFFFFF' : colors.text.secondary}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[
                    styles.themeButtonText,
                    mode === themeOption && styles.themeButtonTextActive,
                  ]}>
                    {themeOption.charAt(0).toUpperCase() + themeOption.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Card> */}
          
          <Pressable 
            style={styles.linkRow}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/customize-tabs');
            }}
          >
            <Ionicons name="options-outline" size={22} color={colors.octopus.primary} style={{ marginRight: spacing.sm }} />
            <Text style={styles.linkText}>Customise Navigation Tabs</Text>
            <Text style={styles.linkChevron}>›</Text>
          </Pressable>
        </View>

        {/* Resources Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resources</Text>
          
          <Pressable 
            style={styles.linkRow}
            onPress={openDocs}
          >
            <Ionicons name="document-text-outline" size={22} color={colors.octopus.primary} style={{ marginRight: spacing.sm }} />
            <Text style={styles.linkText}>API Documentation</Text>
            <Text style={styles.linkChevron}>›</Text>
          </Pressable>
          
          <Pressable 
            style={styles.linkRow}
            onPress={openGitHub}
          >
            <Ionicons name="logo-github" size={22} color={colors.octopus.primary} style={{ marginRight: spacing.sm }} />
            <Text style={styles.linkText}>Octopus Deploy GitHub</Text>
            <Text style={styles.linkChevron}>›</Text>
          </Pressable>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          
          <Card>
            <View style={styles.aboutContent}>
              <Text style={styles.appName}>OctoGo</Text>
              <Text style={styles.appVersion}>
                Version {Constants.expoConfig?.version || '1.0.0'}
              </Text>
              <Text style={styles.appDescription}>
                Unofficial mobile client for Octopus Deploy
              </Text>
            </View>
          </Card>
        </View>

        {/* Sign Out */}
        <View style={styles.section}>
          <Button
            title="Sign Out"
            onPress={handleLogout}
            variant="danger"
            loading={isLoading}
            fullWidth
          />
        </View>

        {/* Security Notice */}
        <View style={styles.securityNotice}>
          <Ionicons name="shield-checkmark" size={20} color={colors.status.info} style={{ marginRight: spacing.xs }} />
          <Text style={styles.securityText}>
            Your API key is stored securely using encrypted device storage and is never transmitted to third parties.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: staticColors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    color: staticColors.text.secondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  accountCard: {
    padding: spacing.md,
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: staticColors.border.muted,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: staticColors.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    color: staticColors.white,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  accountInfo: {
    flex: 1,
  },
  displayName: {
    color: staticColors.text.primary,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  username: {
    color: staticColors.text.secondary,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  serverRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  rowLabel: {
    color: staticColors.text.secondary,
    fontSize: fontSize.md,
  },
  rowValue: {
    color: staticColors.text.primary,
    fontSize: fontSize.md,
    fontWeight: '500',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: staticColors.background.secondary,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: staticColors.border.muted,
  },
  linkText: {
    color: staticColors.text.primary,
    fontSize: fontSize.md,
    flex: 1,
  },
  linkChevron: {
    color: staticColors.text.tertiary,
    fontSize: fontSize.xl,
  },
  aboutContent: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  appName: {
    color: staticColors.text.primary,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  appVersion: {
    color: staticColors.text.secondary,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  appDescription: {
    color: staticColors.text.tertiary,
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    backgroundColor: staticColors.status.infoDim,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  securityText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: staticColors.text.secondary,
    lineHeight: 20,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  switchRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rowHint: {
    color: staticColors.text.muted,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  themeButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  themeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: staticColors.background.tertiary,
    borderWidth: 1,
    borderColor: staticColors.border.muted,
  },
  themeButtonActive: {
    backgroundColor: staticColors.octopus.primary,
    borderColor: staticColors.octopus.primary,
  },
  themeButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: staticColors.text.secondary,
  },
  themeButtonTextActive: {
    color: '#FFFFFF',
  },
});
