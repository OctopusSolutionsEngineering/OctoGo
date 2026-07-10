/**
 * Tests for the (auth)/login route screen
 * Covers input validation branches, validation-error clearing on change,
 * login success/failure haptics, the add-instance mode (cancel/back),
 * and the API key help alert.
 */

import React from 'react';
import { Alert, Linking } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';

// Mock vector icons to avoid loading expo-font/expo-asset in tests
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const Ionicons = (props: { name: string }) => React.createElement(Text, props, props.name);
  Ionicons.glyphMap = {};
  return { Ionicons };
});

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: (props: { children?: React.ReactNode }) =>
      React.createElement(View, props, props.children),
  };
});

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: mockBack }),
}));

jest.mock('../../src/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

import { useAuth } from '../../src/context/AuthContext';
import LoginScreen from '../../app/(auth)/login';

const mockUseAuth = useAuth as jest.Mock;

const SERVER_PLACEHOLDER = 'https://your-server.octopus.app';
const KEY_PLACEHOLDER = 'API-XXXXXXXXXXXXXXXXXXXX';
const VALID_URL = 'https://octopus.example.com';
const VALID_KEY = 'API-VALIDKEY123456789012345';

describe('LoginScreen route', () => {
  const mockLogin = jest.fn();
  const mockClearError = jest.fn();
  const mockCancelAddingInstance = jest.fn();

  const authValue = (overrides: Record<string, unknown> = {}) => ({
    login: mockLogin,
    isLoading: false,
    error: null,
    clearError: mockClearError,
    instances: [],
    isAddingInstance: false,
    cancelAddingInstance: mockCancelAddingInstance,
    ...overrides,
  });

  beforeEach(() => {
    mockUseAuth.mockReturnValue(authValue());
    mockLogin.mockResolvedValue({ success: true });
  });

  it('renders the default connect form without a cancel button', () => {
    render(<LoginScreen />);

    expect(screen.getByText('OctoGo')).toBeTruthy();
    expect(screen.getByText('Unofficial Octopus Deploy companion app')).toBeTruthy();
    expect(screen.getByText('Connect')).toBeTruthy();
    expect(screen.queryByText('Cancel')).toBeNull();
  });

  it('shows validation errors instead of logging in when inputs are invalid', async () => {
    render(<LoginScreen />);

    fireEvent.changeText(screen.getByPlaceholderText(SERVER_PLACEHOLDER), 'http://example.com');
    fireEvent.changeText(screen.getByPlaceholderText(KEY_PLACEHOLDER), 'short');
    fireEvent.press(screen.getByText('Connect'));

    expect(
      await screen.findByText('HTTPS is required for secure connections. Please use https://')
    ).toBeTruthy();
    expect(screen.getByText('API key appears to be too short')).toBeTruthy();
    expect(mockLogin).not.toHaveBeenCalled();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Error
    );
  });

  it('clears field validation errors when the user edits the inputs', async () => {
    render(<LoginScreen />);

    fireEvent.changeText(screen.getByPlaceholderText(SERVER_PLACEHOLDER), 'http://example.com');
    fireEvent.changeText(screen.getByPlaceholderText(KEY_PLACEHOLDER), 'short');
    fireEvent.press(screen.getByText('Connect'));

    await screen.findByText('API key appears to be too short');

    fireEvent.changeText(screen.getByPlaceholderText(SERVER_PLACEHOLDER), VALID_URL);
    fireEvent.changeText(screen.getByPlaceholderText(KEY_PLACEHOLDER), VALID_KEY);

    expect(
      screen.queryByText('HTTPS is required for secure connections. Please use https://')
    ).toBeNull();
    expect(screen.queryByText('API key appears to be too short')).toBeNull();
  });

  it('logs in with valid credentials and fires a success haptic', async () => {
    render(<LoginScreen />);

    fireEvent.changeText(screen.getByPlaceholderText(SERVER_PLACEHOLDER), VALID_URL);
    fireEvent.changeText(screen.getByPlaceholderText(KEY_PLACEHOLDER), VALID_KEY);
    fireEvent.press(screen.getByText('Connect'));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith(VALID_URL, VALID_KEY, undefined, undefined);
    });
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Success
    );
  });

  it('passes the optional nickname to login and fires an error haptic on failure', async () => {
    mockLogin.mockResolvedValue({ success: false });

    render(<LoginScreen />);

    fireEvent.changeText(
      screen.getByPlaceholderText('e.g. Production, Staging, Work'),
      'Work'
    );
    fireEvent.changeText(screen.getByPlaceholderText(SERVER_PLACEHOLDER), VALID_URL);
    fireEvent.changeText(screen.getByPlaceholderText(KEY_PLACEHOLDER), VALID_KEY);
    fireEvent.press(screen.getByText('Connect'));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith(VALID_URL, VALID_KEY, undefined, 'Work');
    });
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Error
    );
  });

  it('shows the auth error from context and clears it when typing', () => {
    mockUseAuth.mockReturnValue(authValue({ error: 'Invalid API key' }));

    render(<LoginScreen />);

    expect(screen.getByText('Invalid API key')).toBeTruthy();

    fireEvent.changeText(screen.getByPlaceholderText(KEY_PLACEHOLDER), 'API-');
    expect(mockClearError).toHaveBeenCalled();

    fireEvent.changeText(screen.getByPlaceholderText(SERVER_PLACEHOLDER), 'https://x');
    expect(mockClearError).toHaveBeenCalledTimes(2);
  });

  it('renders add-instance mode and cancels back to the previous screen', () => {
    mockUseAuth.mockReturnValue(authValue({ isAddingInstance: true }));

    render(<LoginScreen />);

    expect(screen.getByText('Add another Octopus instance')).toBeTruthy();
    expect(screen.getByText('Add Instance')).toBeTruthy();

    fireEvent.press(screen.getByText('Cancel'));

    expect(mockCancelAddingInstance).toHaveBeenCalled();
    expect(mockBack).toHaveBeenCalled();
  });

  it('shows the API key help alert and opens the docs from it', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const openUrlSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);

    render(<LoginScreen />);

    fireEvent.press(screen.getByText('Need an API Key?'));

    expect(alertSpy).toHaveBeenCalledWith(
      'How to get an API Key',
      expect.stringContaining('New API Key'),
      expect.any(Array)
    );

    const buttons = alertSpy.mock.calls[0][2] as Array<{ text: string; onPress?: () => void }>;
    const viewDocs = buttons.find(b => b.text === 'View Docs');
    viewDocs?.onPress?.();

    expect(openUrlSpy).toHaveBeenCalledWith(
      'https://octopus.com/docs/octopus-rest-api/how-to-create-an-api-key'
    );
  });
});
