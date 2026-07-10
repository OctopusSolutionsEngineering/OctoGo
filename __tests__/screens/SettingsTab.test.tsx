/**
 * Tests for the Settings tab screen
 * Covers account/server info rendering (with fallbacks), the biometric
 * toggle (enable success/failure and disable), logout confirmation,
 * external links and the customize-tabs navigation link.
 */

import React from 'react';
import { Alert, Linking, Switch } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

// Mock vector icons to avoid loading expo-font/expo-asset in tests
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const Ionicons = (props: { name: string }) => React.createElement(Text, props, props.name);
  Ionicons.glyphMap = {};
  return { Ionicons };
});

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('../../src/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../src/context/ThemeContext', () => {
  const actual = jest.requireActual('../../src/context/ThemeContext');
  return {
    ...actual,
    useColors: () => actual.darkColors,
    useTheme: () => ({
      mode: 'dark',
      setThemeMode: jest.fn(),
      colors: actual.darkColors,
    }),
  };
});

jest.mock('../../src/hooks/useOctopusQuery', () => ({
  useSpaces: jest.fn(),
}));

jest.mock('../../src/lib/security', () => ({
  maskApiKey: jest.fn(),
  getCredentials: jest.fn(),
}));

jest.mock('../../src/lib/biometric', () => ({
  getBiometricStatus: jest.fn(),
  getBiometricTypeName: jest.fn(),
  getBiometricIcon: jest.fn(),
  isBiometricEnabled: jest.fn(),
  setBiometricEnabled: jest.fn(),
  authenticateWithBiometrics: jest.fn(),
}));

import { useAuth } from '../../src/context/AuthContext';
import { useSpaces } from '../../src/hooks/useOctopusQuery';
import { maskApiKey, getCredentials } from '../../src/lib/security';
import {
  getBiometricStatus,
  getBiometricTypeName,
  getBiometricIcon,
  isBiometricEnabled,
  setBiometricEnabled,
  authenticateWithBiometrics,
} from '../../src/lib/biometric';
import SettingsScreen from '../../app/(tabs)/settings';

const mockUseAuth = useAuth as jest.Mock;
const mockUseSpaces = useSpaces as jest.Mock;
const mockMaskApiKey = maskApiKey as jest.Mock;
const mockGetCredentials = getCredentials as jest.Mock;
const mockGetBiometricStatus = getBiometricStatus as jest.Mock;
const mockGetBiometricTypeName = getBiometricTypeName as jest.Mock;
const mockGetBiometricIcon = getBiometricIcon as jest.Mock;
const mockIsBiometricEnabled = isBiometricEnabled as jest.Mock;
const mockSetBiometricEnabled = setBiometricEnabled as jest.Mock;
const mockAuthenticate = authenticateWithBiometrics as jest.Mock;

describe('SettingsScreen', () => {
  const mockLogout = jest.fn();

  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: {
        DisplayName: 'Sean Woodliffe',
        Username: 'sean',
        EmailAddress: 'sean@example.com',
      },
      serverVersion: '2025.3.1234',
      licenseStatus: { LicenseType: 'Enterprise' },
      logout: mockLogout,
      isLoading: false,
    });
    mockUseSpaces.mockReturnValue({
      data: [{ Id: 'Spaces-1' }, { Id: 'Spaces-2' }],
    });
    mockGetCredentials.mockResolvedValue({
      serverUrl: 'https://octopus.example.com',
      apiKey: 'API-ABCDEF123456789012345',
    });
    mockMaskApiKey.mockReturnValue('API-****2345');
    mockGetBiometricStatus.mockResolvedValue({
      isAvailable: true,
      isEnrolled: true,
      biometricType: 'facial',
    });
    mockGetBiometricTypeName.mockReturnValue('Face ID');
    mockGetBiometricIcon.mockReturnValue('scan-outline');
    mockIsBiometricEnabled.mockResolvedValue(false);
    mockSetBiometricEnabled.mockResolvedValue(undefined);
  });

  it('renders account, server and about information', async () => {
    render(<SettingsScreen />);

    expect(await screen.findByText('API-****2345')).toBeTruthy();
    expect(screen.getByText('Sean Woodliffe')).toBeTruthy();
    expect(screen.getByText('sean')).toBeTruthy();
    expect(screen.getByText('sean@example.com')).toBeTruthy();
    // Avatar initial
    expect(screen.getByText('S')).toBeTruthy();
    // Server section
    expect(screen.getByText('2025.3.1234')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('Enterprise')).toBeTruthy();
    // Biometric row rendered once status resolves
    expect(await screen.findByText('Face ID')).toBeTruthy();
    // About section
    expect(screen.getByText('OctoGo')).toBeTruthy();
  });

  it('falls back to defaults when user, server and license info are missing', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      serverVersion: null,
      licenseStatus: null,
      logout: mockLogout,
      isLoading: false,
    });
    mockUseSpaces.mockReturnValue({ data: undefined });
    mockGetCredentials.mockResolvedValue(null);
    mockGetBiometricStatus.mockResolvedValue({
      isAvailable: false,
      isEnrolled: false,
      biometricType: 'none',
    });

    render(<SettingsScreen />);

    expect(await screen.findByText('Not available')).toBeTruthy();
    expect(screen.getByText('?')).toBeTruthy();
    expect(screen.getAllByText('Unknown').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('unknown')).toBeTruthy();
    expect(screen.getByText('0')).toBeTruthy();
    expect(screen.queryByText('Email')).toBeNull();
  });

  it('enables biometric login after successful authentication', async () => {
    mockAuthenticate.mockResolvedValue({ success: true });

    render(<SettingsScreen />);
    await screen.findByText('Face ID');

    fireEvent(screen.UNSAFE_getByType(Switch), 'valueChange', true);

    await waitFor(() => {
      expect(mockSetBiometricEnabled).toHaveBeenCalledWith(true);
    });
    expect(mockAuthenticate).toHaveBeenCalledWith('Authenticate to enable Face ID');
  });

  it('shows an alert when biometric authentication fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    mockAuthenticate.mockResolvedValue({ success: false, error: 'No match' });

    render(<SettingsScreen />);
    await screen.findByText('Face ID');

    fireEvent(screen.UNSAFE_getByType(Switch), 'valueChange', true);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Authentication Failed', 'No match');
    });
    expect(mockSetBiometricEnabled).not.toHaveBeenCalled();
  });

  it('falls back to a generic alert message when authentication fails without an error', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    mockAuthenticate.mockResolvedValue({ success: false });

    render(<SettingsScreen />);
    await screen.findByText('Face ID');

    fireEvent(screen.UNSAFE_getByType(Switch), 'valueChange', true);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Authentication Failed',
        'Could not enable biometric login'
      );
    });
  });

  it('disables biometric login without authenticating', async () => {
    mockIsBiometricEnabled.mockResolvedValue(true);

    render(<SettingsScreen />);
    await screen.findByText('Face ID');

    fireEvent(screen.UNSAFE_getByType(Switch), 'valueChange', false);

    await waitFor(() => {
      expect(mockSetBiometricEnabled).toHaveBeenCalledWith(false);
    });
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });

  it('confirms before signing out and logs out on confirmation', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');

    render(<SettingsScreen />);
    await screen.findByText('Face ID');

    fireEvent.press(screen.getByText('Sign Out'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Sign Out',
      expect.stringContaining('sign out'),
      expect.any(Array)
    );

    // Press the destructive "Sign Out" button in the alert
    const buttons = alertSpy.mock.calls[0][2] as Array<{ text: string; onPress?: () => void }>;
    const confirm = buttons.find(b => b.text === 'Sign Out');
    confirm?.onPress?.();

    expect(mockLogout).toHaveBeenCalled();
  });

  it('opens the docs and GitHub links', async () => {
    const openUrlSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);

    render(<SettingsScreen />);
    await screen.findByText('Face ID');

    fireEvent.press(screen.getByText('API Documentation'));
    expect(openUrlSpy).toHaveBeenCalledWith('https://octopus.com/docs/octopus-rest-api');

    fireEvent.press(screen.getByText('OctoGo GitHub'));
    expect(openUrlSpy).toHaveBeenCalledWith(
      'https://github.com/OctopusSolutionsEngineering/OctoGo'
    );
  });

  it('navigates to the customize-tabs screen', async () => {
    render(<SettingsScreen />);
    await screen.findByText('Face ID');

    fireEvent.press(screen.getByText('Customise Navigation Tabs'));

    expect(mockPush).toHaveBeenCalledWith('/customize-tabs');
  });
});
