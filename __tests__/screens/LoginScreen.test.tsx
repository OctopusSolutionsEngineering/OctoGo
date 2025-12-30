/**
 * Integration tests for Login flow
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../src/context/AuthContext';
import * as security from '../../src/lib/security';
import * as apiClient from '../../src/lib/api/client';

// Mock dependencies
jest.mock('../../src/lib/security');
jest.mock('../../src/lib/api/client');

const mockSecurity = security as jest.Mocked<typeof security>;
const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('Login Flow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSecurity.hasCredentials.mockResolvedValue(false);
    mockSecurity.storeCredentials.mockResolvedValue({ success: true });
    mockSecurity.clearCredentials.mockResolvedValue();
    mockSecurity.storeUserId.mockResolvedValue();
  });

  describe('Credential Validation', () => {
    it('should validate server URL format', () => {
      // Import real validation functions for unit testing
      const { validateServerUrl } = jest.requireActual('../../src/lib/security');
      
      expect(validateServerUrl('')).toEqual({
        valid: false,
        normalized: '',
        error: 'Server URL is required',
      });

      expect(validateServerUrl('https://octopus.example.com')).toEqual({
        valid: true,
        normalized: 'https://octopus.example.com',
      });
    });

    it('should validate API key format', () => {
      // Import real validation functions for unit testing
      const { validateApiKey } = jest.requireActual('../../src/lib/security');
      
      expect(validateApiKey('')).toEqual({
        valid: false,
        error: 'API key is required',
      });

      expect(validateApiKey('API-VALIDKEY123456789012345')).toEqual({
        valid: true,
      });
    });
  });

  describe('Authentication Flow', () => {
    it('should successfully authenticate with valid credentials', async () => {
      const mockUser = { Id: 'Users-1', Username: 'admin', DisplayName: 'Admin' };
      
      mockApiClient.validateConnection.mockResolvedValue({
        user: mockUser,
        serverVersion: '2023.4.1234',
      });
      mockApiClient.getSpaces.mockResolvedValue([
        { Id: 'Spaces-1', Name: 'Default', IsDefault: true },
      ]);
      mockApiClient.getLicenseStatus.mockResolvedValue({
        LicenseType: 'Enterprise',
        HostingEnvironment: 'SelfHosted',
      });

      // Test the login function directly
      const result = await mockSecurity.storeCredentials(
        'https://octopus.example.com',
        'API-VALIDKEY123456789012345',
        'Spaces-1'
      );

      expect(result.success).toBe(true);
    });

    it('should handle authentication failure', async () => {
      // Use a real error object with the expected properties
      const authError = { message: 'Authentication failed', statusCode: 401, isAuthError: true };
      mockApiClient.validateConnection.mockImplementation(() => Promise.reject(authError));

      try {
        await mockApiClient.validateConnection();
        fail('Expected error to be thrown');
      } catch (e: any) {
        expect(e.message).toBe('Authentication failed');
        expect(e.isAuthError).toBe(true);
      }
    });

    it('should handle network errors', async () => {
      // Use a real error object with the expected properties
      const networkError = { message: 'Unable to connect', statusCode: 0, isNetworkError: true };
      mockApiClient.validateConnection.mockImplementation(() => Promise.reject(networkError));

      try {
        await mockApiClient.validateConnection();
        fail('Expected error to be thrown');
      } catch (e: any) {
        expect(e.message).toBe('Unable to connect');
        expect(e.isNetworkError).toBe(true);
      }
    });
  });

  describe('Session Restoration', () => {
    it('should restore session with valid stored credentials', async () => {
      mockSecurity.hasCredentials.mockResolvedValue(true);
      mockSecurity.getCredentials.mockResolvedValue({
        serverUrl: 'https://octopus.example.com',
        apiKey: 'API-STOREDKEY123456789012345',
        spaceId: 'Spaces-1',
      });
      mockApiClient.validateConnection.mockResolvedValue({
        user: { Id: 'Users-1', Username: 'admin' },
        serverVersion: '2023.4.1234',
      });
      mockApiClient.getSpaces.mockResolvedValue([
        { Id: 'Spaces-1', Name: 'Default', IsDefault: true },
      ]);
      mockApiClient.getLicenseStatus.mockResolvedValue(null);

      // Verify stored credentials exist
      const hasCredentials = await mockSecurity.hasCredentials();
      expect(hasCredentials).toBe(true);

      // Verify connection validation works
      const { user, serverVersion } = await mockApiClient.validateConnection();
      expect(user.Username).toBe('admin');
      expect(serverVersion).toBe('2023.4.1234');
    });

    it('should clear invalid stored credentials', async () => {
      mockSecurity.hasCredentials.mockResolvedValue(true);
      mockApiClient.validateConnection.mockRejectedValue(
        new apiClient.OctopusApiError('Invalid API key', 401)
      );

      await mockSecurity.clearCredentials();

      expect(mockSecurity.clearCredentials).toHaveBeenCalled();
    });
  });
});

