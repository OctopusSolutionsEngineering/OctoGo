/**
 * Tests for biometric authentication service
 */

import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getBiometricStatus,
  getBiometricTypeName,
  getBiometricIcon,
  authenticateWithBiometrics,
  isBiometricEnabled,
  setBiometricEnabled,
  attemptBiometricAuth,
} from '../../src/lib/biometric';

// Mock expo-local-authentication
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  supportedAuthenticationTypesAsync: jest.fn(),
  authenticateAsync: jest.fn(),
  AuthenticationType: {
    FINGERPRINT: 1,
    FACIAL_RECOGNITION: 2,
    IRIS: 3,
  },
}));

const mockLocalAuth = LocalAuthentication as jest.Mocked<typeof LocalAuthentication>;
const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

const { FINGERPRINT, FACIAL_RECOGNITION, IRIS } = LocalAuthentication.AuthenticationType;

const setupBiometricDevice = ({
  hasHardware = true,
  isEnrolled = true,
  supportedTypes = [FACIAL_RECOGNITION] as LocalAuthentication.AuthenticationType[],
} = {}) => {
  mockLocalAuth.hasHardwareAsync.mockResolvedValue(hasHardware);
  mockLocalAuth.isEnrolledAsync.mockResolvedValue(isEnrolled);
  mockLocalAuth.supportedAuthenticationTypesAsync.mockResolvedValue(supportedTypes);
};

describe('Biometric Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  // ==========================================================================
  // getBiometricStatus
  // ==========================================================================
  describe('getBiometricStatus', () => {
    it('should report facial recognition when supported', async () => {
      setupBiometricDevice({ supportedTypes: [FINGERPRINT, FACIAL_RECOGNITION] });

      const result = await getBiometricStatus();

      expect(result).toEqual({
        isAvailable: true,
        isEnrolled: true,
        biometricType: 'facial',
        supportedTypes: [FINGERPRINT, FACIAL_RECOGNITION],
      });
    });

    it('should report fingerprint when facial recognition is unavailable', async () => {
      setupBiometricDevice({ supportedTypes: [FINGERPRINT, IRIS] });

      const result = await getBiometricStatus();

      expect(result.biometricType).toBe('fingerprint');
    });

    it('should report iris when it is the only supported type', async () => {
      setupBiometricDevice({ supportedTypes: [IRIS] });

      const result = await getBiometricStatus();

      expect(result.biometricType).toBe('iris');
    });

    it('should report none when no types are supported', async () => {
      setupBiometricDevice({ hasHardware: false, isEnrolled: false, supportedTypes: [] });

      const result = await getBiometricStatus();

      expect(result).toEqual({
        isAvailable: false,
        isEnrolled: false,
        biometricType: 'none',
        supportedTypes: [],
      });
    });

    it('should return a safe default on errors', async () => {
      mockLocalAuth.hasHardwareAsync.mockRejectedValue(new Error('Hardware error'));

      const result = await getBiometricStatus();

      expect(result).toEqual({
        isAvailable: false,
        isEnrolled: false,
        biometricType: 'none',
        supportedTypes: [],
      });
    });
  });

  // ==========================================================================
  // getBiometricTypeName
  // ==========================================================================
  describe('getBiometricTypeName', () => {
    it('should return Face ID for facial', () => {
      expect(getBiometricTypeName('facial')).toBe('Face ID');
    });

    it('should return Touch ID for fingerprint', () => {
      expect(getBiometricTypeName('fingerprint')).toBe('Touch ID');
    });

    it('should return Iris Scan for iris', () => {
      expect(getBiometricTypeName('iris')).toBe('Iris Scan');
    });

    it('should return Biometrics for none', () => {
      expect(getBiometricTypeName('none')).toBe('Biometrics');
    });
  });

  // ==========================================================================
  // getBiometricIcon
  // ==========================================================================
  describe('getBiometricIcon', () => {
    it('should return scan icon for facial', () => {
      expect(getBiometricIcon('facial')).toBe('scan-outline');
    });

    it('should return fingerprint icon for fingerprint', () => {
      expect(getBiometricIcon('fingerprint')).toBe('finger-print-outline');
    });

    it('should return eye icon for iris', () => {
      expect(getBiometricIcon('iris')).toBe('eye-outline');
    });

    it('should return lock icon for none', () => {
      expect(getBiometricIcon('none')).toBe('lock-closed-outline');
    });
  });

  // ==========================================================================
  // authenticateWithBiometrics
  // ==========================================================================
  describe('authenticateWithBiometrics', () => {
    it('should fail when biometrics are not available', async () => {
      setupBiometricDevice({ hasHardware: false });

      const result = await authenticateWithBiometrics();

      expect(result).toEqual({
        success: false,
        error: 'Biometric authentication is not available on this device',
      });
      expect(mockLocalAuth.authenticateAsync).not.toHaveBeenCalled();
    });

    it('should fail when no biometrics are enrolled', async () => {
      setupBiometricDevice({ isEnrolled: false });

      const result = await authenticateWithBiometrics();

      expect(result).toEqual({
        success: false,
        error: 'No biometrics enrolled on this device',
      });
      expect(mockLocalAuth.authenticateAsync).not.toHaveBeenCalled();
    });

    it('should succeed when authentication passes', async () => {
      setupBiometricDevice();
      mockLocalAuth.authenticateAsync.mockResolvedValue({ success: true });

      const result = await authenticateWithBiometrics();

      expect(result).toEqual({ success: true });
      expect(mockLocalAuth.authenticateAsync).toHaveBeenCalledWith({
        promptMessage: 'Authenticate to access OctoGo',
        fallbackLabel: 'Use Passcode',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
    });

    it('should use a custom prompt message when provided', async () => {
      setupBiometricDevice();
      mockLocalAuth.authenticateAsync.mockResolvedValue({ success: true });

      await authenticateWithBiometrics('Unlock settings');

      expect(mockLocalAuth.authenticateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ promptMessage: 'Unlock settings' })
      );
    });

    it('should report cancellation when the user cancels', async () => {
      setupBiometricDevice();
      mockLocalAuth.authenticateAsync.mockResolvedValue({
        success: false,
        error: 'user_cancel',
      } as LocalAuthentication.LocalAuthenticationResult);

      const result = await authenticateWithBiometrics();

      expect(result).toEqual({ success: false, error: 'Authentication cancelled' });
    });

    it('should treat passcode fallback as success', async () => {
      setupBiometricDevice();
      mockLocalAuth.authenticateAsync.mockResolvedValue({
        success: false,
        error: 'user_fallback',
      } as LocalAuthentication.LocalAuthenticationResult);

      const result = await authenticateWithBiometrics();

      expect(result).toEqual({ success: true });
    });

    it('should report lockout after too many failed attempts', async () => {
      setupBiometricDevice();
      mockLocalAuth.authenticateAsync.mockResolvedValue({
        success: false,
        error: 'lockout',
      } as LocalAuthentication.LocalAuthenticationResult);

      const result = await authenticateWithBiometrics();

      expect(result).toEqual({
        success: false,
        error: 'Too many failed attempts. Please try again later.',
      });
    });

    it('should pass through other error codes', async () => {
      setupBiometricDevice();
      mockLocalAuth.authenticateAsync.mockResolvedValue({
        success: false,
        error: 'not_available',
      } as LocalAuthentication.LocalAuthenticationResult);

      const result = await authenticateWithBiometrics();

      expect(result).toEqual({ success: false, error: 'not_available' });
    });

    it('should fall back to a generic message when no error code is provided', async () => {
      setupBiometricDevice();
      mockLocalAuth.authenticateAsync.mockResolvedValue({
        success: false,
        error: '',
      } as unknown as LocalAuthentication.LocalAuthenticationResult);

      const result = await authenticateWithBiometrics();

      expect(result).toEqual({ success: false, error: 'Authentication failed' });
    });

    it('should handle thrown errors gracefully', async () => {
      setupBiometricDevice();
      mockLocalAuth.authenticateAsync.mockRejectedValue(new Error('Native crash'));

      const result = await authenticateWithBiometrics();

      expect(result).toEqual({ success: false, error: 'Authentication failed' });
    });
  });

  // ==========================================================================
  // isBiometricEnabled
  // ==========================================================================
  describe('isBiometricEnabled', () => {
    it('should return true when the preference is enabled', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('true');

      const result = await isBiometricEnabled();

      expect(result).toBe(true);
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('@octogo_biometric_enabled');
    });

    it('should return false when the preference is disabled', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('false');

      const result = await isBiometricEnabled();

      expect(result).toBe(false);
    });

    it('should return false when no preference is stored', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const result = await isBiometricEnabled();

      expect(result).toBe(false);
    });

    it('should return false on storage errors', async () => {
      mockAsyncStorage.getItem.mockRejectedValue(new Error('Read error'));

      const result = await isBiometricEnabled();

      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // setBiometricEnabled
  // ==========================================================================
  describe('setBiometricEnabled', () => {
    it('should persist enabled state', async () => {
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      await setBiometricEnabled(true);

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith('@octogo_biometric_enabled', 'true');
    });

    it('should persist disabled state', async () => {
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      await setBiometricEnabled(false);

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith('@octogo_biometric_enabled', 'false');
    });

    it('should rethrow storage errors', async () => {
      const error = new Error('Write error');
      mockAsyncStorage.setItem.mockRejectedValue(error);

      await expect(setBiometricEnabled(true)).rejects.toThrow('Write error');
    });
  });

  // ==========================================================================
  // attemptBiometricAuth
  // ==========================================================================
  describe('attemptBiometricAuth', () => {
    it('should skip authentication when biometrics are disabled', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const result = await attemptBiometricAuth();

      expect(result).toEqual({ success: true, skipped: true });
      expect(mockLocalAuth.authenticateAsync).not.toHaveBeenCalled();
    });

    it('should authenticate when biometrics are enabled', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('true');
      setupBiometricDevice();
      mockLocalAuth.authenticateAsync.mockResolvedValue({ success: true });

      const result = await attemptBiometricAuth();

      expect(result).toEqual({ success: true, skipped: false, error: undefined });
    });

    it('should propagate authentication failures', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('true');
      setupBiometricDevice();
      mockLocalAuth.authenticateAsync.mockResolvedValue({
        success: false,
        error: 'user_cancel',
      } as LocalAuthentication.LocalAuthenticationResult);

      const result = await attemptBiometricAuth();

      expect(result).toEqual({
        success: false,
        skipped: false,
        error: 'Authentication cancelled',
      });
    });
  });
});
