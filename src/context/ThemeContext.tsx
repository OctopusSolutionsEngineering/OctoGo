/**
 * Theme Context
 * Manages light/dark theme preference with persistence and provides themed colors
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';

type ThemeMode = 'light' | 'dark' | 'system';

// Create a type that represents the structure of colors (not literal values)
export interface ThemeColors {
  brand: { primary: string; secondary: string; accent: string; orange: string };
  octopus: { primary: string; secondary: string; accent: string };
  background: { primary: string; secondary: string; tertiary: string; elevated: string };
  text: { primary: string; secondary: string; muted: string; tertiary: string; subtle: string; inverse: string };
  border: { default: string; muted: string; subtle: string; emphasis: string };
  status: { success: string; successDim: string; warning: string; warningDim: string; error: string; errorDim: string; info: string; infoDim: string; pending: string; pendingDim: string };
  taskState: { Success: string; Failed: string; Executing: string; Queued: string; Canceled: string; Cancelling: string; TimedOut: string };
  healthStatus: { Healthy: string; HasWarnings: string; Unhealthy: string; Unavailable: string; Unknown: string };
  interactive: { hover: string; pressed: string; focus: string };
  transparent: string;
  white: string;
  black: string;
}

// Dark theme colors (current default) - Purple brand #4E49BE
const darkColors: ThemeColors = {
  // Brand colors - Purple to match the octopus logo
  brand: {
    primary: '#4E49BE',
    secondary: '#5D58C9',
    accent: '#7B77D1',
    orange: '#F97316',
  },
  octopus: {
    primary: '#4E49BE',
    secondary: '#5D58C9',
    accent: '#7B77D1',
  },
  // Background colors
  background: {
    primary: '#0D1117',
    secondary: '#161B22',
    tertiary: '#21262D',
    elevated: '#30363D',
  },
  // Text colors
  text: {
    primary: '#F0F6FC',
    secondary: '#8B949E',
    muted: '#8B949E',
    tertiary: '#6E7681',
    subtle: '#6E7681',
    inverse: '#0D1117',
  },
  // Border colors
  border: {
    default: '#30363D',
    muted: '#21262D',
    subtle: '#1A1F26',
    emphasis: '#8B949E',
  },
  // Status colors
  status: {
    success: '#22C55E',
    successDim: '#1A4D2E',
    warning: '#F97316',
    warningDim: '#4D3319',
    error: '#EF4444',
    errorDim: '#4D1F1F',
    info: '#4E49BE',
    infoDim: '#1E1D3D',
    pending: '#7B77D1',
    pendingDim: '#2A2952',
  },
  // Task state colors
  taskState: {
    Success: '#22C55E',
    Failed: '#EF4444',
    Executing: '#4E49BE',
    Queued: '#7B77D1',
    Canceled: '#8B949E',
    Cancelling: '#F97316',
    TimedOut: '#F97316',
  },
  // Health status colors
  healthStatus: {
    Healthy: '#22C55E',
    HasWarnings: '#F97316',
    Unhealthy: '#EF4444',
    Unavailable: '#8B949E',
    Unknown: '#6E7681',
  },
  // Interactive states (using #4E49BE = rgb(78, 73, 190))
  interactive: {
    hover: 'rgba(78, 73, 190, 0.1)',
    pressed: 'rgba(78, 73, 190, 0.2)',
    focus: 'rgba(78, 73, 190, 0.3)',
  },
  // Utility
  transparent: 'transparent',
  white: '#FFFFFF',
  black: '#000000',
};

// Light theme colors - Purple brand #4E49BE
const lightColors: ThemeColors = {
  // Brand colors - Purple to match the octopus logo
  brand: {
    primary: '#4E49BE',
    secondary: '#3D3999',
    accent: '#6E6AD4',
    orange: '#D97706',
  },
  octopus: {
    primary: '#4E49BE',
    secondary: '#3D3999',
    accent: '#6E6AD4',
  },
  // Background colors
  background: {
    primary: '#FFFFFF',
    secondary: '#F6F8FA',
    tertiary: '#EAEEF2',
    elevated: '#FFFFFF',
  },
  // Text colors
  text: {
    primary: '#1F2328',
    secondary: '#59636E',
    muted: '#59636E',
    tertiary: '#6E7781',
    subtle: '#8C959F',
    inverse: '#FFFFFF',
  },
  // Border colors
  border: {
    default: '#D1D9E0',
    muted: '#D8DEE4',
    subtle: '#EAEEF2',
    emphasis: '#59636E',
  },
  // Status colors
  status: {
    success: '#16A34A',
    successDim: '#DCFCE7',
    warning: '#D97706',
    warningDim: '#FEF3C7',
    error: '#DC2626',
    errorDim: '#FEE2E2',
    info: '#4E49BE',
    infoDim: '#EEF2FF',
    pending: '#7B77D1',
    pendingDim: '#F3E8FF',
  },
  // Task state colors
  taskState: {
    Success: '#16A34A',
    Failed: '#DC2626',
    Executing: '#4E49BE',
    Queued: '#7B77D1',
    Canceled: '#59636E',
    Cancelling: '#D97706',
    TimedOut: '#D97706',
  },
  // Health status colors
  healthStatus: {
    Healthy: '#16A34A',
    HasWarnings: '#D97706',
    Unhealthy: '#DC2626',
    Unavailable: '#59636E',
    Unknown: '#6E7781',
  },
  // Interactive states (using #4E49BE = rgb(78, 73, 190))
  interactive: {
    hover: 'rgba(78, 73, 190, 0.08)',
    pressed: 'rgba(78, 73, 190, 0.15)',
    focus: 'rgba(78, 73, 190, 0.2)',
  },
  // Utility
  transparent: 'transparent',
  white: '#FFFFFF',
  black: '#000000',
};

interface ThemeState {
  mode: ThemeMode;
  isDark: boolean;
  isLoading: boolean;
}

interface ThemeContextValue extends ThemeState {
  colors: ThemeColors;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

const THEME_STORAGE_KEY = '@octogo_theme_mode';

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>('dark'); // Default to dark mode
  const [isLoading, setIsLoading] = useState(true);

  // TEMPORARY: Force dark mode until light mode is fully implemented
  // Calculate if dark mode is active - always return true for now
  const isDark = true; // Force dark mode
  // const isDark = mode === 'system' 
  //   ? systemColorScheme === 'dark' 
  //   : mode === 'dark';

  // Get the appropriate color palette - always use dark colors for now
  const colors = useMemo(() => darkColors, []);

  // Load saved theme preference on mount
  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      // Always default to dark mode, ignore saved preference for now
      if (savedMode && savedMode === 'dark') {
        setMode('dark');
      } else {
        // Force dark mode as default
        setMode('dark');
        await AsyncStorage.setItem(THEME_STORAGE_KEY, 'dark');
      }
    } catch (error) {
      console.warn('Failed to load theme preference:', error);
      setMode('dark'); // Ensure dark mode even on error
    } finally {
      setIsLoading(false);
    }
  };

  const setThemeMode = useCallback(async (newMode: ThemeMode) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
      setMode(newMode);
    } catch (error) {
      console.warn('Failed to save theme preference:', error);
    }
  }, []);

  const toggleTheme = useCallback(async () => {
    const nextMode: ThemeMode = 
      mode === 'system' ? 'light' : 
      mode === 'light' ? 'dark' : 
      'system';
    
    await setThemeMode(nextMode);
  }, [mode, setThemeMode]);

  return (
    <ThemeContext.Provider
      value={{
        mode,
        isDark,
        isLoading,
        colors,
        setThemeMode,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  
  return context;
};

/**
 * Hook to get just the themed colors
 * Use this in components that only need colors, not theme control
 */
export const useColors = (): ThemeColors => {
  const { colors } = useTheme();
  return colors;
};

// Export color palettes for reference
export { darkColors, lightColors };
