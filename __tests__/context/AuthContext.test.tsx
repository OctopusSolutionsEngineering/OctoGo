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
  });

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
});

