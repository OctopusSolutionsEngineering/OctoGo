/**
 * Favorites Context
 * Provides persistent storage for favorited/pinned projects
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FAVORITES_KEY = '@octogo_favorites';

interface FavoritesContextType {
  favorites: string[]; // Array of project IDs
  isFavorite: (projectId: string) => boolean;
  toggleFavorite: (projectId: string) => Promise<void>;
  addFavorite: (projectId: string) => Promise<void>;
  removeFavorite: (projectId: string) => Promise<void>;
  isLoading: boolean;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

interface FavoritesProviderProps {
  children: ReactNode;
}

export const FavoritesProvider: React.FC<FavoritesProviderProps> = ({ children }) => {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load favorites from storage on mount
  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      const stored = await AsyncStorage.getItem(FAVORITES_KEY);
      if (stored) {
        setFavorites(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load favorites:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveFavorites = async (newFavorites: string[]) => {
    try {
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
      setFavorites(newFavorites);
    } catch (error) {
      console.error('Failed to save favorites:', error);
      throw error;
    }
  };

  const isFavorite = useCallback((projectId: string): boolean => {
    return favorites.includes(projectId);
  }, [favorites]);

  const toggleFavorite = useCallback(async (projectId: string): Promise<void> => {
    const newFavorites = favorites.includes(projectId)
      ? favorites.filter(id => id !== projectId)
      : [...favorites, projectId];
    await saveFavorites(newFavorites);
  }, [favorites]);

  const addFavorite = useCallback(async (projectId: string): Promise<void> => {
    if (!favorites.includes(projectId)) {
      await saveFavorites([...favorites, projectId]);
    }
  }, [favorites]);

  const removeFavorite = useCallback(async (projectId: string): Promise<void> => {
    if (favorites.includes(projectId)) {
      await saveFavorites(favorites.filter(id => id !== projectId));
    }
  }, [favorites]);

  return (
    <FavoritesContext.Provider
      value={{
        favorites,
        isFavorite,
        toggleFavorite,
        addFavorite,
        removeFavorite,
        isLoading,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
};

export const useFavorites = (): FavoritesContextType => {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
};

