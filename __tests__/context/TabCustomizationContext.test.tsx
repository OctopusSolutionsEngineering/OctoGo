/**
 * Tests for TabCustomizationContext
 */

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  TabCustomizationProvider,
  useTabCustomization,
  AVAILABLE_TABS,
  DEFAULT_TAB_IDS,
} from '../../src/context/TabCustomizationContext';

// AsyncStorage is auto-mocked by jest.setup.js

const STORAGE_KEY = '@octogo_selected_tabs';

describe('TabCustomizationContext', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <TabCustomizationProvider>{children}</TabCustomizationProvider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
  });

  describe('useTabCustomization hook', () => {
    it('should throw if used outside TabCustomizationProvider', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useTabCustomization());
      }).toThrow('useTabCustomization must be used within TabCustomizationProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('Initial state', () => {
    it('should start with default tabs and isLoading true', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(null), 100))
      );

      const { result } = renderHook(() => useTabCustomization(), { wrapper });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.selectedTabIds).toEqual(DEFAULT_TAB_IDS);

      await waitFor(() => expect(result.current.isLoading).toBe(false));
    });

    it('should expose all available tabs', async () => {
      const { result } = renderHook(() => useTabCustomization(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.availableTabs).toEqual(AVAILABLE_TABS);
    });

    it('should use defaults when nothing is stored', async () => {
      const { result } = renderHook(() => useTabCustomization(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.selectedTabIds).toEqual(DEFAULT_TAB_IDS);
      expect(result.current.canAddMoreTabs).toBe(false);
    });

    it('should load stored tab preferences', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(['runbooks', 'targets'])
      );

      const { result } = renderHook(() => useTabCustomization(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.selectedTabIds).toEqual(['runbooks', 'targets']);
      expect(result.current.canAddMoreTabs).toBe(true);
    });

    it('should filter out invalid stored tab ids', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(['runbooks', 'not-a-real-tab'])
      );

      const { result } = renderHook(() => useTabCustomization(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.selectedTabIds).toEqual(['runbooks']);
    });

    it('should keep defaults when stored ids are all invalid', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(['bogus-1', 'bogus-2'])
      );

      const { result } = renderHook(() => useTabCustomization(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.selectedTabIds).toEqual(DEFAULT_TAB_IDS);
    });

    it('should cap stored tabs at the maximum of 4', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(['dashboard', 'projects', 'deployments', 'search', 'runbooks'])
      );

      const { result } = renderHook(() => useTabCustomization(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.selectedTabIds).toHaveLength(4);
    });

    it('should handle storage read errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const { result } = renderHook(() => useTabCustomization(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.selectedTabIds).toEqual(DEFAULT_TAB_IDS);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('toggleTab', () => {
    it('should remove a selected tab', async () => {
      const { result } = renderHook(() => useTabCustomization(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.toggleTab('search');
      });

      expect(result.current.selectedTabIds).not.toContain('search');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        JSON.stringify(['dashboard', 'projects', 'deployments'])
      );
    });

    it('should add an unselected tab', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(['dashboard', 'projects'])
      );

      const { result } = renderHook(() => useTabCustomization(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.toggleTab('runbooks');
      });

      expect(result.current.selectedTabIds).toEqual(['dashboard', 'projects', 'runbooks']);
    });

    it('should not remove the last remaining tab', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(['dashboard']));

      const { result } = renderHook(() => useTabCustomization(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.toggleTab('dashboard');
      });

      expect(result.current.selectedTabIds).toEqual(['dashboard']);
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });

    it('should not add more than 4 tabs', async () => {
      const { result } = renderHook(() => useTabCustomization(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.selectedTabIds).toHaveLength(4);

      await act(async () => {
        await result.current.toggleTab('runbooks');
      });

      expect(result.current.selectedTabIds).toEqual(DEFAULT_TAB_IDS);
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });

    it('should log an error when saving preferences fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Write error'));

      const { result } = renderHook(() => useTabCustomization(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.toggleTab('search');
      });

      await waitFor(() =>
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to save tab preferences:',
          expect.any(Error)
        )
      );

      consoleSpy.mockRestore();
    });
  });

  describe('resetToDefaults', () => {
    it('should reset selection and clear storage', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(['runbooks', 'targets'])
      );

      const { result } = renderHook(() => useTabCustomization(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.resetToDefaults();
      });

      expect(result.current.selectedTabIds).toEqual(DEFAULT_TAB_IDS);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    });

    it('should handle storage errors during reset', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      (AsyncStorage.removeItem as jest.Mock).mockRejectedValue(new Error('Remove error'));

      const { result } = renderHook(() => useTabCustomization(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.resetToDefaults();
      });

      expect(result.current.selectedTabIds).toEqual(DEFAULT_TAB_IDS);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to reset tab preferences:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('isTabSelected', () => {
    it('should return true for a selected tab', async () => {
      const { result } = renderHook(() => useTabCustomization(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isTabSelected('dashboard')).toBe(true);
    });

    it('should return false for an unselected tab', async () => {
      const { result } = renderHook(() => useTabCustomization(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isTabSelected('runbooks')).toBe(false);
    });
  });

  describe('selectedTabs', () => {
    it('should map selected ids to tab items', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(['runbooks', 'insights'])
      );

      const { result } = renderHook(() => useTabCustomization(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.selectedTabs.map(t => t.id)).toEqual(['runbooks', 'insights']);
      expect(result.current.selectedTabs[0].label).toBe('Runbooks');
      expect(result.current.selectedTabs[1].requiresEnterprise).toBe(true);
    });
  });
});
