/**
 * Biometric Authentication Service
 * Provides Face ID / Touch ID / Fingerprint authentication
 */

import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BIOMETRIC_ENABLED_KEY = '@octogo_biometric_enabled';

export type BiometricType = 'fingerprint' | 'facial' | 'iris' | 'none';

export interface BiometricStatus {
  isAvailable: boolean;
  isEnrolled: boolean;
  biometricType: BiometricType;
  supportedTypes: LocalAuthentication.AuthenticationType[];
}

/**
 * Check if biometric authentication is available on this device
 */
export const getBiometricStatus = async (): Promise<BiometricStatus> => {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
    
    let biometricType: BiometricType = 'none';
    
    if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      biometricType = 'facial';
    } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      biometricType = 'fingerprint';
    } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      biometricType = 'iris';
    }
    
    return {
      isAvailable: hasHardware,
      isEnrolled: isEnrolled,
      biometricType,
      supportedTypes,
    };
  } catch (error) {
    console.error('Failed to check biometric status:', error);
    return {
      isAvailable: false,
      isEnrolled: false,
      biometricType: 'none',
      supportedTypes: [],
    };
  }
};

/**
 * Get a user-friendly name for the biometric type
 */
export const getBiometricTypeName = (type: BiometricType): string => {
  switch (type) {
    case 'facial':
      return 'Face ID';
    case 'fingerprint':
      return 'Touch ID';
    case 'iris':
      return 'Iris Scan';
    default:
      return 'Biometrics';
  }
};

/**
 * Get the icon name for the biometric type
 */
export const getBiometricIcon = (type: BiometricType): string => {
  switch (type) {
    case 'facial':
      return 'scan-outline';
    case 'fingerprint':
      return 'finger-print-outline';
    case 'iris':
      return 'eye-outline';
    default:
      return 'lock-closed-outline';
  }
};

/**
 * Authenticate using biometrics
 */
export const authenticateWithBiometrics = async (
  promptMessage?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const status = await getBiometricStatus();
    
    if (!status.isAvailable) {
      return { success: false, error: 'Biometric authentication is not available on this device' };
    }
    
    if (!status.isEnrolled) {
      return { success: false, error: 'No biometrics enrolled on this device' };
    }
    
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: promptMessage || 'Authenticate to access OctoGo',
      fallbackLabel: 'Use Passcode',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    
    if (result.success) {
      return { success: true };
    }
    
    // Handle specific error cases
    if (result.error === 'user_cancel') {
      return { success: false, error: 'Authentication cancelled' };
    }
    
    if (result.error === 'user_fallback') {
      // User chose to use passcode - this is still valid
      return { success: true };
    }
    
    if (result.error === 'lockout') {
      return { success: false, error: 'Too many failed attempts. Please try again later.' };
    }
    
    return { success: false, error: result.error || 'Authentication failed' };
  } catch (error) {
    console.error('Biometric authentication error');
    return { success: false, error: 'Authentication failed' };
  }
};

/**
 * Check if biometric login is enabled for this app
 */
export const isBiometricEnabled = async (): Promise<boolean> => {
  try {
    const enabled = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
    return enabled === 'true';
  } catch (error) {
    console.error('Failed to check biometric preference:', error);
    return false;
  }
};

/**
 * Enable or disable biometric login
 */
export const setBiometricEnabled = async (enabled: boolean): Promise<void> => {
  try {
    await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, enabled ? 'true' : 'false');
  } catch (error) {
    console.error('Failed to save biometric preference:', error);
    throw error;
  }
};

/**
 * Attempt biometric authentication if enabled
 * Returns true if:
 * - Biometrics are disabled (skip authentication)
 * - Biometrics are enabled and authentication succeeds
 * Returns false if authentication fails
 */
export const attemptBiometricAuth = async (): Promise<{ 
  success: boolean; 
  skipped: boolean; 
  error?: string 
}> => {
  const enabled = await isBiometricEnabled();
  
  if (!enabled) {
    return { success: true, skipped: true };
  }
  
  const result = await authenticateWithBiometrics();
  return { 
    success: result.success, 
    skipped: false,
    error: result.error,
  };
};
