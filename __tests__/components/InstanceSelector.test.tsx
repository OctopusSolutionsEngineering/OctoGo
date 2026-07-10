/**
 * Tests for InstanceSelector component
 * Covers the current instance display (including the
 * `!!currentInstanceUrl` branch) and the instance switch modal.
 */

import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';

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

  describe('switching, rename and delete flows', () => {
    // Find the button with the given label in the most recent Alert.alert
    // call and press it (Alert is spied on, so buttons never render)
    const pressAlertButton = async (label: string) => {
      const lastCall = (Alert.alert as jest.Mock).mock.calls.at(-1);
      expect(lastCall).toBeDefined();
      const buttons = (lastCall?.[2] ?? []) as { text: string; onPress?: () => void }[];
      const button = buttons.find((b) => b.text === label);
      expect(button).toBeDefined();
      await act(async () => {
        button!.onPress?.();
      });
    };

    beforeEach(() => {
      jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    });

    it('shows an alert with the error message when switching fails', async () => {
      const auth = buildAuth({
        switchInstance: jest.fn().mockResolvedValue({ success: false, error: 'Token expired' }),
      });
      mockUseAuth.mockReturnValue(auth);

      render(<InstanceSelector />);

      fireEvent.press(screen.getByText('Production Server'));
      await act(async () => {
        fireEvent.press(screen.getByText('Dev Server'));
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Switch Failed', 'Token expired');
      });
      // The modal stays open after a failed switch
      expect(screen.getByText('Switch Instance')).toBeTruthy();
    });

    it('falls back to a generic message when the switch fails without one', async () => {
      const auth = buildAuth({
        switchInstance: jest.fn().mockResolvedValue({ success: false }),
      });
      mockUseAuth.mockReturnValue(auth);

      render(<InstanceSelector />);

      fireEvent.press(screen.getByText('Production Server'));
      await act(async () => {
        fireEvent.press(screen.getByText('Dev Server'));
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Switch Failed', 'Failed to switch instance');
      });
    });

    it('shows the switching indicator and notifies the parent on success', async () => {
      let resolveSwitch: (value: { success: boolean }) => void = () => {};
      const auth = buildAuth({
        switchInstance: jest.fn(
          () => new Promise((resolve) => { resolveSwitch = resolve; })
        ),
      });
      mockUseAuth.mockReturnValue(auth);
      const onInstanceSwitch = jest.fn();

      render(<InstanceSelector onInstanceSwitch={onInstanceSwitch} />);

      fireEvent.press(screen.getByText('Production Server'));
      fireEvent.press(screen.getByText('Dev Server'));

      expect(await screen.findByText('Switching instance...')).toBeTruthy();

      await act(async () => {
        resolveSwitch({ success: true });
      });

      await waitFor(() => {
        expect(onInstanceSwitch).toHaveBeenCalled();
      });
      expect(screen.queryByText('Switch Instance')).toBeNull();
    });

    it('renames an instance from the long-press menu', async () => {
      const auth = buildAuth();
      mockUseAuth.mockReturnValue(auth);

      render(<InstanceSelector />);

      fireEvent.press(screen.getByText('Production Server'));
      fireEvent(screen.getByText('Dev Server'), 'longPress');

      expect(Alert.alert).toHaveBeenCalledWith(
        'Dev Server',
        'What would you like to do?',
        expect.any(Array)
      );

      await pressAlertButton('Rename');

      // The rename modal opens after a short delay
      expect(await screen.findByText('Rename Instance')).toBeTruthy();
      const input = screen.getByDisplayValue('Dev Server');
      fireEvent.changeText(input, '  Renamed Dev  ');

      await act(async () => {
        fireEvent.press(screen.getByText('Save'));
      });

      expect(auth.renameInstance).toHaveBeenCalledWith('instance-2', 'Renamed Dev');
      // The instance selector modal reopens after renaming
      expect(await screen.findByText('Switch Instance')).toBeTruthy();
    });

    it('does not rename when the new name is empty', async () => {
      const auth = buildAuth();
      mockUseAuth.mockReturnValue(auth);

      render(<InstanceSelector />);

      fireEvent.press(screen.getByText('Production Server'));
      fireEvent(screen.getByText('Dev Server'), 'longPress');
      await pressAlertButton('Rename');

      await screen.findByText('Rename Instance');
      fireEvent.changeText(screen.getByDisplayValue('Dev Server'), '   ');

      await act(async () => {
        fireEvent.press(screen.getByText('Save'));
      });

      expect(auth.renameInstance).not.toHaveBeenCalled();
      // The rename modal stays open
      expect(screen.getByText('Rename Instance')).toBeTruthy();
    });

    it('cancels the rename and reopens the instance list', async () => {
      const auth = buildAuth();
      mockUseAuth.mockReturnValue(auth);

      render(<InstanceSelector />);

      fireEvent.press(screen.getByText('Production Server'));
      fireEvent(screen.getByText('Dev Server'), 'longPress');
      await pressAlertButton('Rename');

      await screen.findByText('Rename Instance');
      fireEvent.press(screen.getByText('Cancel'));

      expect(auth.renameInstance).not.toHaveBeenCalled();
      expect(await screen.findByText('Switch Instance')).toBeTruthy();
    });

    it('deletes an instance after confirming the long-press remove option', async () => {
      const auth = buildAuth({ deleteInstance: jest.fn().mockResolvedValue(undefined) });
      mockUseAuth.mockReturnValue(auth);

      render(<InstanceSelector />);

      fireEvent.press(screen.getByText('Production Server'));
      fireEvent(screen.getByText('Dev Server'), 'longPress');

      // First alert: choose Remove; second alert: confirm removal
      await pressAlertButton('Remove');
      expect(Alert.alert).toHaveBeenLastCalledWith(
        'Remove Instance',
        expect.stringContaining('Dev Server'),
        expect.any(Array)
      );
      await pressAlertButton('Remove');

      await waitFor(() => {
        expect(auth.deleteInstance).toHaveBeenCalledWith('instance-2');
      });
    });

    it('shows the empty state when no instances are configured', () => {
      mockUseAuth.mockReturnValue(buildAuth({ instances: [], currentInstance: null }));

      render(<InstanceSelector />);

      fireEvent.press(screen.getByText('Select Instance'));

      expect(screen.getByText('No instances configured')).toBeTruthy();
    });

    it('closes the modal with the close button', async () => {
      render(<InstanceSelector />);

      fireEvent.press(screen.getByText('Production Server'));
      expect(screen.getByText('Switch Instance')).toBeTruthy();

      // Ionicons are mocked to render their name as text
      fireEvent.press(screen.getByText('close'));

      await waitFor(() => {
        expect(screen.queryByText('Switch Instance')).toBeNull();
      });
    });
  });
});
