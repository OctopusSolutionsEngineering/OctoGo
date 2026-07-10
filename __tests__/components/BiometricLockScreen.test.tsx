/**
 * Tests for the BiometricLockScreen component
 * Covers the auto-prompt on mount, successful unlock (with fade-out),
 * failure with a visible error message, the cancelled-auth branch that
 * suppresses the error, and manual re-prompt via the unlock button.
 */

import React from 'react';
import { Animated } from 'react-native';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';

// Mock vector icons to avoid loading expo-font/expo-asset in tests
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Ionicons: (props: { name: string }) => React.createElement(Text, props, props.name),
  };
});

jest.mock('../../src/lib/biometric', () => ({
  authenticateWithBiometrics: jest.fn(),
  getBiometricStatus: jest.fn(),
  getBiometricTypeName: jest.fn(),
  getBiometricIcon: jest.fn(),
}));

import {
  authenticateWithBiometrics,
  getBiometricStatus,
  getBiometricTypeName,
  getBiometricIcon,
} from '../../src/lib/biometric';
import { BiometricLockScreen } from '../../src/components/ui/BiometricLockScreen';

const mockAuthenticate = authenticateWithBiometrics as jest.Mock;
const mockGetStatus = getBiometricStatus as jest.Mock;
const mockTypeName = getBiometricTypeName as jest.Mock;
const mockIcon = getBiometricIcon as jest.Mock;

// Animation stubs: timings complete immediately (so the unlock fade-out calls
// back synchronously) and the pulse loop becomes inert
const instantAnimation = () =>
  ({
    start: (cb?: Animated.EndCallback) => cb?.({ finished: true }),
    stop: jest.fn(),
    reset: jest.fn(),
  }) as unknown as Animated.CompositeAnimation;

const inertAnimation = () =>
  ({
    start: jest.fn(),
    stop: jest.fn(),
    reset: jest.fn(),
  }) as unknown as Animated.CompositeAnimation;

describe('BiometricLockScreen', () => {
  beforeEach(() => {
    jest.spyOn(Animated, 'timing').mockImplementation(instantAnimation);
    jest.spyOn(Animated, 'loop').mockImplementation(inertAnimation);

    mockGetStatus.mockResolvedValue({
      isAvailable: true,
      isEnrolled: true,
      biometricType: 'facial',
      supportedTypes: [],
    });
    mockTypeName.mockReturnValue('Face ID');
    mockIcon.mockReturnValue('scan-outline');
    // Default: user cancels so nothing else happens
    mockAuthenticate.mockResolvedValue({ success: false, error: 'Authentication cancelled' });
  });

  it('renders the lock screen and loads the biometric type', async () => {
    render(<BiometricLockScreen onUnlock={jest.fn()} />);

    expect(screen.getByText('OctoGo')).toBeTruthy();
    expect(screen.getByText('Locked')).toBeTruthy();
    expect(screen.getByText('Unlock with Face ID')).toBeTruthy();

    await waitFor(() => {
      expect(mockTypeName).toHaveBeenCalledWith('facial');
    });
    expect(mockIcon).toHaveBeenCalledWith('facial');
  });

  it('auto-prompts on mount and unlocks after successful authentication', async () => {
    mockAuthenticate.mockResolvedValue({ success: true });
    const onUnlock = jest.fn();

    render(<BiometricLockScreen onUnlock={onUnlock} />);

    // Prompt fires after a short delay, then the fade-out completes
    await waitFor(
      () => {
        expect(mockAuthenticate).toHaveBeenCalledWith('Unlock OctoGo');
      },
      { timeout: 3000 }
    );
    await waitFor(
      () => {
        expect(onUnlock).toHaveBeenCalled();
      },
      { timeout: 3000 }
    );
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Success
    );
  });

  it('shows the error message when authentication fails', async () => {
    mockAuthenticate.mockResolvedValue({
      success: false,
      error: 'Too many failed attempts. Please try again later.',
    });
    const onUnlock = jest.fn();

    render(<BiometricLockScreen onUnlock={onUnlock} />);

    expect(
      await screen.findByText(
        'Too many failed attempts. Please try again later.',
        {},
        { timeout: 3000 }
      )
    ).toBeTruthy();
    expect(onUnlock).not.toHaveBeenCalled();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Error
    );
  });

  it('does not show an error when authentication is cancelled', async () => {
    const onUnlock = jest.fn();

    render(<BiometricLockScreen onUnlock={onUnlock} />);

    await waitFor(
      () => {
        expect(mockAuthenticate).toHaveBeenCalled();
      },
      { timeout: 3000 }
    );

    expect(screen.queryByText('Authentication cancelled')).toBeNull();
    expect(onUnlock).not.toHaveBeenCalled();
  });

  it('re-prompts and clears a previous error when the unlock button is pressed', async () => {
    mockAuthenticate.mockResolvedValueOnce({ success: false, error: 'Sensor unavailable' });
    const onUnlock = jest.fn();

    render(<BiometricLockScreen onUnlock={onUnlock} />);

    // The auto-prompt fails with a visible error
    expect(await screen.findByText('Sensor unavailable', {}, { timeout: 3000 })).toBeTruthy();

    // Manual retry: cancelled this time, so the error is cleared and stays hidden
    await act(async () => {
      fireEvent.press(screen.getByText('Unlock with Face ID'));
    });

    await waitFor(() => {
      expect(screen.queryByText('Sensor unavailable')).toBeNull();
    });
    expect(mockAuthenticate).toHaveBeenCalledTimes(2);
    expect(onUnlock).not.toHaveBeenCalled();
  });
});
