/**
 * Tests for security utilities
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  getInstances,
  getCurrentInstanceId,
  setCurrentInstanceId,
  getInstanceApiKey,
  updateInstanceApiKey,
  getInstanceCredentials,
  getAllInstanceCredentials,
  addInstance,
  updateInstance,
  removeInstance,
  switchInstance,
  getCurrentInstance,
  migrateToMultiInstance,
  clearAllInstances,
  type OctopusInstance,
} from '../../src/lib/security';

// Mock SecureStore
jest.mock('expo-secure-store');

const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

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
      const result = validateApiKey('FAKE-KEY-ABCDEFGHIJKLMNOPQRSTUVWXYZ');
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
      const result = validateApiKey('  FAKE-KEY-ABCDEFGHIJKLMNOPQRSTUVWXYZ  ');
      expect(result.valid).toBe(true);
    });
  });

  // ==========================================================================
  // storeCredentials
  // ==========================================================================
  describe('storeCredentials', () => {
    const validUrl = 'https://octopus.example.com';
    const validApiKey = 'FAKE-KEY-ABCDEFGHIJKLMNOPQRSTUVWXYZ';

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
        if (key === 'octopus_api_key') return Promise.resolve('FAKE-KEY-123456789012345678901234');
        if (key === 'octopus_space_id') return Promise.resolve('Spaces-1');
        return Promise.resolve(null);
      });

      const result = await getCredentials();
      
      expect(result).toEqual({
        serverUrl: 'https://example.com',
        apiKey: 'FAKE-KEY-123456789012345678901234',
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
      const result = maskApiKey('FAKE-KEY-ABCDEFGHIJKLMNOPQRSTU');
      expect(result).toBe('FAKE...RSTU');
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

  // ==========================================================================
  // Multi-Instance Support
  // ==========================================================================
  describe('Multi-Instance Support', () => {
    const validApiKey = 'FAKE-KEY-ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    const instanceA: OctopusInstance = {
      id: 'instance_1_aaa',
      name: 'Instance A',
      serverUrl: 'https://a.octopus.app',
      spaceId: 'Spaces-1',
      createdAt: 1000,
    };

    const instanceB: OctopusInstance = {
      id: 'instance_2_bbb',
      name: 'Instance B',
      serverUrl: 'https://b.octopus.app',
      createdAt: 2000,
    };

    const setStoredInstances = (instances: OctopusInstance[], currentId: string | null = null) => {
      mockAsyncStorage.getItem.mockImplementation((key: string) => {
        if (key === 'octopus_instances') return Promise.resolve(JSON.stringify(instances));
        if (key === 'octopus_current_instance_id') return Promise.resolve(currentId);
        return Promise.resolve(null);
      });
    };

    beforeEach(() => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockAsyncStorage.setItem.mockResolvedValue(undefined);
      mockAsyncStorage.removeItem.mockResolvedValue(undefined);
      mockSecureStore.getItemAsync.mockResolvedValue(null);
      mockSecureStore.setItemAsync.mockResolvedValue();
      mockSecureStore.deleteItemAsync.mockResolvedValue();
      jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    // ------------------------------------------------------------------
    // getInstances
    // ------------------------------------------------------------------
    describe('getInstances', () => {
      it('should return empty array when nothing is stored', async () => {
        const result = await getInstances();
        expect(result).toEqual([]);
      });

      it('should return parsed instances', async () => {
        setStoredInstances([instanceA, instanceB]);

        const result = await getInstances();

        expect(result).toEqual([instanceA, instanceB]);
      });

      it('should return empty array on storage error', async () => {
        mockAsyncStorage.getItem.mockRejectedValue(new Error('Read error'));

        const result = await getInstances();

        expect(result).toEqual([]);
      });
    });

    // ------------------------------------------------------------------
    // getCurrentInstanceId / setCurrentInstanceId
    // ------------------------------------------------------------------
    describe('getCurrentInstanceId / setCurrentInstanceId', () => {
      it('should return the stored current instance ID', async () => {
        mockAsyncStorage.getItem.mockResolvedValue('instance_1_aaa');

        const result = await getCurrentInstanceId();

        expect(result).toBe('instance_1_aaa');
        expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('octopus_current_instance_id');
      });

      it('should return null on error', async () => {
        mockAsyncStorage.getItem.mockRejectedValue(new Error('Read error'));

        const result = await getCurrentInstanceId();

        expect(result).toBeNull();
      });

      it('should set the current instance ID', async () => {
        await setCurrentInstanceId('instance_2_bbb');

        expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
          'octopus_current_instance_id',
          'instance_2_bbb'
        );
      });
    });

    // ------------------------------------------------------------------
    // getInstanceApiKey
    // ------------------------------------------------------------------
    describe('getInstanceApiKey', () => {
      it('should read the instance-specific API key', async () => {
        mockSecureStore.getItemAsync.mockResolvedValue(validApiKey);

        const result = await getInstanceApiKey('instance_1_aaa');

        expect(result).toBe(validApiKey);
        expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith(
          'octopus_api_key_instance_1_aaa',
          expect.any(Object)
        );
      });

      it('should return null on error', async () => {
        mockSecureStore.getItemAsync.mockRejectedValue(new Error('Read error'));

        const result = await getInstanceApiKey('instance_1_aaa');

        expect(result).toBeNull();
      });
    });

    // ------------------------------------------------------------------
    // updateInstanceApiKey
    // ------------------------------------------------------------------
    describe('updateInstanceApiKey', () => {
      it('should reject invalid API keys', async () => {
        const result = await updateInstanceApiKey(instanceA.id, 'short');

        expect(result.success).toBe(false);
        expect(result.error).toBe('API key appears to be too short');
        expect(mockSecureStore.setItemAsync).not.toHaveBeenCalled();
      });

      it('should fail when the instance does not exist', async () => {
        setStoredInstances([instanceA]);

        const result = await updateInstanceApiKey('missing-id', validApiKey);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Instance not found');
      });

      it('should update the key for a non-current instance without touching legacy credentials', async () => {
        setStoredInstances([instanceA, instanceB], instanceB.id);

        const result = await updateInstanceApiKey(instanceA.id, `  ${validApiKey}  `);

        expect(result.success).toBe(true);
        expect(mockSecureStore.setItemAsync).toHaveBeenCalledTimes(1);
        expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
          `octopus_api_key_${instanceA.id}`,
          validApiKey,
          expect.any(Object)
        );
      });

      it('should sync legacy credentials when updating the current instance', async () => {
        setStoredInstances([instanceA], instanceA.id);

        const result = await updateInstanceApiKey(instanceA.id, validApiKey);

        expect(result.success).toBe(true);
        expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
          `octopus_api_key_${instanceA.id}`,
          validApiKey,
          expect.any(Object)
        );
        expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
          'octopus_server_url',
          instanceA.serverUrl,
          expect.any(Object)
        );
        expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
          'octopus_api_key',
          validApiKey,
          expect.any(Object)
        );
        expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
          'octopus_space_id',
          instanceA.spaceId,
          expect.any(Object)
        );
      });

      it('should return a generic error when storage fails', async () => {
        setStoredInstances([instanceA]);
        mockSecureStore.setItemAsync.mockRejectedValue(new Error('Storage error'));

        const result = await updateInstanceApiKey(instanceA.id, validApiKey);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Failed to update API key');
      });
    });

    // ------------------------------------------------------------------
    // getInstanceCredentials
    // ------------------------------------------------------------------
    describe('getInstanceCredentials', () => {
      it('should return null when the instance does not exist', async () => {
        setStoredInstances([instanceA]);

        const result = await getInstanceCredentials('missing-id');

        expect(result).toBeNull();
      });

      it('should return null when the API key is missing', async () => {
        setStoredInstances([instanceA]);
        mockSecureStore.getItemAsync.mockResolvedValue(null);

        const result = await getInstanceCredentials(instanceA.id);

        expect(result).toBeNull();
      });

      it('should return full credentials for an instance', async () => {
        setStoredInstances([instanceA]);
        mockSecureStore.getItemAsync.mockResolvedValue(validApiKey);

        const result = await getInstanceCredentials(instanceA.id);

        expect(result).toEqual({
          serverUrl: instanceA.serverUrl,
          apiKey: validApiKey,
          spaceId: instanceA.spaceId,
          instanceName: instanceA.name,
        });
      });

      it('should return null spaceId when the instance has none', async () => {
        setStoredInstances([instanceB]);
        mockSecureStore.getItemAsync.mockResolvedValue(validApiKey);

        const result = await getInstanceCredentials(instanceB.id);

        expect(result?.spaceId).toBeNull();
      });

      it('should return null on unexpected errors', async () => {
        // Malformed instances payload (non-array) makes .find throw
        mockAsyncStorage.getItem.mockResolvedValue('{}');

        const result = await getInstanceCredentials(instanceA.id);

        expect(result).toBeNull();
      });
    });

    // ------------------------------------------------------------------
    // getAllInstanceCredentials
    // ------------------------------------------------------------------
    describe('getAllInstanceCredentials', () => {
      it('should return credentials for all instances with keys', async () => {
        setStoredInstances([instanceA, instanceB]);
        mockSecureStore.getItemAsync.mockImplementation((key: string) => {
          if (key === `octopus_api_key_${instanceA.id}`) return Promise.resolve('KEY-A');
          if (key === `octopus_api_key_${instanceB.id}`) return Promise.resolve('KEY-B');
          return Promise.resolve(null);
        });

        const result = await getAllInstanceCredentials();

        expect(result).toEqual([
          {
            instanceId: instanceA.id,
            serverUrl: instanceA.serverUrl,
            apiKey: 'KEY-A',
            spaceId: instanceA.spaceId,
            instanceName: instanceA.name,
          },
          {
            instanceId: instanceB.id,
            serverUrl: instanceB.serverUrl,
            apiKey: 'KEY-B',
            spaceId: null,
            instanceName: instanceB.name,
          },
        ]);
      });

      it('should filter out instances without stored API keys', async () => {
        setStoredInstances([instanceA, instanceB]);
        mockSecureStore.getItemAsync.mockImplementation((key: string) => {
          if (key === `octopus_api_key_${instanceA.id}`) return Promise.resolve('KEY-A');
          return Promise.resolve(null);
        });

        const result = await getAllInstanceCredentials();

        expect(result).toHaveLength(1);
        expect(result[0].instanceId).toBe(instanceA.id);
      });

      it('should return empty array on unexpected errors', async () => {
        mockAsyncStorage.getItem.mockResolvedValue('{}');

        const result = await getAllInstanceCredentials();

        expect(result).toEqual([]);
      });
    });

    // ------------------------------------------------------------------
    // addInstance
    // ------------------------------------------------------------------
    describe('addInstance', () => {
      it('should reject an invalid server URL', async () => {
        const result = await addInstance('', validApiKey);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Server URL is required');
      });

      it('should reject an invalid API key', async () => {
        const result = await addInstance('https://a.octopus.app', 'short');

        expect(result.success).toBe(false);
        expect(result.error).toBe('API key appears to be too short');
      });

      it('should add an instance with an explicit name', async () => {
        const result = await addInstance('https://a.octopus.app/', validApiKey, 'My Server', 'Spaces-7');

        expect(result.success).toBe(true);
        expect(result.instanceId).toMatch(/^instance_\d+_/);

        // Instance persisted to AsyncStorage
        const persisted = JSON.parse(
          mockAsyncStorage.setItem.mock.calls.find(([key]) => key === 'octopus_instances')![1]
        );
        expect(persisted).toHaveLength(1);
        expect(persisted[0]).toMatchObject({
          id: result.instanceId,
          name: 'My Server',
          serverUrl: 'https://a.octopus.app',
          spaceId: 'Spaces-7',
        });

        // API key stored under instance-specific key
        expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
          `octopus_api_key_${result.instanceId}`,
          validApiKey,
          expect.any(Object)
        );

        // Set as current instance
        expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
          'octopus_current_instance_id',
          result.instanceId
        );

        // Legacy credentials also stored
        expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
          'octopus_api_key',
          validApiKey,
          expect.any(Object)
        );
      });

      it('should derive the instance name from the URL hostname when not provided', async () => {
        const result = await addInstance('https://my.octopus.app', validApiKey);

        expect(result.success).toBe(true);
        const persisted = JSON.parse(
          mockAsyncStorage.setItem.mock.calls.find(([key]) => key === 'octopus_instances')![1]
        );
        expect(persisted[0].name).toBe('my.octopus.app');
      });

      it('should append to existing instances', async () => {
        setStoredInstances([instanceA]);

        const result = await addInstance('https://b.octopus.app', validApiKey);

        expect(result.success).toBe(true);
        const persisted = JSON.parse(
          mockAsyncStorage.setItem.mock.calls.find(([key]) => key === 'octopus_instances')![1]
        );
        expect(persisted).toHaveLength(2);
        expect(persisted[0].id).toBe(instanceA.id);
      });

      it('should return an error when storage fails', async () => {
        mockAsyncStorage.setItem.mockRejectedValue(new Error('Storage error'));

        const result = await addInstance('https://a.octopus.app', validApiKey);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Failed to add instance. Please try again.');
      });
    });

    // ------------------------------------------------------------------
    // updateInstance
    // ------------------------------------------------------------------
    describe('updateInstance', () => {
      it('should fail when the instance does not exist', async () => {
        setStoredInstances([instanceA]);

        const result = await updateInstance('missing-id', { name: 'New Name' });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Instance not found');
        expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();
      });

      it('should merge updates into the instance', async () => {
        setStoredInstances([instanceA, instanceB]);

        const result = await updateInstance(instanceB.id, { name: 'Renamed', spaceId: 'Spaces-9' });

        expect(result.success).toBe(true);
        const persisted = JSON.parse(mockAsyncStorage.setItem.mock.calls[0][1]);
        expect(persisted[1]).toMatchObject({
          id: instanceB.id,
          name: 'Renamed',
          spaceId: 'Spaces-9',
          serverUrl: instanceB.serverUrl,
        });
        // Other instances untouched
        expect(persisted[0]).toEqual(instanceA);
      });

      it('should return an error when storage fails', async () => {
        setStoredInstances([instanceA]);
        mockAsyncStorage.setItem.mockRejectedValue(new Error('Storage error'));

        const result = await updateInstance(instanceA.id, { name: 'New' });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Failed to update instance');
      });
    });

    // ------------------------------------------------------------------
    // removeInstance
    // ------------------------------------------------------------------
    describe('removeInstance', () => {
      it('should remove the instance, its API key, and keep current instance if different', async () => {
        setStoredInstances([instanceA, instanceB], instanceB.id);

        await removeInstance(instanceA.id);

        expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
          `octopus_api_key_${instanceA.id}`
        );
        const persisted = JSON.parse(mockAsyncStorage.setItem.mock.calls[0][1]);
        expect(persisted).toEqual([instanceB]);
        expect(mockAsyncStorage.removeItem).not.toHaveBeenCalled();
      });

      it('should clear the current instance ID when removing the current instance', async () => {
        setStoredInstances([instanceA, instanceB], instanceA.id);

        await removeInstance(instanceA.id);

        expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('octopus_current_instance_id');
      });

      it('should throw when removal fails', async () => {
        mockSecureStore.deleteItemAsync.mockRejectedValue(new Error('Delete error'));

        await expect(removeInstance(instanceA.id)).rejects.toThrow('Failed to remove instance');
      });
    });

    // ------------------------------------------------------------------
    // switchInstance
    // ------------------------------------------------------------------
    describe('switchInstance', () => {
      it('should fail when the instance does not exist', async () => {
        setStoredInstances([instanceA]);

        const result = await switchInstance('missing-id');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Instance not found');
      });

      it('should fail when the instance has no stored API key', async () => {
        setStoredInstances([instanceA]);
        mockSecureStore.getItemAsync.mockResolvedValue(null);

        const result = await switchInstance(instanceA.id);

        expect(result.success).toBe(false);
        expect(result.error).toBe('API key not found for this instance');
      });

      it('should update legacy credentials and set the current instance', async () => {
        setStoredInstances([instanceA]);
        mockSecureStore.getItemAsync.mockResolvedValue(validApiKey);

        const result = await switchInstance(instanceA.id);

        expect(result.success).toBe(true);
        expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
          'octopus_server_url',
          instanceA.serverUrl,
          expect.any(Object)
        );
        expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
          'octopus_api_key',
          validApiKey,
          expect.any(Object)
        );
        expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
          'octopus_current_instance_id',
          instanceA.id
        );
      });

      it('should return an error when switching fails', async () => {
        setStoredInstances([instanceA]);
        mockSecureStore.getItemAsync.mockResolvedValue(validApiKey);
        mockAsyncStorage.setItem.mockRejectedValue(new Error('Storage error'));

        const result = await switchInstance(instanceA.id);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Failed to switch instance');
      });
    });

    // ------------------------------------------------------------------
    // getCurrentInstance
    // ------------------------------------------------------------------
    describe('getCurrentInstance', () => {
      it('should return null when no current instance is set', async () => {
        mockAsyncStorage.getItem.mockResolvedValue(null);

        const result = await getCurrentInstance();

        expect(result).toBeNull();
      });

      it('should return the current instance', async () => {
        setStoredInstances([instanceA, instanceB], instanceB.id);

        const result = await getCurrentInstance();

        expect(result).toEqual(instanceB);
      });

      it('should return null when the current instance is not in the list', async () => {
        setStoredInstances([instanceA], 'missing-id');

        const result = await getCurrentInstance();

        expect(result).toBeNull();
      });

      it('should return null on unexpected errors', async () => {
        mockAsyncStorage.getItem.mockImplementation((key: string) => {
          if (key === 'octopus_current_instance_id') return Promise.resolve(instanceA.id);
          // Malformed instances payload (non-array) makes .find throw
          return Promise.resolve('{}');
        });

        const result = await getCurrentInstance();

        expect(result).toBeNull();
      });
    });

    // ------------------------------------------------------------------
    // migrateToMultiInstance
    // ------------------------------------------------------------------
    describe('migrateToMultiInstance', () => {
      it('should skip migration when instances already exist', async () => {
        setStoredInstances([instanceA]);

        await migrateToMultiInstance();

        expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();
        expect(mockSecureStore.setItemAsync).not.toHaveBeenCalled();
      });

      it('should skip migration when there are no legacy credentials', async () => {
        mockSecureStore.getItemAsync.mockResolvedValue(null);

        await migrateToMultiInstance();

        expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();
      });

      it('should migrate legacy credentials to an instance', async () => {
        mockSecureStore.getItemAsync.mockImplementation((key: string) => {
          if (key === 'octopus_server_url') return Promise.resolve('https://legacy.octopus.app');
          if (key === 'octopus_api_key') return Promise.resolve(validApiKey);
          if (key === 'octopus_space_id') return Promise.resolve('Spaces-3');
          return Promise.resolve(null);
        });

        await migrateToMultiInstance();

        const persisted = JSON.parse(
          mockAsyncStorage.setItem.mock.calls.find(([key]) => key === 'octopus_instances')![1]
        );
        expect(persisted).toHaveLength(1);
        expect(persisted[0]).toMatchObject({
          name: 'legacy.octopus.app',
          serverUrl: 'https://legacy.octopus.app',
          spaceId: 'Spaces-3',
        });
        expect(persisted[0].id).toMatch(/^instance_\d+_/);

        expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
          `octopus_api_key_${persisted[0].id}`,
          validApiKey,
          expect.any(Object)
        );
        expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
          'octopus_current_instance_id',
          persisted[0].id
        );
      });

      it('should migrate without a space ID', async () => {
        mockSecureStore.getItemAsync.mockImplementation((key: string) => {
          if (key === 'octopus_server_url') return Promise.resolve('https://legacy.octopus.app');
          if (key === 'octopus_api_key') return Promise.resolve(validApiKey);
          return Promise.resolve(null);
        });

        await migrateToMultiInstance();

        const persisted = JSON.parse(
          mockAsyncStorage.setItem.mock.calls.find(([key]) => key === 'octopus_instances')![1]
        );
        expect(persisted[0].spaceId).toBeUndefined();
      });

      it('should swallow errors during migration', async () => {
        mockSecureStore.getItemAsync.mockImplementation((key: string) => {
          if (key === 'octopus_server_url') return Promise.resolve('https://legacy.octopus.app');
          if (key === 'octopus_api_key') return Promise.resolve(validApiKey);
          return Promise.resolve(null);
        });
        mockAsyncStorage.setItem.mockRejectedValue(new Error('Storage error'));

        await expect(migrateToMultiInstance()).resolves.toBeUndefined();
      });
    });

    // ------------------------------------------------------------------
    // clearAllInstances
    // ------------------------------------------------------------------
    describe('clearAllInstances', () => {
      it('should clear all instance keys, the instance list, and legacy credentials', async () => {
        setStoredInstances([instanceA, instanceB], instanceA.id);

        await clearAllInstances();

        expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
          `octopus_api_key_${instanceA.id}`
        );
        expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
          `octopus_api_key_${instanceB.id}`
        );
        expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('octopus_instances');
        expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('octopus_current_instance_id');
        // Legacy credentials cleared
        expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('octopus_api_key');
        expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('octopus_server_url');
        expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('octopus_space_id');
        expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('octopus_user_id');
      });

      it('should throw when clearing fails', async () => {
        setStoredInstances([instanceA]);
        mockSecureStore.deleteItemAsync.mockRejectedValue(new Error('Delete error'));

        await expect(clearAllInstances()).rejects.toThrow('Failed to clear all instances');
      });
    });
  });
});

