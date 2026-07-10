/**
 * Tests for ThemeContext
 */

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ThemeProvider,
  useTheme,
  useColors,
  darkColors,
} from '../../src/context/ThemeContext';

// AsyncStorage is auto-mocked by jest.setup.js

const THEME_STORAGE_KEY = '@octogo_theme_mode';

describe('ThemeContext', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ThemeProvider>{children}</ThemeProvider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  describe('useTheme hook', () => {
    it('should throw if used outside ThemeProvider', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useTheme());
      }).toThrow('useTheme must be used within a ThemeProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('Initial state', () => {
    it('should start with isLoading true and dark mode', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('dark'), 100))
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.mode).toBe('dark');
      expect(result.current.isDark).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false));
    });

    it('should keep dark mode when saved preference is dark', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('dark');

      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.mode).toBe('dark');
      // No forced write when already dark
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });

    it('should force dark mode and persist it when no preference saved', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.mode).toBe('dark');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, 'dark');
    });

    it('should force dark mode when a non-dark preference is saved', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('light');

      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.mode).toBe('dark');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, 'dark');
    });

    it('should fall back to dark mode on storage errors', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.mode).toBe('dark');
      expect(warnSpy).toHaveBeenCalledWith(
        'Failed to load theme preference:',
        expect.any(Error)
      );

      warnSpy.mockRestore();
    });
  });

  describe('colors', () => {
    it('should provide dark colors', async () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.colors).toEqual(darkColors);
      expect(result.current.isDark).toBe(true);
    });
  });

  describe('setThemeMode', () => {
    it('should persist and apply a new mode', async () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.setThemeMode('light');
      });

      expect(result.current.mode).toBe('light');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, 'light');
    });

    it('should warn when persisting the mode fails', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Write error'));

      await act(async () => {
        await result.current.setThemeMode('light');
      });

      // Mode should not change since persistence failed
      expect(result.current.mode).toBe('dark');
      expect(warnSpy).toHaveBeenCalledWith(
        'Failed to save theme preference:',
        expect.any(Error)
      );

      warnSpy.mockRestore();
    });
  });

  describe('toggleTheme', () => {
    it('should cycle dark -> system -> light -> dark', async () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.mode).toBe('dark');

      await act(async () => {
        await result.current.toggleTheme();
      });
      expect(result.current.mode).toBe('system');

      await act(async () => {
        await result.current.toggleTheme();
      });
      expect(result.current.mode).toBe('light');

      await act(async () => {
        await result.current.toggleTheme();
      });
      expect(result.current.mode).toBe('dark');
    });
  });

  describe('useColors hook', () => {
    it('should return the themed colors', async () => {
      const { result } = renderHook(() => useColors(), { wrapper });

      await waitFor(() => expect(result.current).toEqual(darkColors));
    });

    it('should throw if used outside ThemeProvider', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useColors());
      }).toThrow('useTheme must be used within a ThemeProvider');

      consoleSpy.mockRestore();
    });
  });
});
