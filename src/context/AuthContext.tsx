/**
 * Authentication Context
 * Manages authentication state and provides auth methods to the app
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { 
  storeCredentials, 
  getCredentials, 
  clearCredentials, 
  hasCredentials,
  storeUserId,
  updateSpaceId,
  // Multi-instance support
  getInstances,
  getCurrentInstance,
  addInstance,
  switchInstance as switchInstanceStorage,
  removeInstance,
  migrateToMultiInstance,
  updateInstance,
  updateInstanceApiKey as updateInstanceApiKeyStorage,
  type OctopusInstance,
} from '../lib/security';
import { validateConnection, OctopusApiError, getSpaces, getLicenseStatus } from '../lib/api/client';
import type { User, Space, LicenseStatus } from '../lib/api/types';

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: User | null;
  serverVersion: string | null;
  currentSpace: Space | null;
  licenseStatus: LicenseStatus | null;
  isEnterprise: boolean;
  error: string | null;
  // Multi-instance support
  instances: OctopusInstance[];
  currentInstance: OctopusInstance | null;
  // Flag to allow accessing login while authenticated (for adding instances)
  isAddingInstance: boolean;
}

interface AuthContextValue extends AuthState {
  login: (serverUrl: string, apiKey: string, spaceId?: string, instanceName?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  switchSpace: (spaceId: string) => Promise<void>;
  clearError: () => void;
  // Multi-instance support
  switchInstance: (instanceId: string) => Promise<{ success: boolean; error?: string }>;
  deleteInstance: (instanceId: string) => Promise<void>;
  refreshInstances: () => Promise<void>;
  renameInstance: (instanceId: string, name: string) => Promise<void>;
  updateInstanceApiKey: (instanceId: string, apiKey: string) => Promise<{ success: boolean; error?: string }>;
  startAddingInstance: () => void;
  cancelAddingInstance: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isAuthenticated: false,
    user: null,
    serverVersion: null,
    currentSpace: null,
    licenseStatus: null,
    isEnterprise: false,
    error: null,
    instances: [],
    currentInstance: null,
    isAddingInstance: false,
  });

  // Check for existing credentials on mount
  useEffect(() => {
    checkExistingAuth();
  }, []);

  const checkExistingAuth = async () => {
    try {
      // Migrate legacy credentials to multi-instance format if needed
      await migrateToMultiInstance();

      const hasStoredCredentials = await hasCredentials();
      
      // Load instances regardless of auth state
      const instances = await getInstances();
      const currentInstance = await getCurrentInstance();
      
      if (!hasStoredCredentials) {
        setState(prev => ({ ...prev, isLoading: false, instances, currentInstance }));
        return;
      }

      // Validate stored credentials
      const { user, serverVersion } = await validateConnection();
      await storeUserId(user.Id);

      // Update the current instance with user ID
      if (currentInstance) {
        await updateInstance(currentInstance.id, { userId: user.Id });
      }

      // Fetch current space info
      let currentSpace: Space | null = null;
      try {
        const credentials = await getCredentials();
        if (credentials?.spaceId) {
          const spaces = await getSpaces();
          currentSpace = spaces.find(s => s.Id === credentials.spaceId) || null;
        } else {
          // Get default space
          const spaces = await getSpaces();
          currentSpace = spaces.find(s => s.IsDefault) || spaces[0] || null;
        }
      } catch (e) {
        console.warn('Could not fetch space info:', e);
      }

      // Fetch license info to determine if Enterprise
      let licenseStatus: LicenseStatus | null = null;
      let isEnterprise = false;
      try {
        licenseStatus = await getLicenseStatus();
        // Enterprise and Unlimited licenses have access to Insights
        isEnterprise = licenseStatus?.LicenseType === 'Enterprise' || 
                       licenseStatus?.LicenseType === 'Unlimited';
      } catch (e) {
        console.warn('Could not fetch license info:', e);
      }

      setState({
        isLoading: false,
        isAuthenticated: true,
        user,
        serverVersion,
        currentSpace,
        licenseStatus,
        isEnterprise,
        error: null,
        instances,
        currentInstance,
        isAddingInstance: false,
      });
    } catch (error) {
      console.error('Auth check failed:', error);
      
      // If credentials are invalid, clear them
      if (error instanceof OctopusApiError && error.isAuthError) {
        await clearCredentials();
      }

      // Still load instances even on auth failure
      const instances = await getInstances();

      setState({
        isLoading: false,
        isAuthenticated: false,
        user: null,
        serverVersion: null,
        currentSpace: null,
        licenseStatus: null,
        isEnterprise: false,
        error: error instanceof Error ? error.message : 'Authentication check failed',
        instances,
        currentInstance: null,
        isAddingInstance: false,
      });
    }
  };

  const login = useCallback(async (
    serverUrl: string,
    apiKey: string,
    spaceId?: string,
    instanceName?: string
  ): Promise<{ success: boolean; error?: string }> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // First, store credentials temporarily for the API client to use
      const storeResult = await storeCredentials(serverUrl, apiKey, spaceId);
      
      if (!storeResult.success) {
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: storeResult.error || 'Failed to store credentials' 
        }));
        return { success: false, error: storeResult.error };
      }

      // Validate connection BEFORE adding to instances list
      const { user, serverVersion } = await validateConnection();
      await storeUserId(user.Id);

      // Connection successful - now add to instances list
      const addResult = await addInstance(serverUrl, apiKey, instanceName, spaceId);
      
      if (!addResult.success) {
        // This shouldn't happen since we already validated, but handle it
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: addResult.error || 'Failed to save instance' 
        }));
        return { success: false, error: addResult.error };
      }

      // Update instance with user ID
      if (addResult.instanceId) {
        await updateInstance(addResult.instanceId, { userId: user.Id });
      }

      // Fetch current space info
      let currentSpace: Space | null = null;
      try {
        const spaces = await getSpaces();
        if (spaceId) {
          currentSpace = spaces.find(s => s.Id === spaceId) || null;
        } else {
          currentSpace = spaces.find(s => s.IsDefault) || spaces[0] || null;
        }
      } catch (e) {
        console.warn('Could not fetch space info:', e);
      }

      // Fetch license info to determine if Enterprise
      let licenseStatus: LicenseStatus | null = null;
      let isEnterprise = false;
      try {
        licenseStatus = await getLicenseStatus();
        isEnterprise = licenseStatus?.LicenseType === 'Enterprise' || 
                       licenseStatus?.LicenseType === 'Unlimited';
      } catch (e) {
        console.warn('Could not fetch license info:', e);
      }

      // Reload instances
      const instances = await getInstances();
      const currentInstance = await getCurrentInstance();

      setState({
        isLoading: false,
        isAuthenticated: true,
        user,
        serverVersion,
        currentSpace,
        licenseStatus,
        isEnterprise,
        error: null,
        instances,
        currentInstance,
        isAddingInstance: false, // Clear the flag after successful login
      });

      // Invalidate all queries to ensure fresh data loads with new instance
      await queryClient.invalidateQueries({ queryKey: ['octopus'] });

      return { success: true };
    } catch (error) {
      // Clear credentials on auth failure - instance was never added
      await clearCredentials();

      const errorMessage = error instanceof OctopusApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Login failed';

      // Reload instances (instance should not be in list since we failed before adding)
      const instances = await getInstances();

      setState(prev => ({
        ...prev,
        isLoading: false,
        isAuthenticated: false,
        error: errorMessage,
        instances,
      }));

      return { success: false, error: errorMessage };
    }
  }, []);

  const logout = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      await clearCredentials();
    } catch (error) {
      console.error('Failed to clear credentials:', error);
    }

    // Keep instances in state for easy re-login
    const instances = await getInstances();

    setState({
      isLoading: false,
      isAuthenticated: false,
      user: null,
      serverVersion: null,
      currentSpace: null,
      licenseStatus: null,
      isEnterprise: false,
      error: null,
      instances,
      currentInstance: null,
      isAddingInstance: false,
    });
  }, []);

  const switchSpace = useCallback(async (spaceId: string) => {
    try {
      // Update stored space ID
      await updateSpaceId(spaceId);
      
      // Fetch space info
      const spaces = await getSpaces();
      const newSpace = spaces.find(s => s.Id === spaceId) || null;
      
      setState(prev => ({
        ...prev,
        currentSpace: newSpace,
      }));

      // Invalidate all queries to refetch with new space
      await queryClient.invalidateQueries({ queryKey: ['octopus'] });
    } catch (error) {
      console.error('Failed to switch space:', error);
    }
  }, [queryClient]);

  const refreshUser = useCallback(async () => {
    try {
      const { user, serverVersion } = await validateConnection();
      setState(prev => ({
        ...prev,
        user,
        serverVersion,
        error: null,
      }));
    } catch (error) {
      console.error('Failed to refresh user:', error);
      
      if (error instanceof OctopusApiError && error.isAuthError) {
        await logout();
      }
    }
  }, [logout]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Switch to a different Octopus instance
  const switchInstanceCallback = useCallback(async (instanceId: string): Promise<{ success: boolean; error?: string }> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await switchInstanceStorage(instanceId);
      
      if (!result.success) {
        setState(prev => ({ ...prev, isLoading: false, error: result.error || null }));
        return result;
      }

      // Validate connection with new instance
      const { user, serverVersion } = await validateConnection();
      await storeUserId(user.Id);

      // Update instance with user ID
      await updateInstance(instanceId, { userId: user.Id });

      // Fetch current space info
      let currentSpace: Space | null = null;
      try {
        const credentials = await getCredentials();
        if (credentials?.spaceId) {
          const spaces = await getSpaces();
          currentSpace = spaces.find(s => s.Id === credentials.spaceId) || null;
        } else {
          const spaces = await getSpaces();
          currentSpace = spaces.find(s => s.IsDefault) || spaces[0] || null;
        }
      } catch (e) {
        console.warn('Could not fetch space info:', e);
      }

      // Fetch license info
      let licenseStatus: LicenseStatus | null = null;
      let isEnterprise = false;
      try {
        licenseStatus = await getLicenseStatus();
        isEnterprise = licenseStatus?.LicenseType === 'Enterprise' || 
                       licenseStatus?.LicenseType === 'Unlimited';
      } catch (e) {
        console.warn('Could not fetch license info:', e);
      }

      // Reload instances
      const instances = await getInstances();
      const currentInstance = await getCurrentInstance();

      setState(prev => ({
        ...prev,
        isLoading: false,
        isAuthenticated: true,
        user,
        serverVersion,
        currentSpace,
        licenseStatus,
        isEnterprise,
        error: null,
        instances,
        currentInstance,
      }));

      // Invalidate all queries to refetch with new instance
      await queryClient.invalidateQueries({ queryKey: ['octopus'] });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to switch instance';
      setState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
      return { success: false, error: errorMessage };
    }
  }, [queryClient]);

  // Delete an instance
  const deleteInstance = useCallback(async (instanceId: string): Promise<void> => {
    await removeInstance(instanceId);
    const instances = await getInstances();
    const currentInstance = await getCurrentInstance();
    
    setState(prev => ({ ...prev, instances, currentInstance }));
  }, []);

  // Refresh instances list
  const refreshInstances = useCallback(async (): Promise<void> => {
    const instances = await getInstances();
    const currentInstance = await getCurrentInstance();
    setState(prev => ({ ...prev, instances, currentInstance }));
  }, []);

  // Rename an instance
  const renameInstance = useCallback(async (instanceId: string, name: string): Promise<void> => {
    await updateInstance(instanceId, { name });
    const instances = await getInstances();
    const currentInstance = await getCurrentInstance();
    setState(prev => ({ ...prev, instances, currentInstance }));
  }, []);

  // Update API key for an existing instance
  const updateInstanceApiKey = useCallback(async (
    instanceId: string,
    apiKey: string
  ): Promise<{ success: boolean; error?: string }> => {
    const result = await updateInstanceApiKeyStorage(instanceId, apiKey);
    if (!result.success) {
      setState(prev => ({ ...prev, error: result.error || 'Failed to update API key' }));
      return result;
    }

    const instances = await getInstances();
    const currentInstance = await getCurrentInstance();
    setState(prev => ({ ...prev, instances, currentInstance, error: null }));
    return result;
  }, []);

  // Start adding a new instance (allows access to login screen while authenticated)
  const startAddingInstance = useCallback(() => {
    setState(prev => ({ ...prev, isAddingInstance: true }));
  }, []);

  // Cancel adding instance
  const cancelAddingInstance = useCallback(() => {
    setState(prev => ({ ...prev, isAddingInstance: false }));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        refreshUser,
        switchSpace,
        clearError,
        switchInstance: switchInstanceCallback,
        deleteInstance,
        refreshInstances,
        renameInstance,
        updateInstanceApiKey,
        startAddingInstance,
        cancelAddingInstance,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};
