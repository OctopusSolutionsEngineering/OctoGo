/**
 * Tests for the Create Release screen (app/release/create.tsx)
 * Covers loading/error states, version input, channel selection,
 * package version editing, and the create-release mutation
 * success/failure paths (including the Alert follow-up actions).
 */

import React from 'react';
import { Alert } from 'react-native';
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

const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: mockBack }),
  useLocalSearchParams: jest.fn(),
  Stack: { Screen: () => null },
}));

jest.mock('@/src/hooks/useOctopusQuery', () => ({
  useProject: jest.fn(),
  useProjectChannels: jest.fn(),
  useReleaseTemplate: jest.fn(),
  useCreateRelease: jest.fn(),
}));

// The real LoadingScreen starts an Animated loop that breaks react-native's
// deprecated SafeAreaView getter for subsequent renders in this jest env
jest.mock('@/src/components/ui/LoadingScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    LoadingScreen: ({ message }: { message?: string }) =>
      React.createElement(Text, null, message),
  };
});

import { useLocalSearchParams } from 'expo-router';
import {
  useProject,
  useProjectChannels,
  useReleaseTemplate,
  useCreateRelease,
} from '@/src/hooks/useOctopusQuery';
import CreateReleaseScreen from '../../app/release/create';

const mockUseLocalSearchParams = useLocalSearchParams as jest.Mock;
const mockUseProject = useProject as jest.Mock;
const mockUseProjectChannels = useProjectChannels as jest.Mock;
const mockUseReleaseTemplate = useReleaseTemplate as jest.Mock;
const mockUseCreateRelease = useCreateRelease as jest.Mock;

const channels = [
  { Id: 'Channels-1', Name: 'Default', IsDefault: true },
  { Id: 'Channels-2', Name: 'Beta', IsDefault: false },
];

const makeTemplate = (overrides: Record<string, unknown> = {}) => ({
  NextVersionIncrement: '1.2.4',
  Packages: [
    {
      ActionName: 'Deploy Web',
      PackageReferenceName: null,
      PackageId: 'Acme.Web',
      VersionSelectedLastRelease: '2.0.0',
    },
    {
      ActionName: 'Deploy Web',
      PackageReferenceName: 'helper',
      PackageId: 'Acme.Helper',
      VersionSelectedLastRelease: null,
    },
  ],
  ...overrides,
});

// Find the button with the given label in the most recent Alert.alert call and press it
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

describe('CreateReleaseScreen', () => {
  let mutateAsync: jest.Mock;

  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    mockUseLocalSearchParams.mockReturnValue({ projectId: 'Projects-1' });
    mockUseProject.mockReturnValue({
      data: { Id: 'Projects-1', Name: 'Web App' },
      isLoading: false,
      error: null,
    });
    mockUseProjectChannels.mockReturnValue({ data: channels, isLoading: false });
    mockUseReleaseTemplate.mockReturnValue({ data: makeTemplate(), isLoading: false });

    mutateAsync = jest.fn().mockResolvedValue({ Id: 'Releases-9', Version: '1.2.4' });
    mockUseCreateRelease.mockReturnValue({ mutateAsync, isPending: false });
  });

  it('shows the loading screen while the project loads', () => {
    mockUseProject.mockReturnValue({ data: undefined, isLoading: true, error: null });

    render(<CreateReleaseScreen />);

    expect(screen.getByText('Loading project...')).toBeTruthy();
  });

  it('shows an error view and goes back on retry when the project fails to load', () => {
    mockUseProject.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { message: 'Project not found' },
    });

    render(<CreateReleaseScreen />);

    expect(screen.getByText('Failed to load project')).toBeTruthy();
    expect(screen.getByText('Project not found')).toBeTruthy();

    fireEvent.press(screen.getByText('Try Again'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('renders the project, suggested version, channels and packages', () => {
    render(<CreateReleaseScreen />);

    expect(screen.getByText('Web App')).toBeTruthy();
    expect(screen.getByText('New Release')).toBeTruthy();
    // Version prefilled from the template
    expect(screen.getByDisplayValue('1.2.4')).toBeTruthy();
    expect(screen.getByText('Suggested: 1.2.4')).toBeTruthy();
    // Channel chips (default channel labelled)
    expect(screen.getByText('Default (Default)')).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();
    // Packages from the template
    expect(screen.getByText('Deploy Web')).toBeTruthy();
    expect(screen.getByText('Deploy Web / helper')).toBeTruthy();
    expect(screen.getByText('Acme.Web')).toBeTruthy();
    expect(screen.getByText('Acme.Helper')).toBeTruthy();
    expect(screen.getByDisplayValue('2.0.0')).toBeTruthy();
  });

  it('requests the release template for the selected channel', () => {
    render(<CreateReleaseScreen />);

    // Default channel used initially
    expect(mockUseReleaseTemplate).toHaveBeenLastCalledWith('Projects-1', 'Channels-1');

    fireEvent.press(screen.getByText('Beta'));

    expect(Haptics.selectionAsync).toHaveBeenCalled();
    expect(mockUseReleaseTemplate).toHaveBeenLastCalledWith('Projects-1', 'Channels-2');
  });

  it('falls back to the first channel when none is marked default', () => {
    mockUseProjectChannels.mockReturnValue({
      data: [{ Id: 'Channels-3', Name: 'Only', IsDefault: false }],
      isLoading: false,
    });

    render(<CreateReleaseScreen />);

    expect(mockUseReleaseTemplate).toHaveBeenLastCalledWith('Projects-1', 'Channels-3');
    // Single channel -> no channel picker card
    expect(screen.queryByText('Channel')).toBeNull();
  });

  it('creates a release with edited values and navigates from the success alert', async () => {
    render(<CreateReleaseScreen />);

    // Edit version, release notes and both package versions
    fireEvent.changeText(screen.getByDisplayValue('1.2.4'), '2.5.0');
    fireEvent.changeText(
      screen.getByPlaceholderText("What's in this release?"),
      'Big fixes'
    );
    fireEvent.changeText(screen.getByDisplayValue('2.0.0'), '2.1.0');
    const packageInputs = screen.getAllByPlaceholderText('Version');
    fireEvent.changeText(packageInputs[packageInputs.length - 1], '5.0.0');

    await act(async () => {
      fireEvent.press(screen.getByText('Create Release'));
    });

    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
    expect(mutateAsync).toHaveBeenCalledWith({
      projectId: 'Projects-1',
      version: '2.5.0',
      channelId: 'Channels-1',
      releaseNotes: 'Big fixes',
      selectedPackages: [
        { ActionName: 'Deploy Web', PackageReferenceName: undefined, Version: '2.1.0' },
        { ActionName: 'Deploy Web', PackageReferenceName: 'helper', Version: '5.0.0' },
      ],
    });

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Release Created',
        'Version 1.2.4 has been created.',
        expect.any(Array)
      );
    });
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Success
    );

    await pressAlertButton('View Release');
    expect(mockReplace).toHaveBeenCalledWith('/release/Releases-9');

    await pressAlertButton('Create Deployment');
    expect(mockReplace).toHaveBeenCalledWith('/release/Releases-9/deploy');
  });

  it('creates a release with defaults when nothing is edited', async () => {
    render(<CreateReleaseScreen />);

    await act(async () => {
      fireEvent.press(screen.getByText('Create Release'));
    });

    // Version comes from the template, second package has no version -> skipped
    expect(mutateAsync).toHaveBeenCalledWith({
      projectId: 'Projects-1',
      version: '1.2.4',
      channelId: 'Channels-1',
      releaseNotes: undefined,
      selectedPackages: [
        { ActionName: 'Deploy Web', PackageReferenceName: undefined, Version: '2.0.0' },
      ],
    });
  });

  it('creates a release without version or packages when the template is empty', async () => {
    mockUseReleaseTemplate.mockReturnValue({ data: undefined, isLoading: false });

    render(<CreateReleaseScreen />);

    // No template -> default placeholder, no suggestion or package card
    expect(screen.getByPlaceholderText('1.0.0')).toBeTruthy();
    expect(screen.queryByText(/Suggested:/)).toBeNull();
    expect(screen.queryByText('Packages')).toBeNull();

    await act(async () => {
      fireEvent.press(screen.getByText('Create Release'));
    });

    expect(mutateAsync).toHaveBeenCalledWith({
      projectId: 'Projects-1',
      version: undefined,
      channelId: 'Channels-1',
      releaseNotes: undefined,
      selectedPackages: undefined,
    });
  });

  it('shows an error alert when creating the release fails', async () => {
    mutateAsync.mockRejectedValue(new Error('Version already exists'));

    render(<CreateReleaseScreen />);

    await act(async () => {
      fireEvent.press(screen.getByText('Create Release'));
    });

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Failed to Create Release',
        'Version already exists'
      );
    });
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Error
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('falls back to a generic message when the failure has no message', async () => {
    mutateAsync.mockRejectedValue({});

    render(<CreateReleaseScreen />);

    await act(async () => {
      fireEvent.press(screen.getByText('Create Release'));
    });

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Failed to Create Release',
        'An unexpected error occurred'
      );
    });
  });

  it('does nothing when there is no project id', async () => {
    mockUseLocalSearchParams.mockReturnValue({});

    render(<CreateReleaseScreen />);

    await act(async () => {
      fireEvent.press(screen.getByText('Create Release'));
    });

    expect(mutateAsync).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('disables the button and shows a spinner while the template loads', async () => {
    mockUseReleaseTemplate.mockReturnValue({ data: undefined, isLoading: true });

    render(<CreateReleaseScreen />);

    expect(screen.getByText('Loading release details...')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByText('Create Release'));
    });
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('shows the pending label while the release is being created', () => {
    mockUseCreateRelease.mockReturnValue({ mutateAsync, isPending: true });

    render(<CreateReleaseScreen />);

    expect(screen.getByText('Creating...')).toBeTruthy();
  });
});
