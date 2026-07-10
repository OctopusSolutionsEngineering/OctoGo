/**
 * Tests for AuthContext
 */

import React from 'react';
import { render, renderHook, waitFor, act } from '@testing-library/react-native';
import { Text } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../../src/context/AuthContext';
import * as security from '../../src/lib/security';
import * as apiClient from '../../src/lib/api/client';

// Mock the security module
jest.mock('../../src/lib/security');

// Mock the API client
jest.mock('../../src/lib/api/client');

const mockSecurity = security as jest.Mocked<typeof security>;
const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

// Helper to create wrapper with providers
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mocks
    mockSecurity.hasCredentials.mockResolvedValue(false);
    mockSecurity.getCredentials.mockResolvedValue(null);
    mockSecurity.storeCredentials.mockResolvedValue({ success: true });
    mockSecurity.clearCredentials.mockResolvedValue();
    mockSecurity.storeUserId.mockResolvedValue();
    mockSecurity.updateSpaceId.mockResolvedValue();
    // Multi-instance support mocks
    mockSecurity.getInstances.mockResolvedValue([]);
    mockSecurity.getCurrentInstance.mockResolvedValue(null);
    mockSecurity.addInstance.mockResolvedValue({ success: true, instanceId: 'instance-1' });
    mockSecurity.updateInstance.mockResolvedValue();
    mockSecurity.migrateToMultiInstance.mockResolvedValue();
    mockSecurity.switchInstance.mockResolvedValue({ success: true });
    mockSecurity.removeInstance.mockResolvedValue();
    mockSecurity.updateInstanceApiKey.mockResolvedValue({ success: true });
  });

  // Helper to create errors that pass `instanceof OctopusApiError` checks
  const createApiError = (message: string, isAuthError: boolean) => {
    const error = Object.create(mockApiClient.OctopusApiError.prototype);
    Object.assign(error, {
      message,
      isAuthError,
      isNetworkError: false,
      isRateLimited: false,
      statusCode: isAuthError ? 401 : 500,
      errors: [],
    });
    return error;
  };

  describe('useAuth hook', () => {
    it('should throw if used outside AuthProvider', () => {
      // Silence console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');
      
      consoleSpy.mockRestore();
    });
  });

  describe('Initial state', () => {
    it('should start with isLoading true', async () => {
      mockSecurity.hasCredentials.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(false), 100))
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should set isLoading false after checking credentials', async () => {
      mockSecurity.hasCredentials.mockResolvedValue(false);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it('should restore session if credentials exist', async () => {
      const mockUser = { Id: 'Users-1', Username: 'admin', DisplayName: 'Admin' };
      const mockSpaces = [{ Id: 'Spaces-1', Name: 'Default', IsDefault: true }];
      
      mockSecurity.hasCredentials.mockResolvedValue(true);
      mockSecurity.getCredentials.mockResolvedValue({
        serverUrl: 'https://octopus.example.com',
        apiKey: 'API-KEY',
        spaceId: 'Spaces-1',
      });
      mockApiClient.validateConnection.mockResolvedValue({
        user: mockUser,
        serverVersion: '2023.4.1234',
      });
      mockApiClient.getSpaces.mockResolvedValue(mockSpaces);
      mockApiClient.getLicenseStatus.mockResolvedValue({
        LicenseType: 'Enterprise',
        HostingEnvironment: 'SelfHosted',
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.serverVersion).toBe('2023.4.1234');
      expect(result.current.isEnterprise).toBe(true);
    });
  });

  describe('login', () => {
    it('should login successfully', async () => {
      const mockUser = { Id: 'Users-1', Username: 'admin', DisplayName: 'Admin' };
      const mockSpaces = [{ Id: 'Spaces-1', Name: 'Default', IsDefault: true }];
      
      mockApiClient.validateConnection.mockResolvedValue({
        user: mockUser,
        serverVersion: '2023.4.1234',
      });
      mockApiClient.getSpaces.mockResolvedValue(mockSpaces);
      mockApiClient.getLicenseStatus.mockResolvedValue({
        LicenseType: 'Professional',
        HostingEnvironment: 'SelfHosted',
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let loginResult: { success: boolean; error?: string };
      
      await act(async () => {
        loginResult = await result.current.login(
          'https://octopus.example.com',
          'API-VALIDKEY123456789012345',
          'Spaces-1'
        );
      });

      expect(loginResult!.success).toBe(true);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);
      expect(mockSecurity.storeCredentials).toHaveBeenCalledWith(
        'https://octopus.example.com',
        'API-VALIDKEY123456789012345',
        'Spaces-1'
      );
    });

    it('should fail login with invalid credentials', async () => {
      mockSecurity.storeCredentials.mockResolvedValue({ success: true });
      // Create an error that behaves like OctopusApiError
      const authError = Object.assign(new Error('Authentication failed'), {
        statusCode: 401,
        isAuthError: true,
        isNetworkError: false,
        isRateLimited: false,
        errors: [],
      });
      mockApiClient.validateConnection.mockRejectedValue(authError);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let loginResult: { success: boolean; error?: string };
      
      await act(async () => {
        loginResult = await result.current.login(
          'https://octopus.example.com',
          'API-INVALIDKEY1234567890123'
        );
      });

      expect(loginResult!.success).toBe(false);
      // The error message comes from the Error object's message property
      expect(loginResult!.error).toBe('Authentication failed');
      expect(result.current.isAuthenticated).toBe(false);
      expect(mockSecurity.clearCredentials).toHaveBeenCalled();
    });

    it('should fail login with credential storage error', async () => {
      mockSecurity.storeCredentials.mockResolvedValue({
        success: false,
        error: 'Invalid URL format',
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let loginResult: { success: boolean; error?: string };
      
      await act(async () => {
        loginResult = await result.current.login('invalid', 'API-KEY');
      });

      expect(loginResult!.success).toBe(false);
      expect(loginResult!.error).toBe('Invalid URL format');
    });
  });

  describe('logout', () => {
    it('should clear state and credentials on logout', async () => {
      const mockUser = { Id: 'Users-1', Username: 'admin', DisplayName: 'Admin' };
      
      mockSecurity.hasCredentials.mockResolvedValue(true);
      mockApiClient.validateConnection.mockResolvedValue({
        user: mockUser,
        serverVersion: '2023.4.1234',
      });
      mockApiClient.getSpaces.mockResolvedValue([]);
      mockApiClient.getLicenseStatus.mockResolvedValue(null);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(mockSecurity.clearCredentials).toHaveBeenCalled();
    });
  });

  describe('switchSpace', () => {
    it('should update current space', async () => {
      const mockSpaces = [
        { Id: 'Spaces-1', Name: 'Default', IsDefault: true },
        { Id: 'Spaces-2', Name: 'Production', IsDefault: false },
      ];

      mockSecurity.hasCredentials.mockResolvedValue(true);
      mockApiClient.validateConnection.mockResolvedValue({
        user: { Id: 'Users-1', Username: 'admin' },
        serverVersion: '2023.4.1234',
      });
      mockApiClient.getSpaces.mockResolvedValue(mockSpaces);
      mockApiClient.getLicenseStatus.mockResolvedValue(null);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

      await act(async () => {
        await result.current.switchSpace('Spaces-2');
      });

      expect(mockSecurity.updateSpaceId).toHaveBeenCalledWith('Spaces-2');
    });
  });

  describe('clearError', () => {
    it('should clear error state', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('isEnterprise', () => {
    it('should be true for Enterprise license', async () => {
      mockSecurity.hasCredentials.mockResolvedValue(true);
      mockApiClient.validateConnection.mockResolvedValue({
        user: { Id: 'Users-1', Username: 'admin' },
        serverVersion: '2023.4.1234',
      });
      mockApiClient.getSpaces.mockResolvedValue([]);
      mockApiClient.getLicenseStatus.mockResolvedValue({
        LicenseType: 'Enterprise',
        HostingEnvironment: 'SelfHosted',
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isEnterprise).toBe(true);
    });

    it('should be true for Unlimited license', async () => {
      mockSecurity.hasCredentials.mockResolvedValue(true);
      mockApiClient.validateConnection.mockResolvedValue({
        user: { Id: 'Users-1', Username: 'admin' },
        serverVersion: '2023.4.1234',
      });
      mockApiClient.getSpaces.mockResolvedValue([]);
      mockApiClient.getLicenseStatus.mockResolvedValue({
        LicenseType: 'Unlimited',
        HostingEnvironment: 'SelfHosted',
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isEnterprise).toBe(true);
    });

    it('should be false for Professional license', async () => {
      mockSecurity.hasCredentials.mockResolvedValue(true);
      mockApiClient.validateConnection.mockResolvedValue({
        user: { Id: 'Users-1', Username: 'admin' },
        serverVersion: '2023.4.1234',
      });
      mockApiClient.getSpaces.mockResolvedValue([]);
      mockApiClient.getLicenseStatus.mockResolvedValue({
        LicenseType: 'Professional',
        HostingEnvironment: 'SelfHosted',
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isEnterprise).toBe(false);
    });
  });

  describe('checkExistingAuth edge cases', () => {
    it('should update the current instance with the user id on restore', async () => {
      const mockInstance = {
        id: 'inst-1',
        name: 'Primary',
        serverUrl: 'https://octopus.example.com',
        createdAt: new Date().toISOString(),
      } as never;

      mockSecurity.hasCredentials.mockResolvedValue(true);
      mockSecurity.getCurrentInstance.mockResolvedValue(mockInstance);
      mockSecurity.getInstances.mockResolvedValue([mockInstance]);
      mockApiClient.validateConnection.mockResolvedValue({
        user: { Id: 'Users-1', Username: 'admin' },
        serverVersion: '2023.4.1234',
      } as never);
      mockApiClient.getSpaces.mockResolvedValue([]);
      mockApiClient.getLicenseStatus.mockResolvedValue(null);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

      expect(mockSecurity.updateInstance).toHaveBeenCalledWith('inst-1', { userId: 'Users-1' });
      expect(result.current.currentInstance).toEqual(mockInstance);
    });

    it('should fall back to default space when no spaceId is stored', async () => {
      const mockSpaces = [
        { Id: 'Spaces-1', Name: 'Other', IsDefault: false },
        { Id: 'Spaces-2', Name: 'Default', IsDefault: true },
      ];

      mockSecurity.hasCredentials.mockResolvedValue(true);
      mockSecurity.getCredentials.mockResolvedValue({
        serverUrl: 'https://octopus.example.com',
        apiKey: 'API-KEY',
        spaceId: null,
      } as never);
      mockApiClient.validateConnection.mockResolvedValue({
        user: { Id: 'Users-1', Username: 'admin' },
        serverVersion: '2023.4.1234',
      } as never);
      mockApiClient.getSpaces.mockResolvedValue(mockSpaces as never);
      mockApiClient.getLicenseStatus.mockResolvedValue(null);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

      expect(result.current.currentSpace?.Id).toBe('Spaces-2');
    });

    it('should still authenticate when space and license lookups fail', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      mockSecurity.hasCredentials.mockResolvedValue(true);
      mockApiClient.validateConnection.mockResolvedValue({
        user: { Id: 'Users-1', Username: 'admin' },
        serverVersion: '2023.4.1234',
      } as never);
      mockApiClient.getSpaces.mockRejectedValue(new Error('Spaces unavailable'));
      mockApiClient.getLicenseStatus.mockRejectedValue(new Error('License unavailable'));

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

      expect(result.current.currentSpace).toBeNull();
      expect(result.current.licenseStatus).toBeNull();
      expect(result.current.isEnterprise).toBe(false);

      warnSpy.mockRestore();
    });

    it('should clear credentials when restore fails with an auth error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      mockSecurity.hasCredentials.mockResolvedValue(true);
      mockApiClient.validateConnection.mockRejectedValue(createApiError('Unauthorized', true));

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBeTruthy();
      expect(mockSecurity.clearCredentials).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should not clear credentials when restore fails with a non-auth error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      mockSecurity.hasCredentials.mockResolvedValue(true);
      mockApiClient.validateConnection.mockRejectedValue(new Error('Server exploded'));

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBe('Server exploded');
      expect(mockSecurity.clearCredentials).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('login edge cases', () => {
    it('should fail when saving the instance fails', async () => {
      mockApiClient.validateConnection.mockResolvedValue({
        user: { Id: 'Users-1', Username: 'admin' },
        serverVersion: '2023.4.1234',
      } as never);
      mockSecurity.addInstance.mockResolvedValue({
        success: false,
        error: 'Instance already exists',
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let loginResult: { success: boolean; error?: string };

      await act(async () => {
        loginResult = await result.current.login(
          'https://octopus.example.com',
          'API-VALIDKEY123456789012345'
        );
      });

      expect(loginResult!.success).toBe(false);
      expect(loginResult!.error).toBe('Instance already exists');
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should fall back to default space when no spaceId given', async () => {
      const mockSpaces = [
        { Id: 'Spaces-1', Name: 'Other', IsDefault: false },
        { Id: 'Spaces-2', Name: 'Default', IsDefault: true },
      ];

      mockApiClient.validateConnection.mockResolvedValue({
        user: { Id: 'Users-1', Username: 'admin' },
        serverVersion: '2023.4.1234',
      } as never);
      mockApiClient.getSpaces.mockResolvedValue(mockSpaces as never);
      mockApiClient.getLicenseStatus.mockResolvedValue(null);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.login('https://octopus.example.com', 'API-VALIDKEY123456789012345');
      });

      expect(result.current.currentSpace?.Id).toBe('Spaces-2');
    });

    it('should still login when space and license lookups fail', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      mockApiClient.validateConnection.mockResolvedValue({
        user: { Id: 'Users-1', Username: 'admin' },
        serverVersion: '2023.4.1234',
      } as never);
      mockApiClient.getSpaces.mockRejectedValue(new Error('Spaces unavailable'));
      mockApiClient.getLicenseStatus.mockRejectedValue(new Error('License unavailable'));

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let loginResult: { success: boolean; error?: string };

      await act(async () => {
        loginResult = await result.current.login(
          'https://octopus.example.com',
          'API-VALIDKEY123456789012345'
        );
      });

      expect(loginResult!.success).toBe(true);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.currentSpace).toBeNull();
      expect(result.current.isEnterprise).toBe(false);

      warnSpy.mockRestore();
    });
  });

  describe('logout edge cases', () => {
    it('should still logout when clearing credentials fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      mockSecurity.hasCredentials.mockResolvedValue(true);
      mockApiClient.validateConnection.mockResolvedValue({
        user: { Id: 'Users-1', Username: 'admin' },
        serverVersion: '2023.4.1234',
      } as never);
      mockApiClient.getSpaces.mockResolvedValue([]);
      mockApiClient.getLicenseStatus.mockResolvedValue(null);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

      mockSecurity.clearCredentials.mockRejectedValue(new Error('Keychain error'));

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to clear credentials:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('switchSpace edge cases', () => {
    it('should log an error when switching space fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      mockSecurity.updateSpaceId.mockRejectedValue(new Error('Update failed'));

      await act(async () => {
        await result.current.switchSpace('Spaces-2');
      });

      expect(consoleSpy).toHaveBeenCalledWith('Failed to switch space:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('refreshUser', () => {
    it('should update the user on success', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const refreshedUser = { Id: 'Users-2', Username: 'refreshed', DisplayName: 'Refreshed' };
      mockApiClient.validateConnection.mockResolvedValue({
        user: refreshedUser,
        serverVersion: '2024.1.0',
      } as never);

      await act(async () => {
        await result.current.refreshUser();
      });

      expect(result.current.user).toEqual(refreshedUser);
      expect(result.current.serverVersion).toBe('2024.1.0');
    });

    it('should logout when refresh fails with an auth error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      mockApiClient.validateConnection.mockRejectedValue(createApiError('Unauthorized', true));

      await act(async () => {
        await result.current.refreshUser();
      });

      expect(mockSecurity.clearCredentials).toHaveBeenCalled();
      expect(result.current.isAuthenticated).toBe(false);

      consoleSpy.mockRestore();
    });

    it('should only log when refresh fails with a non-auth error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      mockApiClient.validateConnection.mockRejectedValue(new Error('Network error'));

      await act(async () => {
        await result.current.refreshUser();
      });

      expect(mockSecurity.clearCredentials).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to refresh user:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('switchInstance', () => {
    it('should switch instance successfully', async () => {
      const mockInstance = {
        id: 'inst-2',
        name: 'Secondary',
        serverUrl: 'https://other.example.com',
        createdAt: new Date().toISOString(),
      } as never;
      const mockSpaces = [{ Id: 'Spaces-1', Name: 'Default', IsDefault: true }];

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      mockSecurity.switchInstance.mockResolvedValue({ success: true });
      mockSecurity.getCredentials.mockResolvedValue({
        serverUrl: 'https://other.example.com',
        apiKey: 'API-KEY',
        spaceId: 'Spaces-1',
      } as never);
      mockSecurity.getInstances.mockResolvedValue([mockInstance]);
      mockSecurity.getCurrentInstance.mockResolvedValue(mockInstance);
      mockApiClient.validateConnection.mockResolvedValue({
        user: { Id: 'Users-1', Username: 'admin' },
        serverVersion: '2024.1.0',
      } as never);
      mockApiClient.getSpaces.mockResolvedValue(mockSpaces as never);
      mockApiClient.getLicenseStatus.mockResolvedValue({
        LicenseType: 'Enterprise',
        HostingEnvironment: 'SelfHosted',
      } as never);

      let switchResult: { success: boolean; error?: string };

      await act(async () => {
        switchResult = await result.current.switchInstance('inst-2');
      });

      expect(switchResult!.success).toBe(true);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.currentInstance).toEqual(mockInstance);
      expect(result.current.currentSpace?.Id).toBe('Spaces-1');
      expect(result.current.isEnterprise).toBe(true);
      expect(mockSecurity.updateInstance).toHaveBeenCalledWith('inst-2', { userId: 'Users-1' });
    });

    it('should fail when the storage switch fails', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      mockSecurity.switchInstance.mockResolvedValue({
        success: false,
        error: 'Instance not found',
      });

      let switchResult: { success: boolean; error?: string };

      await act(async () => {
        switchResult = await result.current.switchInstance('inst-missing');
      });

      expect(switchResult!.success).toBe(false);
      expect(switchResult!.error).toBe('Instance not found');
      expect(result.current.error).toBe('Instance not found');
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should fail when connection validation throws', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      mockSecurity.switchInstance.mockResolvedValue({ success: true });
      mockApiClient.validateConnection.mockRejectedValue(new Error('Connection refused'));

      let switchResult: { success: boolean; error?: string };

      await act(async () => {
        switchResult = await result.current.switchInstance('inst-2');
      });

      expect(switchResult!.success).toBe(false);
      expect(switchResult!.error).toBe('Connection refused');
      expect(result.current.error).toBe('Connection refused');
    });

    it('should use default space and tolerate license failures', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const mockSpaces = [
        { Id: 'Spaces-1', Name: 'Other', IsDefault: false },
        { Id: 'Spaces-2', Name: 'Default', IsDefault: true },
      ];

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      mockSecurity.switchInstance.mockResolvedValue({ success: true });
      mockSecurity.getCredentials.mockResolvedValue(null);
      mockApiClient.validateConnection.mockResolvedValue({
        user: { Id: 'Users-1', Username: 'admin' },
        serverVersion: '2024.1.0',
      } as never);
      mockApiClient.getSpaces.mockResolvedValue(mockSpaces as never);
      mockApiClient.getLicenseStatus.mockRejectedValue(new Error('License unavailable'));

      let switchResult: { success: boolean; error?: string };

      await act(async () => {
        switchResult = await result.current.switchInstance('inst-2');
      });

      expect(switchResult!.success).toBe(true);
      expect(result.current.currentSpace?.Id).toBe('Spaces-2');
      expect(result.current.isEnterprise).toBe(false);

      warnSpy.mockRestore();
    });

    it('should tolerate space lookup failures', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      mockSecurity.switchInstance.mockResolvedValue({ success: true });
      mockApiClient.validateConnection.mockResolvedValue({
        user: { Id: 'Users-1', Username: 'admin' },
        serverVersion: '2024.1.0',
      } as never);
      mockApiClient.getSpaces.mockRejectedValue(new Error('Spaces unavailable'));
      mockApiClient.getLicenseStatus.mockResolvedValue(null);

      let switchResult: { success: boolean; error?: string };

      await act(async () => {
        switchResult = await result.current.switchInstance('inst-2');
      });

      expect(switchResult!.success).toBe(true);
      expect(result.current.currentSpace).toBeNull();

      warnSpy.mockRestore();
    });
  });

  describe('instance management', () => {
    it('should delete an instance and refresh the list', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const remaining = [
        { id: 'inst-1', name: 'Primary', serverUrl: 'https://a', createdAt: '' },
      ] as never;
      mockSecurity.getInstances.mockResolvedValue(remaining);

      await act(async () => {
        await result.current.deleteInstance('inst-2');
      });

      expect(mockSecurity.removeInstance).toHaveBeenCalledWith('inst-2');
      expect(result.current.instances).toEqual(remaining);
    });

    it('should refresh instances', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const instances = [
        { id: 'inst-1', name: 'Primary', serverUrl: 'https://a', createdAt: '' },
        { id: 'inst-2', name: 'Secondary', serverUrl: 'https://b', createdAt: '' },
      ] as never;
      mockSecurity.getInstances.mockResolvedValue(instances);
      mockSecurity.getCurrentInstance.mockResolvedValue(instances[0]);

      await act(async () => {
        await result.current.refreshInstances();
      });

      expect(result.current.instances).toEqual(instances);
      expect(result.current.currentInstance).toEqual(instances[0]);
    });

    it('should rename an instance', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.renameInstance('inst-1', 'New Name');
      });

      expect(mockSecurity.updateInstance).toHaveBeenCalledWith('inst-1', { name: 'New Name' });
    });

    it('should update an instance API key successfully', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      mockSecurity.updateInstanceApiKey.mockResolvedValue({ success: true });

      let updateResult: { success: boolean; error?: string };

      await act(async () => {
        updateResult = await result.current.updateInstanceApiKey('inst-1', 'API-NEWKEY');
      });

      expect(updateResult!.success).toBe(true);
      expect(mockSecurity.updateInstanceApiKey).toHaveBeenCalledWith('inst-1', 'API-NEWKEY');
      expect(result.current.error).toBeNull();
    });

    it('should surface errors when updating an instance API key fails', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      mockSecurity.updateInstanceApiKey.mockResolvedValue({
        success: false,
        error: 'Invalid API key',
      });

      let updateResult: { success: boolean; error?: string };

      await act(async () => {
        updateResult = await result.current.updateInstanceApiKey('inst-1', 'bad-key');
      });

      expect(updateResult!.success).toBe(false);
      expect(result.current.error).toBe('Invalid API key');
    });

    it('should toggle the isAddingInstance flag', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isAddingInstance).toBe(false);

      act(() => {
        result.current.startAddingInstance();
      });
      expect(result.current.isAddingInstance).toBe(true);

      act(() => {
        result.current.cancelAddingInstance();
      });
      expect(result.current.isAddingInstance).toBe(false);
    });
  });
});

