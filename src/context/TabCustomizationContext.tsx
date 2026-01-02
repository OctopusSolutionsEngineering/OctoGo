/**
 * Tab Customization Context
 * Manages user-selected tabs for bottom navigation (max 4)
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

export interface TabItem {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconFilled: keyof typeof Ionicons.glyphMap;
  route: string;
  requiresEnterprise?: boolean;
}

// All available tabs from the drawer menu
export const AVAILABLE_TABS: TabItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'grid-outline', iconFilled: 'grid', route: '/' },
  { id: 'projects', label: 'Projects', icon: 'cube-outline', iconFilled: 'cube', route: '/projects' },
  { id: 'deployments', label: 'Tasks', icon: 'rocket-outline', iconFilled: 'rocket', route: '/deployments' },
  { id: 'search', label: 'Search', icon: 'search-outline', iconFilled: 'search', route: '/search' },
  { id: 'runbooks', label: 'Runbooks', icon: 'book-outline', iconFilled: 'book', route: '/runbooks' },
  { id: 'targets', label: 'Targets', icon: 'server-outline', iconFilled: 'server', route: '/targets' },
  { id: 'environments', label: 'Environments', icon: 'layers-outline', iconFilled: 'layers', route: '/environments' },
  { id: 'tenants', label: 'Tenants', icon: 'business-outline', iconFilled: 'business', route: '/tenants' },
  { id: 'events', label: 'Audit Log', icon: 'time-outline', iconFilled: 'time', route: '/events' },
  { id: 'insights', label: 'Insights', icon: 'analytics-outline', iconFilled: 'analytics', route: '/insights', requiresEnterprise: true },
];

// Default tabs (what shows initially)
export const DEFAULT_TAB_IDS = ['dashboard', 'projects', 'deployments', 'search'];

const STORAGE_KEY = '@octogo_selected_tabs';
const MAX_TABS = 4;

interface TabCustomizationContextValue {
  selectedTabIds: string[];
  selectedTabs: TabItem[];
  availableTabs: TabItem[];
  toggleTab: (tabId: string) => Promise<void>;
  canAddMoreTabs: boolean;
  isTabSelected: (tabId: string) => boolean;
  resetToDefaults: () => Promise<void>;
  isLoading: boolean;
}

const TabCustomizationContext = createContext<TabCustomizationContextValue | undefined>(undefined);

export function TabCustomizationProvider({ children }: { children: ReactNode }) {
  const [selectedTabIds, setSelectedTabIds] = useState<string[]>(DEFAULT_TAB_IDS);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved preferences on mount
  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Ensure we have valid tab IDs
        const validIds = parsed.filter((id: string) => 
          AVAILABLE_TABS.some(tab => tab.id === id)
        );
        if (validIds.length > 0) {
          setSelectedTabIds(validIds.slice(0, MAX_TABS));
        }
      }
    } catch (error) {
      console.error('Failed to load tab preferences:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTab = useCallback(async (tabId: string) => {
    setSelectedTabIds(current => {
      let newIds: string[];
      
      if (current.includes(tabId)) {
        // Remove tab (but keep at least 1)
        if (current.length === 1) {
          return current; // Don't allow removing the last tab
        }
        newIds = current.filter(id => id !== tabId);
      } else {
        // Add tab (max 4)
        if (current.length >= MAX_TABS) {
          return current; // Already at max
        }
        newIds = [...current, tabId];
      }
      
      // Save to storage
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newIds)).catch(error => {
        console.error('Failed to save tab preferences:', error);
      });
      
      return newIds;
    });
  }, []);

  const resetToDefaults = useCallback(async () => {
    setSelectedTabIds(DEFAULT_TAB_IDS);
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to reset tab preferences:', error);
    }
  }, []);

  const isTabSelected = useCallback((tabId: string) => {
    return selectedTabIds.includes(tabId);
  }, [selectedTabIds]);

  const selectedTabs = selectedTabIds
    .map(id => AVAILABLE_TABS.find(tab => tab.id === id))
    .filter((tab): tab is TabItem => tab !== undefined);

  const canAddMoreTabs = selectedTabIds.length < MAX_TABS;

  return (
    <TabCustomizationContext.Provider 
      value={{ 
        selectedTabIds,
        selectedTabs,
        availableTabs: AVAILABLE_TABS,
        toggleTab,
        canAddMoreTabs,
        isTabSelected,
        resetToDefaults,
        isLoading,
      }}
    >
      {children}
    </TabCustomizationContext.Provider>
  );
}

export function useTabCustomization() {
  const context = useContext(TabCustomizationContext);
  if (!context) {
    throw new Error('useTabCustomization must be used within TabCustomizationProvider');
  }
  return context;
}

