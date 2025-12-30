/**
 * Tests for security utilities
 */

import * as SecureStore from 'expo-secure-store';
import {
  validateServerUrl,
  validateApiKey,
  storeCredentials,
  getCredentials,
  clearCredentials,
  hasCredentials,
  updateSpaceId,
  maskApiKey,
  sanitizePathSegment,
  storeUserId,
  getUserId,
} from '../../src/lib/security';

// Mock SecureStore
jest.mock('expo-secure-store');

const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

describe('Security Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // validateServerUrl
  // ==========================================================================
  describe('validateServerUrl', () => {
    it('should accept valid HTTPS URLs', () => {
      const result = validateServerUrl('https://octopus.example.com');
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('https://octopus.example.com');
    });

    it('should add https:// if no protocol provided', () => {
      const result = validateServerUrl('octopus.example.com');
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('https://octopus.example.com');
    });

    it('should remove trailing slashes', () => {
      const result = validateServerUrl('https://octopus.example.com///');
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('https://octopus.example.com');
    });

    it('should accept HTTP for localhost', () => {
      const result = validateServerUrl('http://localhost:8080');
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('http://localhost:8080');
    });

    it('should accept HTTP for 127.0.0.1', () => {
      const result = validateServerUrl('http://127.0.0.1:8080');
      expect(result.valid).toBe(true);
    });

    it('should reject empty URL', () => {
      const result = validateServerUrl('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Server URL is required');
    });

    it('should reject null URL', () => {
      const result = validateServerUrl(null as any);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Server URL is required');
    });

    it('should reject invalid URL format', () => {
      const result = validateServerUrl('not a valid url!!!');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid URL format');
    });

    it('should trim whitespace', () => {
      const result = validateServerUrl('  https://octopus.example.com  ');
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('https://octopus.example.com');
    });

    it('should handle URLs with paths', () => {
      const result = validateServerUrl('https://octopus.example.com/api');
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('https://octopus.example.com/api');
    });

    it('should reject HTTP for non-localhost servers', () => {
      const result = validateServerUrl('http://octopus.example.com');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('HTTPS is required for secure connections. Please use https://');
    });

    it('should accept HTTP for .local domains', () => {
      const result = validateServerUrl('http://octopus.local:8080');
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('http://octopus.local:8080');
    });
  });

  // ==========================================================================
  // validateApiKey
  // ==========================================================================
  describe('validateApiKey', () => {
    it('should accept valid API key', () => {
      const result = validateApiKey('API-ABCDEFGHIJKLMNOPQRSTUVWXYZ123456');
      expect(result.valid).toBe(true);
    });

    it('should reject empty API key', () => {
      const result = validateApiKey('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('API key is required');
    });

    it('should reject null API key', () => {
      const result = validateApiKey(null as any);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('API key is required');
    });

    it('should reject API key that is too short', () => {
      const result = validateApiKey('API-SHORT');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('API key appears to be too short');
    });

    it('should reject API key with invalid characters', () => {
      const result = validateApiKey('API-ABC<script>alert(1)</script>');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('API key contains invalid characters');
    });

    it('should accept API key with dashes and underscores', () => {
      const result = validateApiKey('API-ABC_DEF-123_456-789-abc');
      expect(result.valid).toBe(true);
    });

    it('should trim whitespace from API key', () => {
      const result = validateApiKey('  API-ABCDEFGHIJKLMNOPQRSTUVWXYZ123456  ');
      expect(result.valid).toBe(true);
    });
  });

  // ==========================================================================
  // storeCredentials
  // ==========================================================================
  describe('storeCredentials', () => {
    const validUrl = 'https://octopus.example.com';
    const validApiKey = 'API-ABCDEFGHIJKLMNOPQRSTUVWXYZ123456';

    beforeEach(() => {
      mockSecureStore.setItemAsync.mockResolvedValue();
      mockSecureStore.deleteItemAsync.mockResolvedValue();
    });

    it('should store credentials successfully', async () => {
      const result = await storeCredentials(validUrl, validApiKey);
      
      expect(result.success).toBe(true);
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'octopus_server_url',
        validUrl,
        expect.any(Object)
      );
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'octopus_api_key',
        validApiKey,
        expect.any(Object)
      );
    });

    it('should store space ID when provided', async () => {
      const spaceId = 'Spaces-1';
      await storeCredentials(validUrl, validApiKey, spaceId);
      
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'octopus_space_id',
        spaceId,
        expect.any(Object)
      );
    });

    it('should delete space ID when not provided', async () => {
      await storeCredentials(validUrl, validApiKey);
      
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('octopus_space_id');
    });

    it('should fail with invalid URL', async () => {
      const result = await storeCredentials('', validApiKey);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Server URL is required');
      expect(mockSecureStore.setItemAsync).not.toHaveBeenCalled();
    });

    it('should fail with invalid API key', async () => {
      const result = await storeCredentials(validUrl, 'short');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('API key appears to be too short');
    });

    it('should handle storage errors', async () => {
      mockSecureStore.setItemAsync.mockRejectedValue(new Error('Storage error'));
      
      const result = await storeCredentials(validUrl, validApiKey);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to securely store credentials. Please try again.');
    });
  });

  // ==========================================================================
  // getCredentials
  // ==========================================================================
  describe('getCredentials', () => {
    it('should return stored credentials', async () => {
      mockSecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'octopus_server_url') return Promise.resolve('https://example.com');
        if (key === 'octopus_api_key') return Promise.resolve('API-KEY123456789012345678901234');
        if (key === 'octopus_space_id') return Promise.resolve('Spaces-1');
        return Promise.resolve(null);
      });

      const result = await getCredentials();
      
      expect(result).toEqual({
        serverUrl: 'https://example.com',
        apiKey: 'API-KEY123456789012345678901234',
        spaceId: 'Spaces-1',
      });
    });

    it('should return null when no credentials stored', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);
      
      const result = await getCredentials();
      
      expect(result).toBeNull();
    });

    it('should return null when API key is missing', async () => {
      mockSecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'octopus_server_url') return Promise.resolve('https://example.com');
        return Promise.resolve(null);
      });
      
      const result = await getCredentials();
      
      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      mockSecureStore.getItemAsync.mockRejectedValue(new Error('Read error'));
      
      const result = await getCredentials();
      
      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // clearCredentials
  // ==========================================================================
  describe('clearCredentials', () => {
    it('should delete all credential keys', async () => {
      mockSecureStore.deleteItemAsync.mockResolvedValue();
      
      await clearCredentials();
      
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('octopus_server_url');
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('octopus_api_key');
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('octopus_space_id');
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('octopus_user_id');
    });

    it('should throw error on failure', async () => {
      mockSecureStore.deleteItemAsync.mockRejectedValue(new Error('Delete error'));
      
      await expect(clearCredentials()).rejects.toThrow('Failed to clear credentials');
    });
  });

  // ==========================================================================
  // hasCredentials
  // ==========================================================================
  describe('hasCredentials', () => {
    it('should return true when API key exists', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue('API-KEY');
      
      const result = await hasCredentials();
      
      expect(result).toBe(true);
    });

    it('should return false when no API key', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);
      
      const result = await hasCredentials();
      
      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockSecureStore.getItemAsync.mockRejectedValue(new Error('Error'));
      
      const result = await hasCredentials();
      
      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // updateSpaceId
  // ==========================================================================
  describe('updateSpaceId', () => {
    it('should set space ID when provided', async () => {
      mockSecureStore.setItemAsync.mockResolvedValue();
      
      await updateSpaceId('Spaces-1');
      
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'octopus_space_id',
        'Spaces-1',
        expect.any(Object)
      );
    });

    it('should delete space ID when null', async () => {
      mockSecureStore.deleteItemAsync.mockResolvedValue();
      
      await updateSpaceId(null);
      
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('octopus_space_id');
    });
  });

  // ==========================================================================
  // storeUserId & getUserId
  // ==========================================================================
  describe('storeUserId / getUserId', () => {
    it('should store user ID', async () => {
      mockSecureStore.setItemAsync.mockResolvedValue();
      
      await storeUserId('Users-1');
      
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'octopus_user_id',
        'Users-1',
        expect.any(Object)
      );
    });

    it('should get stored user ID', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue('Users-1');
      
      const result = await getUserId();
      
      expect(result).toBe('Users-1');
    });
  });

  // ==========================================================================
  // maskApiKey
  // ==========================================================================
  describe('maskApiKey', () => {
    it('should mask long API key', () => {
      const result = maskApiKey('API-ABCDEFGHIJKLMNOPQRSTUVWXYZ');
      expect(result).toBe('API-...WXYZ');
    });

    it('should return **** for short keys', () => {
      const result = maskApiKey('short');
      expect(result).toBe('****');
    });

    it('should return **** for empty string', () => {
      const result = maskApiKey('');
      expect(result).toBe('****');
    });

    it('should return **** for null/undefined', () => {
      const result = maskApiKey(null as any);
      expect(result).toBe('****');
    });
  });

  // ==========================================================================
  // sanitizePathSegment
  // ==========================================================================
  describe('sanitizePathSegment', () => {
    it('should allow alphanumeric characters', () => {
      const result = sanitizePathSegment('Projects-123');
      expect(result).toBe('Projects-123');
    });

    it('should allow underscores', () => {
      const result = sanitizePathSegment('My_Project_1');
      expect(result).toBe('My_Project_1');
    });

    it('should remove special characters', () => {
      const result = sanitizePathSegment('../../../etc/passwd');
      expect(result).toBe('etcpasswd');
    });

    it('should remove script injection attempts', () => {
      const result = sanitizePathSegment('<script>alert(1)</script>');
      expect(result).toBe('scriptalert1script');
    });

    it('should handle empty string', () => {
      const result = sanitizePathSegment('');
      expect(result).toBe('');
    });

    it('should handle null/undefined', () => {
      const result = sanitizePathSegment(null as any);
      expect(result).toBe('');
    });

    it('should remove SQL injection characters', () => {
      const result = sanitizePathSegment("'; DROP TABLE users; --");
      expect(result).toBe('DROPTABLEusers--');
    });
  });
});

