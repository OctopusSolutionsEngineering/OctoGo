/**
 * Tests for FavoritesContext
 */

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FavoritesProvider, useFavorites } from '../../src/context/FavoritesContext';

// AsyncStorage is auto-mocked by jest.setup.js

describe('FavoritesContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear the mocked AsyncStorage
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  describe('useFavorites hook', () => {
    it('should throw if used outside FavoritesProvider', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        renderHook(() => useFavorites());
      }).toThrow('useFavorites must be used within a FavoritesProvider');
      
      consoleSpy.mockRestore();
    });
  });

  describe('Initial state', () => {
    it('should start with isLoading true', async () => {
      // Mock slow async storage
      (AsyncStorage.getItem as jest.Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(null), 100))
      );

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FavoritesProvider>{children}</FavoritesProvider>
      );

      const { result } = renderHook(() => useFavorites(), { wrapper });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.favorites).toEqual([]);
    });

    it('should set isLoading false after loading', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FavoritesProvider>{children}</FavoritesProvider>
      );

      const { result } = renderHook(() => useFavorites(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      
      expect(result.current.favorites).toEqual([]);
    });

    it('should load favorites from storage', async () => {
      const storedFavorites = ['Projects-1', 'Projects-2'];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(storedFavorites));

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FavoritesProvider>{children}</FavoritesProvider>
      );

      const { result } = renderHook(() => useFavorites(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      
      expect(result.current.favorites).toEqual(storedFavorites);
    });

    it('should handle storage read errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FavoritesProvider>{children}</FavoritesProvider>
      );

      const { result } = renderHook(() => useFavorites(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      
      expect(result.current.favorites).toEqual([]);
      
      consoleSpy.mockRestore();
    });
  });

  describe('isFavorite', () => {
    it('should return true for favorited project', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(['Projects-1']));

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FavoritesProvider>{children}</FavoritesProvider>
      );

      const { result } = renderHook(() => useFavorites(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      
      expect(result.current.isFavorite('Projects-1')).toBe(true);
    });

    it('should return false for non-favorited project', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(['Projects-1']));

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FavoritesProvider>{children}</FavoritesProvider>
      );

      const { result } = renderHook(() => useFavorites(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      
      expect(result.current.isFavorite('Projects-2')).toBe(false);
    });
  });

  describe('toggleFavorite', () => {
    it('should add project to favorites', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FavoritesProvider>{children}</FavoritesProvider>
      );

      const { result } = renderHook(() => useFavorites(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.toggleFavorite('Projects-1');
      });

      expect(result.current.favorites).toContain('Projects-1');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@octogo_favorites',
        JSON.stringify(['Projects-1'])
      );
    });

    it('should remove project from favorites', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(['Projects-1', 'Projects-2']));

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FavoritesProvider>{children}</FavoritesProvider>
      );

      const { result } = renderHook(() => useFavorites(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.favorites).toHaveLength(2);

      await act(async () => {
        await result.current.toggleFavorite('Projects-1');
      });

      expect(result.current.favorites).not.toContain('Projects-1');
      expect(result.current.favorites).toContain('Projects-2');
    });
  });

  describe('addFavorite', () => {
    it('should add project to favorites', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FavoritesProvider>{children}</FavoritesProvider>
      );

      const { result } = renderHook(() => useFavorites(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.addFavorite('Projects-1');
      });

      expect(result.current.favorites).toContain('Projects-1');
    });

    it('should not duplicate if already favorited', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(['Projects-1']));

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FavoritesProvider>{children}</FavoritesProvider>
      );

      const { result } = renderHook(() => useFavorites(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.addFavorite('Projects-1');
      });

      expect(result.current.favorites.filter(id => id === 'Projects-1')).toHaveLength(1);
    });
  });

  describe('removeFavorite', () => {
    it('should remove project from favorites', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(['Projects-1', 'Projects-2']));

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FavoritesProvider>{children}</FavoritesProvider>
      );

      const { result } = renderHook(() => useFavorites(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.removeFavorite('Projects-1');
      });

      expect(result.current.favorites).not.toContain('Projects-1');
      expect(result.current.favorites).toContain('Projects-2');
    });

    it('should not error if project not in favorites', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(['Projects-1']));

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FavoritesProvider>{children}</FavoritesProvider>
      );

      const { result } = renderHook(() => useFavorites(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.removeFavorite('Projects-999');
      });

      expect(result.current.favorites).toEqual(['Projects-1']);
    });
  });

  describe('persistence', () => {
    it('should save to AsyncStorage when adding favorite', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FavoritesProvider>{children}</FavoritesProvider>
      );

      const { result } = renderHook(() => useFavorites(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.addFavorite('Projects-1');
      });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@octogo_favorites',
        expect.stringContaining('Projects-1')
      );
    });

    it('should save to AsyncStorage when removing favorite', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(['Projects-1', 'Projects-2']));

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FavoritesProvider>{children}</FavoritesProvider>
      );

      const { result } = renderHook(() => useFavorites(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.removeFavorite('Projects-1');
      });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@octogo_favorites',
        JSON.stringify(['Projects-2'])
      );
    });

    it('should handle storage write errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Write error'));

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FavoritesProvider>{children}</FavoritesProvider>
      );

      const { result } = renderHook(() => useFavorites(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await expect(
        act(async () => {
          await result.current.addFavorite('Projects-1');
        })
      ).rejects.toThrow('Write error');

      consoleSpy.mockRestore();
    });
  });

  describe('multiple favorites', () => {
    it('should handle multiple favorites', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FavoritesProvider>{children}</FavoritesProvider>
      );

      const { result } = renderHook(() => useFavorites(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.addFavorite('Projects-1');
      });
      await act(async () => {
        await result.current.addFavorite('Projects-2');
      });
      await act(async () => {
        await result.current.addFavorite('Projects-3');
      });

      expect(result.current.favorites).toHaveLength(3);
      expect(result.current.isFavorite('Projects-1')).toBe(true);
      expect(result.current.isFavorite('Projects-2')).toBe(true);
      expect(result.current.isFavorite('Projects-3')).toBe(true);
    });
  });
});

