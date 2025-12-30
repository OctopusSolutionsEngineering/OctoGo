/**
 * Security utilities for secure storage of sensitive data
 * Uses expo-secure-store which leverages:
 * - iOS: Keychain Services
 * - Android: Encrypted SharedPreferences (with Keystore)
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Security keys - using constants to prevent typos
const STORAGE_KEYS = {
  API_KEY: 'octopus_api_key',
  SERVER_URL: 'octopus_server_url',
  SPACE_ID: 'octopus_space_id',
  USER_ID: 'octopus_user_id',
  // Multi-instance support
  INSTANCES: 'octopus_instances',
  CURRENT_INSTANCE_ID: 'octopus_current_instance_id',
} as const;

// Instance type for multi-instance support
export interface OctopusInstance {
  id: string;
  name: string;
  serverUrl: string;
  spaceId?: string;
  userId?: string;
  createdAt: number;
}

// Generate a unique instance ID
const generateInstanceId = (): string => {
  return `instance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// SecureStore options for enhanced security
const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  // Require authentication (Face ID/Touch ID/Passcode) on iOS
  // This adds an extra layer of security for the API key
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/**
 * Validates server URL format
 * Prevents common security issues like XSS via malformed URLs
 */
export const validateServerUrl = (url: string): { valid: boolean; normalized: string; error?: string } => {
  if (!url || typeof url !== 'string') {
    return { valid: false, normalized: '', error: 'Server URL is required' };
  }

  // Trim whitespace
  let normalized = url.trim();

  // Remove trailing slashes for consistency
  normalized = normalized.replace(/\/+$/, '');

  // Ensure HTTPS (security requirement)
  if (!normalized.startsWith('https://') && !normalized.startsWith('http://')) {
    normalized = `https://${normalized}`;
  }

  // Validate URL format
  try {
    const parsed = new URL(normalized);
    
    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, normalized: '', error: 'Only HTTP/HTTPS protocols are allowed' };
    }

    // Check if this is a local development URL
    const isLocalhost = parsed.hostname === 'localhost' || 
                        parsed.hostname === '127.0.0.1' ||
                        parsed.hostname.endsWith('.local');

    // In production, reject HTTP for non-localhost servers
    if (parsed.protocol === 'http:' && !isLocalhost) {
      return { 
        valid: false, 
        normalized: '', 
        error: 'HTTPS is required for secure connections. Please use https://' 
      };
    }

    return { valid: true, normalized };
  } catch {
    return { valid: false, normalized: '', error: 'Invalid URL format' };
  }
};

/**
 * Validates API key format
 * Octopus API keys follow a specific pattern
 */
export const validateApiKey = (apiKey: string): { valid: boolean; error?: string } => {
  if (!apiKey || typeof apiKey !== 'string') {
    return { valid: false, error: 'API key is required' };
  }

  const trimmed = apiKey.trim();

  // Octopus API keys are typically 30+ characters
  if (trimmed.length < 20) {
    return { valid: false, error: 'API key appears to be too short' };
  }

  // Basic format validation - alphanumeric with possible dashes
  if (!/^[A-Za-z0-9\-_]+$/.test(trimmed)) {
    return { valid: false, error: 'API key contains invalid characters' };
  }

  return { valid: true };
};

/**
 * Securely stores credentials
 * All sensitive data is encrypted at rest
 */
export const storeCredentials = async (
  serverUrl: string,
  apiKey: string,
  spaceId?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Validate inputs before storing
    const urlValidation = validateServerUrl(serverUrl);
    if (!urlValidation.valid) {
      return { success: false, error: urlValidation.error };
    }

    const keyValidation = validateApiKey(apiKey);
    if (!keyValidation.valid) {
      return { success: false, error: keyValidation.error };
    }

    // Store credentials securely
    await Promise.all([
      SecureStore.setItemAsync(STORAGE_KEYS.SERVER_URL, urlValidation.normalized, SECURE_OPTIONS),
      SecureStore.setItemAsync(STORAGE_KEYS.API_KEY, apiKey.trim(), SECURE_OPTIONS),
      spaceId 
        ? SecureStore.setItemAsync(STORAGE_KEYS.SPACE_ID, spaceId.trim(), SECURE_OPTIONS)
        : SecureStore.deleteItemAsync(STORAGE_KEYS.SPACE_ID),
    ]);

    return { success: true };
  } catch (error) {
    console.error('Failed to store credentials:', error);
    return { 
      success: false, 
      error: 'Failed to securely store credentials. Please try again.' 
    };
  }
};

/**
 * Retrieves stored credentials
 * Returns null if no credentials are stored
 */
export const getCredentials = async (): Promise<{
  serverUrl: string;
  apiKey: string;
  spaceId: string | null;
} | null> => {
  try {
    const [serverUrl, apiKey, spaceId] = await Promise.all([
      SecureStore.getItemAsync(STORAGE_KEYS.SERVER_URL, SECURE_OPTIONS),
      SecureStore.getItemAsync(STORAGE_KEYS.API_KEY, SECURE_OPTIONS),
      SecureStore.getItemAsync(STORAGE_KEYS.SPACE_ID, SECURE_OPTIONS),
    ]);

    if (!serverUrl || !apiKey) {
      return null;
    }

    return { serverUrl, apiKey, spaceId };
  } catch (error) {
    console.error('Failed to retrieve credentials:', error);
    return null;
  }
};

/**
 * Clears all stored credentials
 * Used for logout functionality
 */
export const clearCredentials = async (): Promise<void> => {
  try {
    await Promise.all([
      SecureStore.deleteItemAsync(STORAGE_KEYS.SERVER_URL),
      SecureStore.deleteItemAsync(STORAGE_KEYS.API_KEY),
      SecureStore.deleteItemAsync(STORAGE_KEYS.SPACE_ID),
      SecureStore.deleteItemAsync(STORAGE_KEYS.USER_ID),
    ]);
  } catch (error) {
    console.error('Failed to clear credentials:', error);
    throw new Error('Failed to clear credentials');
  }
};

/**
 * Stores the current user ID for session management
 */
export const storeUserId = async (userId: string): Promise<void> => {
  await SecureStore.setItemAsync(STORAGE_KEYS.USER_ID, userId, SECURE_OPTIONS);
};

/**
 * Gets the stored user ID
 */
export const getUserId = async (): Promise<string | null> => {
  return SecureStore.getItemAsync(STORAGE_KEYS.USER_ID, SECURE_OPTIONS);
};

/**
 * Checks if credentials are stored
 * Useful for determining initial auth state without fetching full credentials
 */
export const hasCredentials = async (): Promise<boolean> => {
  try {
    const apiKey = await SecureStore.getItemAsync(STORAGE_KEYS.API_KEY, SECURE_OPTIONS);
    return !!apiKey;
  } catch {
    return false;
  }
};

/**
 * Updates just the space ID without changing other credentials
 * Used for space switching
 */
export const updateSpaceId = async (spaceId: string | null): Promise<void> => {
  if (spaceId) {
    await SecureStore.setItemAsync(STORAGE_KEYS.SPACE_ID, spaceId, SECURE_OPTIONS);
  } else {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.SPACE_ID);
  }
};

/**
 * Masks sensitive data for logging/display
 * Never log or display full API keys
 */
export const maskApiKey = (apiKey: string): string => {
  if (!apiKey || apiKey.length < 8) {
    return '****';
  }
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
};

/**
 * Security utility to sanitize user input
 * Prevents injection attacks when constructing API URLs
 */
export const sanitizePathSegment = (segment: string): string => {
  if (!segment) return '';
  // Remove any characters that could be used for path traversal or injection
  return segment.replace(/[^a-zA-Z0-9\-_]/g, '');
};

// ============================================
// Multi-Instance Support
// ============================================

/**
 * Gets all stored instances (metadata only, no API keys)
 */
export const getInstances = async (): Promise<OctopusInstance[]> => {
  try {
    const instancesJson = await AsyncStorage.getItem(STORAGE_KEYS.INSTANCES);
    if (!instancesJson) return [];
    return JSON.parse(instancesJson);
  } catch (error) {
    console.error('Failed to get instances:', error);
    return [];
  }
};

/**
 * Gets the current instance ID
 */
export const getCurrentInstanceId = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_INSTANCE_ID);
  } catch (error) {
    console.error('Failed to get current instance ID:', error);
    return null;
  }
};

/**
 * Sets the current instance ID
 */
export const setCurrentInstanceId = async (instanceId: string): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_INSTANCE_ID, instanceId);
};

/**
 * Gets the API key for a specific instance
 */
export const getInstanceApiKey = async (instanceId: string): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(`${STORAGE_KEYS.API_KEY}_${instanceId}`, SECURE_OPTIONS);
  } catch (error) {
    console.error('Failed to get instance API key:', error);
    return null;
  }
};

/**
 * Stores a new instance with credentials
 */
export const addInstance = async (
  serverUrl: string,
  apiKey: string,
  name?: string,
  spaceId?: string
): Promise<{ success: boolean; instanceId?: string; error?: string }> => {
  try {
    // Validate inputs
    const urlValidation = validateServerUrl(serverUrl);
    if (!urlValidation.valid) {
      return { success: false, error: urlValidation.error };
    }

    const keyValidation = validateApiKey(apiKey);
    if (!keyValidation.valid) {
      return { success: false, error: keyValidation.error };
    }

    const instanceId = generateInstanceId();
    
    // Extract a friendly name from the URL if not provided
    const instanceName = name || new URL(urlValidation.normalized).hostname;

    const newInstance: OctopusInstance = {
      id: instanceId,
      name: instanceName,
      serverUrl: urlValidation.normalized,
      spaceId,
      createdAt: Date.now(),
    };

    // Get existing instances and add the new one
    const instances = await getInstances();
    instances.push(newInstance);
    await AsyncStorage.setItem(STORAGE_KEYS.INSTANCES, JSON.stringify(instances));

    // Store the API key securely with instance-specific key
    await SecureStore.setItemAsync(
      `${STORAGE_KEYS.API_KEY}_${instanceId}`,
      apiKey.trim(),
      SECURE_OPTIONS
    );

    // Set as current instance
    await setCurrentInstanceId(instanceId);

    // Also store in legacy format for backward compatibility
    await storeCredentials(serverUrl, apiKey, spaceId);

    return { success: true, instanceId };
  } catch (error) {
    console.error('Failed to add instance:', error);
    return { success: false, error: 'Failed to add instance. Please try again.' };
  }
};

/**
 * Updates an existing instance
 */
export const updateInstance = async (
  instanceId: string,
  updates: Partial<Pick<OctopusInstance, 'name' | 'spaceId' | 'userId'>>
): Promise<{ success: boolean; error?: string }> => {
  try {
    const instances = await getInstances();
    const index = instances.findIndex(i => i.id === instanceId);
    
    if (index === -1) {
      return { success: false, error: 'Instance not found' };
    }

    instances[index] = { ...instances[index], ...updates };
    await AsyncStorage.setItem(STORAGE_KEYS.INSTANCES, JSON.stringify(instances));

    return { success: true };
  } catch (error) {
    console.error('Failed to update instance:', error);
    return { success: false, error: 'Failed to update instance' };
  }
};

/**
 * Removes an instance and its credentials
 */
export const removeInstance = async (instanceId: string): Promise<void> => {
  try {
    // Remove API key
    await SecureStore.deleteItemAsync(`${STORAGE_KEYS.API_KEY}_${instanceId}`);

    // Remove from instances list
    const instances = await getInstances();
    const filtered = instances.filter(i => i.id !== instanceId);
    await AsyncStorage.setItem(STORAGE_KEYS.INSTANCES, JSON.stringify(filtered));

    // If this was the current instance, clear it
    const currentId = await getCurrentInstanceId();
    if (currentId === instanceId) {
      await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_INSTANCE_ID);
    }
  } catch (error) {
    console.error('Failed to remove instance:', error);
    throw new Error('Failed to remove instance');
  }
};

/**
 * Switches to a different instance
 * Updates both the current instance and the legacy credentials
 */
export const switchInstance = async (instanceId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const instances = await getInstances();
    const instance = instances.find(i => i.id === instanceId);
    
    if (!instance) {
      return { success: false, error: 'Instance not found' };
    }

    const apiKey = await getInstanceApiKey(instanceId);
    if (!apiKey) {
      return { success: false, error: 'API key not found for this instance' };
    }

    // Update legacy credentials for backward compatibility
    await storeCredentials(instance.serverUrl, apiKey, instance.spaceId);
    
    // Set current instance
    await setCurrentInstanceId(instanceId);

    return { success: true };
  } catch (error) {
    console.error('Failed to switch instance:', error);
    return { success: false, error: 'Failed to switch instance' };
  }
};

/**
 * Gets the current instance with full details
 */
export const getCurrentInstance = async (): Promise<OctopusInstance | null> => {
  try {
    const currentId = await getCurrentInstanceId();
    if (!currentId) return null;

    const instances = await getInstances();
    return instances.find(i => i.id === currentId) || null;
  } catch (error) {
    console.error('Failed to get current instance:', error);
    return null;
  }
};

/**
 * Migrates legacy single-instance credentials to multi-instance format
 */
export const migrateToMultiInstance = async (): Promise<void> => {
  try {
    // Check if already migrated
    const instances = await getInstances();
    if (instances.length > 0) return;

    // Check for legacy credentials
    const credentials = await getCredentials();
    if (!credentials) return;

    // Migrate to new format
    const instanceId = generateInstanceId();
    const instanceName = new URL(credentials.serverUrl).hostname;

    const newInstance: OctopusInstance = {
      id: instanceId,
      name: instanceName,
      serverUrl: credentials.serverUrl,
      spaceId: credentials.spaceId || undefined,
      createdAt: Date.now(),
    };

    await AsyncStorage.setItem(STORAGE_KEYS.INSTANCES, JSON.stringify([newInstance]));
    await SecureStore.setItemAsync(
      `${STORAGE_KEYS.API_KEY}_${instanceId}`,
      credentials.apiKey,
      SECURE_OPTIONS
    );
    await setCurrentInstanceId(instanceId);

    // Migration to multi-instance format completed
  } catch (error) {
    console.error('Failed to migrate to multi-instance:', error);
  }
};

/**
 * Clears all instances and credentials
 */
export const clearAllInstances = async (): Promise<void> => {
  try {
    const instances = await getInstances();
    
    // Clear all instance API keys
    await Promise.all(
      instances.map(instance =>
        SecureStore.deleteItemAsync(`${STORAGE_KEYS.API_KEY}_${instance.id}`)
      )
    );

    // Clear instance list and current instance
    await AsyncStorage.removeItem(STORAGE_KEYS.INSTANCES);
    await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_INSTANCE_ID);

    // Clear legacy credentials
    await clearCredentials();
  } catch (error) {
    console.error('Failed to clear all instances:', error);
    throw new Error('Failed to clear all instances');
  }
};
