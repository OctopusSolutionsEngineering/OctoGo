/**
 * Tests for the Deploy Release screen (app/release/[id]/deploy.tsx)
 * Covers loading/error states, environment status derivation
 * (available/deployed/blocked), tenant selection, the deployment
 * preview card, and the create-deployment mutation success/failure paths.
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
  useRelease: jest.fn(),
  useReleaseProgression: jest.fn(),
  useEnvironments: jest.fn(),
  useTenants: jest.fn(),
  useDeploymentPreview: jest.fn(),
  useCreateDeployment: jest.fn(),
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
  useRelease,
  useReleaseProgression,
  useEnvironments,
  useTenants,
  useDeploymentPreview,
  useCreateDeployment,
} from '@/src/hooks/useOctopusQuery';
import DeployReleaseScreen from '../../app/release/[id]/deploy';

const mockUseLocalSearchParams = useLocalSearchParams as jest.Mock;
const mockUseRelease = useRelease as jest.Mock;
const mockUseReleaseProgression = useReleaseProgression as jest.Mock;
const mockUseEnvironments = useEnvironments as jest.Mock;
const mockUseTenants = useTenants as jest.Mock;
const mockUseDeploymentPreview = useDeploymentPreview as jest.Mock;
const mockUseCreateDeployment = useCreateDeployment as jest.Mock;

const environments = [
  { Id: 'Environments-1', Name: 'Dev', SortOrder: 0 },
  { Id: 'Environments-2', Name: 'Staging', SortOrder: 1 },
  { Id: 'Environments-3', Name: 'Prod', SortOrder: 2 },
];

const progression = {
  NextDeployments: ['Environments-2'],
  Phases: [
    {
      Deployments: {
        'Environments-1': [{ Id: 'Deployments-1' }],
        // Empty deployment list -> not considered deployed
        'Environments-3': [],
      },
    },
    // Phase without deployments -> exercises the `|| {}` fallback
    { Deployments: undefined },
  ],
};

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

describe('DeployReleaseScreen', () => {
  let mutateAsync: jest.Mock;

  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    mockUseLocalSearchParams.mockReturnValue({ id: 'Releases-1' });
    mockUseRelease.mockReturnValue({
      data: { Id: 'Releases-1', Version: '3.1.4' },
      isLoading: false,
      error: null,
    });
    mockUseReleaseProgression.mockReturnValue({ data: progression });
    mockUseEnvironments.mockReturnValue({ data: environments });
    mockUseTenants.mockReturnValue({
      data: {
        Items: [
          { Id: 'Tenants-1', Name: 'Acme' },
          { Id: 'Tenants-2', Name: 'Globex' },
        ],
      },
    });
    mockUseDeploymentPreview.mockReturnValue({
      data: { HasPreviouslyBeenDeployed: false, StepsToExecute: [{}, {}] },
    });

    mutateAsync = jest.fn().mockResolvedValue({ Id: 'Deployments-9', TaskId: 'ServerTasks-5' });
    mockUseCreateDeployment.mockReturnValue({ mutateAsync, isPending: false });
  });

  it('shows the loading screen while the release loads', () => {
    mockUseRelease.mockReturnValue({ data: undefined, isLoading: true, error: null });

    render(<DeployReleaseScreen />);

    expect(screen.getByText('Loading release...')).toBeTruthy();
  });

  it('shows an error view and goes back on retry when the release fails to load', () => {
    mockUseRelease.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { message: 'Release not found' },
    });

    render(<DeployReleaseScreen />);

    expect(screen.getByText('Failed to load release')).toBeTruthy();
    expect(screen.getByText('Release not found')).toBeTruthy();

    fireEvent.press(screen.getByText('Try Again'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('renders environments with available, deployed and blocked statuses', () => {
    render(<DeployReleaseScreen />);

    expect(screen.getByText('3.1.4')).toBeTruthy();
    expect(screen.getByText('Deploy Release')).toBeTruthy();

    // Dev has deployments, Staging is the next deployment, Prod is blocked
    expect(screen.getByText('Dev')).toBeTruthy();
    expect(screen.getByText('Already deployed')).toBeTruthy();
    expect(screen.getByText('Staging')).toBeTruthy();
    expect(screen.getByText('Ready for deployment')).toBeTruthy();
    expect(screen.getByText('Prod')).toBeTruthy();
    expect(screen.getByText('Blocked by lifecycle')).toBeTruthy();

    // Tenant chips
    expect(screen.getByText('Tenant (optional)')).toBeTruthy();
    expect(screen.getByText('No Tenant')).toBeTruthy();
    expect(screen.getByText('Acme')).toBeTruthy();
    expect(screen.getByText('Globex')).toBeTruthy();
  });

  it('shows the deployment preview after selecting an available environment', () => {
    render(<DeployReleaseScreen />);

    expect(screen.queryByText('Deployment Preview')).toBeNull();

    fireEvent.press(screen.getByText('Staging'));

    expect(Haptics.selectionAsync).toHaveBeenCalled();
    expect(screen.getByText('Deployment Preview')).toBeTruthy();
    expect(screen.getByText('First deployment to this environment')).toBeTruthy();
    expect(screen.getByText('2 step(s) will be executed')).toBeTruthy();
  });

  it('shows the redeploy preview text for previously deployed environments', () => {
    mockUseDeploymentPreview.mockReturnValue({
      data: { HasPreviouslyBeenDeployed: true, StepsToExecute: [] },
    });

    render(<DeployReleaseScreen />);

    // Deployed environments can be selected again
    fireEvent.press(screen.getByText('Dev'));

    expect(
      screen.getByText('This release has been deployed to this environment before')
    ).toBeTruthy();
    expect(screen.queryByText(/will be executed/)).toBeNull();
  });

  it('ignores presses on blocked environments and keeps the deploy button disabled', async () => {
    render(<DeployReleaseScreen />);

    fireEvent.press(screen.getByText('Prod'));
    expect(screen.queryByText('Deployment Preview')).toBeNull();

    await act(async () => {
      fireEvent.press(screen.getByText('Deploy Now'));
    });
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('deploys to the selected environment and navigates from the success alert', async () => {
    render(<DeployReleaseScreen />);

    fireEvent.press(screen.getByText('Staging'));
    fireEvent.changeText(
      screen.getByPlaceholderText('Add a note about this deployment...'),
      'ship it'
    );

    await act(async () => {
      fireEvent.press(screen.getByText('Deploy Now'));
    });

    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
    expect(mutateAsync).toHaveBeenCalledWith({
      releaseId: 'Releases-1',
      environmentId: 'Environments-2',
      comments: 'ship it',
      tenantId: undefined,
    });

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Deployment Started',
        'Your deployment is now queued.',
        expect.any(Array)
      );
    });
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Success
    );

    await pressAlertButton('View Task');
    expect(mockReplace).toHaveBeenCalledWith('/task/ServerTasks-5');

    await pressAlertButton('Done');
    expect(mockBack).toHaveBeenCalled();
  });

  it('includes the selected tenant in the deployment', async () => {
    render(<DeployReleaseScreen />);

    fireEvent.press(screen.getByText('Staging'));
    fireEvent.press(screen.getByText('Acme'));

    await act(async () => {
      fireEvent.press(screen.getByText('Deploy Now'));
    });

    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'Tenants-1' })
    );
  });

  it('clears the tenant when No Tenant is pressed', async () => {
    render(<DeployReleaseScreen />);

    fireEvent.press(screen.getByText('Staging'));
    fireEvent.press(screen.getByText('Globex'));
    fireEvent.press(screen.getByText('No Tenant'));

    await act(async () => {
      fireEvent.press(screen.getByText('Deploy Now'));
    });

    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: undefined })
    );
  });

  it('shows an error alert when the deployment fails', async () => {
    mutateAsync.mockRejectedValue(new Error('Lifecycle violation'));

    render(<DeployReleaseScreen />);

    fireEvent.press(screen.getByText('Staging'));
    await act(async () => {
      fireEvent.press(screen.getByText('Deploy Now'));
    });

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Deployment Failed', 'Lifecycle violation');
    });
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Error
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('falls back to a generic message when the failure has no message', async () => {
    mutateAsync.mockRejectedValue({});

    render(<DeployReleaseScreen />);

    fireEvent.press(screen.getByText('Staging'));
    await act(async () => {
      fireEvent.press(screen.getByText('Deploy Now'));
    });

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Deployment Failed',
        'An unexpected error occurred'
      );
    });
  });

  it('does nothing when there is no release id', async () => {
    mockUseLocalSearchParams.mockReturnValue({});

    render(<DeployReleaseScreen />);

    fireEvent.press(screen.getByText('Staging'));
    await act(async () => {
      fireEvent.press(screen.getByText('Deploy Now'));
    });

    expect(mutateAsync).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('handles missing progression, environments and tenants gracefully', () => {
    mockUseReleaseProgression.mockReturnValue({ data: undefined });
    mockUseEnvironments.mockReturnValue({ data: undefined });
    mockUseTenants.mockReturnValue({ data: undefined });

    render(<DeployReleaseScreen />);

    expect(screen.getByText('Select Environment')).toBeTruthy();
    expect(screen.queryByText('Dev')).toBeNull();
    expect(screen.queryByText('Tenant (optional)')).toBeNull();
  });

  it('shows the pending label while the deployment is being created', () => {
    mockUseCreateDeployment.mockReturnValue({ mutateAsync, isPending: true });

    render(<DeployReleaseScreen />);

    expect(screen.getByText('Deploying...')).toBeTruthy();
  });
});
