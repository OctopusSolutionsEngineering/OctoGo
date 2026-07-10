/**
 * Tests for InstanceSelector component
 * Covers the current instance display (including the
 * `!!currentInstanceUrl` branch) and the instance switch modal.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

// Mock vector icons to avoid loading expo-font/expo-asset in tests
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Ionicons: (props: { name: string }) => React.createElement(Text, props, props.name),
  };
});

jest.mock('../../src/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../src/context/ThemeContext', () => {
  const actual = jest.requireActual('../../src/context/ThemeContext');
  return {
    ...actual,
    useColors: () => actual.darkColors,
  };
});

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

import { useAuth } from '../../src/context/AuthContext';
import { InstanceSelector } from '../../src/components/InstanceSelector';

const mockUseAuth = useAuth as jest.Mock;

const instance1 = {
  id: 'instance-1',
  name: 'Production Server',
  serverUrl: 'https://meanski.octopus.app',
};
const instance2 = {
  id: 'instance-2',
  name: 'Dev Server',
  serverUrl: 'https://dev.octopus.app',
};

const buildAuth = (overrides: Record<string, unknown> = {}) => ({
  instances: [instance1, instance2],
  currentInstance: instance1,
  switchInstance: jest.fn().mockResolvedValue({ success: true }),
  deleteInstance: jest.fn(),
  renameInstance: jest.fn(),
  isLoading: false,
  startAddingInstance: jest.fn(),
  ...overrides,
});

describe('InstanceSelector', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(buildAuth());
  });

  it('shows the current instance name and its hostname', () => {
    render(<InstanceSelector />);

    expect(screen.getByText('Production Server')).toBeTruthy();
    // URL is displayed as hostname only
    expect(screen.getByText('meanski.octopus.app')).toBeTruthy();
  });

  it('does not show a URL when there is no current instance', () => {
    mockUseAuth.mockReturnValue(buildAuth({ currentInstance: null }));

    render(<InstanceSelector />);

    expect(screen.getByText('Select Instance')).toBeTruthy();
    expect(screen.queryByText('meanski.octopus.app')).toBeNull();
  });

  it('falls back to the raw server URL when it cannot be parsed', () => {
    mockUseAuth.mockReturnValue(
      buildAuth({
        currentInstance: { id: 'instance-3', name: 'Broken', serverUrl: 'not-a-valid-url' },
        instances: [instance1],
      })
    );

    render(<InstanceSelector />);

    expect(screen.getByText('not-a-valid-url')).toBeTruthy();
  });

  it('opens the modal and switches to another instance', async () => {
    const auth = buildAuth();
    mockUseAuth.mockReturnValue(auth);

    render(<InstanceSelector />);

    fireEvent.press(screen.getByText('Production Server'));
    expect(screen.getByText('Switch Instance')).toBeTruthy();
    expect(screen.getByText('Dev Server')).toBeTruthy();
    expect(screen.getByText('dev.octopus.app')).toBeTruthy();

    fireEvent.press(screen.getByText('Dev Server'));

    await waitFor(() => {
      expect(auth.switchInstance).toHaveBeenCalledWith('instance-2');
    });
  });

  it('closes the modal without switching when selecting the current instance', async () => {
    const auth = buildAuth();
    mockUseAuth.mockReturnValue(auth);

    render(<InstanceSelector />);

    fireEvent.press(screen.getByText('Production Server'));
    // The modal list shows the current instance too; the first occurrence is
    // the selector, the second is inside the modal list.
    const entries = screen.getAllByText('Production Server');
    fireEvent.press(entries[entries.length - 1]);

    await waitFor(() => {
      expect(auth.switchInstance).not.toHaveBeenCalled();
    });
  });

  it('navigates to login when adding a new instance', () => {
    const auth = buildAuth();
    mockUseAuth.mockReturnValue(auth);
    const onInstanceSwitch = jest.fn();

    render(<InstanceSelector onInstanceSwitch={onInstanceSwitch} />);

    fireEvent.press(screen.getByText('Production Server'));
    fireEvent.press(screen.getByText('Add Instance'));

    expect(auth.startAddingInstance).toHaveBeenCalled();
    expect(onInstanceSwitch).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('shows a loading indicator inside the modal while loading', () => {
    mockUseAuth.mockReturnValue(buildAuth({ isLoading: true }));

    render(<InstanceSelector />);

    fireEvent.press(screen.getByText('Production Server'));

    expect(screen.getByText('Loading...')).toBeTruthy();
  });
});
