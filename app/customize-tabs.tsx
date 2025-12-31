/**
 * Tab Customization Screen
 * Allows users to select which tabs appear in bottom navigation (max 4)
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTabCustomization } from '../src/context/TabCustomizationContext';
import { useAuth } from '../src/context/AuthContext';
import { Card } from '../src/components/ui/Card';
import { Button } from '../src/components/ui/Button';
import { colors } from '../src/theme/colors';
import { fontSize, spacing, borderRadius } from '../src/theme/spacing';

export default function CustomizeTabsScreen() {
  const { 
    availableTabs, 
    selectedTabIds, 
    toggleTab, 
    canAddMoreTabs, 
    isTabSelected,
    resetToDefaults,
  } = useTabCustomization();
  const { isEnterprise } = useAuth();

  const handleToggleTab = useCallback(async (tabId: string) => {
    const isSelected = isTabSelected(tabId);
    
    // Check if trying to remove the last tab
    if (isSelected && selectedTabIds.length === 1) {
      Alert.alert(
        'Cannot Remove',
        'You must have at least one tab in the navigation.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    // Check if trying to add when at max
    if (!isSelected && !canAddMoreTabs) {
      Alert.alert(
        'Maximum Reached',
        'You can only have up to 4 tabs in the navigation. Remove a tab first.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await toggleTab(tabId);
  }, [isTabSelected, selectedTabIds.length, canAddMoreTabs, toggleTab]);

  const handleReset = useCallback(() => {
    Alert.alert(
      'Reset Navigation',
      'Reset to default tabs (Dashboard, Projects, Tasks, Search)?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await resetToDefaults();
          },
        },
      ]
    );
  }, [resetToDefaults]);

  // Filter out enterprise-only tabs if user doesn't have enterprise
  const visibleTabs = availableTabs.filter(tab => 
    !tab.requiresEnterprise || isEnterprise
  );

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'Customise Navigation',
          headerShown: true,
          headerStyle: { backgroundColor: colors.background.secondary },
          headerTintColor: colors.text.primary,
        }} 
      />
      
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
        >

          {/* Counter */}
          <View style={styles.counterCard}>
            <Text style={styles.counterText}>
              {selectedTabIds.length} / 4 tabs selected
            </Text>
            {!canAddMoreTabs && (
              <Text style={styles.counterHint}>
                Maximum reached
              </Text>
            )}
          </View>

          {/* Tab Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Available Tabs</Text>
            
            <View style={styles.tabList}>
              {visibleTabs.map((tab) => {
                const selected = isTabSelected(tab.id);
                
                return (
                  <Pressable
                    key={tab.id}
                    onPress={() => handleToggleTab(tab.id)}
                    style={[
                      styles.tabItem,
                      selected && styles.tabItemSelected,
                    ]}
                  >
                    <View style={styles.tabItemLeft}>
                      <View style={[
                        styles.tabIconContainer,
                        selected && styles.tabIconContainerSelected,
                      ]}>
                        <Ionicons 
                          name={selected ? tab.iconFilled : tab.icon} 
                          size={24} 
                          color={selected ? colors.white : colors.text.secondary}
                        />
                      </View>
                      <View style={styles.tabItemInfo}>
                        <Text style={[
                          styles.tabItemLabel,
                          selected && styles.tabItemLabelSelected,
                        ]}>
                          {tab.label}
                        </Text>
                        {tab.requiresEnterprise && (
                          <Text style={styles.enterpriseBadge}>Enterprise</Text>
                        )}
                      </View>
                    </View>
                    
                    <View style={[
                      styles.checkbox,
                      selected && styles.checkboxSelected,
                    ]}>
                      {selected && (
                        <Ionicons name="checkmark" size={18} color={colors.white} />
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Preview */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Preview</Text>
            <Card style={styles.previewCard}>
              <View style={styles.previewNav}>
                {selectedTabIds.map((tabId) => {
                  const tab = availableTabs.find(t => t.id === tabId);
                  if (!tab) return null;
                  
                  return (
                    <View key={tab.id} style={styles.previewTab}>
                      <Ionicons 
                        name={tab.iconFilled} 
                        size={24} 
                        color={colors.brand.primary}
                      />
                      <Text style={styles.previewTabLabel} numberOfLines={1}>
                        {tab.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </Card>
          </View>

          {/* Reset Button */}
          <View style={styles.section}>
            <Button
              title="Reset to Default"
              onPress={handleReset}
              variant="secondary"
              fullWidth
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
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
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  counterCard: {
    backgroundColor: colors.background.secondary,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.muted,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  counterText: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text.primary,
  },
  counterHint: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  tabList: {
    gap: spacing.sm,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background.secondary,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border.muted,
  },
  tabItemSelected: {
    backgroundColor: colors.brand.primary + '20',
    borderColor: colors.brand.primary,
  },
  tabItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  tabIconContainer: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  tabIconContainerSelected: {
    backgroundColor: colors.brand.primary,
  },
  tabItemInfo: {
    flex: 1,
  },
  tabItemLabel: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.text.primary,
  },
  tabItemLabelSelected: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  enterpriseBadge: {
    fontSize: fontSize.xs,
    color: colors.octopus.primary,
    marginTop: 2,
    fontWeight: '500',
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border.default,
    backgroundColor: colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary,
  },
  previewCard: {
    padding: spacing.md,
  },
  previewNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.sm,
  },
  previewTab: {
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  previewTabLabel: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    fontWeight: '500',
  },
});

