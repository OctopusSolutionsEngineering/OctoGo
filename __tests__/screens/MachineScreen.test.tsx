/**
 * Tests for the Machine detail screen (app/machine/[id].tsx)
 * Covers loading / error / not-found states, the health card, details,
 * environment/role/tenant tags, health-check mutation (success + failure)
 * and the communication-style / health helper branches.
 */

import React from 'react';
import { Alert, RefreshControl } from 'react-native';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams } from 'expo-router';

// Keep icon rendering trivial
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Ionicons: (props: { name: string }) => React.createElement(Text, props, props.name),
  };
});

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(),
  useSegments: () => [],
  Stack: { Screen: () => null },
  Tabs: { Screen: () => null },
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../../src/hooks/useOctopusQuery', () => ({
  useMachine: jest.fn(),
  useEnvironments: jest.fn(),
  useTriggerMachineHealthCheck: jest.fn(),
}));

import { useMachine, useEnvironments, useTriggerMachineHealthCheck } from '../../src/hooks/useOctopusQuery';
import MachineDetailScreen from '../../app/machine/[id]';

const mockUseMachine = useMachine as jest.Mock;
const mockUseEnvironments = useEnvironments as jest.Mock;
const mockUseTriggerHealthCheck = useTriggerMachineHealthCheck as jest.Mock;

const MACHINE_ID = 'Machines-1';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
};

const makeMachine = (overrides: Record<string, unknown> = {}) => ({
  Id: MACHINE_ID,
  Name: 'web-01',
  HealthStatus: 'Healthy',
  Status: 'Online',
  StatusSummary: 'This machine was healthy at the last check',
  IsDisabled: false,
  Endpoint: { CommunicationStyle: 'TentaclePassive' },
  Uri: 'https://10.0.0.5:10933/',
  Thumbprint: 'ABCDEF0123456789ABCDEF0123456789',
  HasLatestCalamari: true,
  EnvironmentIds: ['Environments-1', 'Environments-404'],
  Roles: ['web-server', 'app'],
  TenantIds: ['Tenants-1'],
  TenantTags: ['ring/beta'],
  ...overrides,
});

// Find the button with the given label in the most recent Alert.alert call and press it
const pressAlertButton = async (label: string) => {
  const lastCall = (Alert.alert as jest.Mock).mock.calls.at(-1);
  expect(lastCall).toBeDefined();
  const buttons = (lastCall?.[2] ?? []) as { text: string; onPress?: () => Promise<void> | void }[];
  const button = buttons.find((b) => b.text === label);
  expect(button).toBeDefined();
  await act(async () => {
    await button!.onPress?.();
  });
};

describe('MachineDetailScreen', () => {
  const refetch = jest.fn();
  const mutateAsync = jest.fn();

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: MACHINE_ID });
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    mockUseMachine.mockReturnValue({
      data: makeMachine(),
      isLoading: false,
      error: null,
      refetch,
    });
    mockUseEnvironments.mockReturnValue({
      data: [{ Id: 'Environments-1', Name: 'Dev' }],
    });
    mutateAsync.mockResolvedValue({ Id: 'ServerTasks-42' });
    mockUseTriggerHealthCheck.mockReturnValue({
      mutateAsync,
      isPending: false,
    });
  });

  it('shows the loading screen while the machine loads', () => {
    mockUseMachine.mockReturnValue({ data: undefined, isLoading: true, error: null, refetch });

    render(<MachineDetailScreen />);

    expect(screen.getByText('Loading machine...')).toBeTruthy();
  });

  it('shows an error view with retry when loading fails', () => {
    mockUseMachine.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { message: 'Machine query failed' },
      refetch,
    });

    render(<MachineDetailScreen />);

    expect(screen.getByText('Machine query failed')).toBeTruthy();
    fireEvent.press(screen.getByText('Try Again'));
    expect(refetch).toHaveBeenCalled();
  });

  it('shows a not-found error when the machine is missing', () => {
    mockUseMachine.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch });

    render(<MachineDetailScreen />);

    expect(screen.getByText('Machine not found')).toBeTruthy();
  });

  it('renders health, details, environments, tags and tenants', () => {
    render(<MachineDetailScreen />);

    // Health card
    expect(screen.getByText('Healthy')).toBeTruthy();
    expect(screen.getByText('Online')).toBeTruthy();
    expect(screen.getByText('This machine was healthy at the last check')).toBeTruthy();

    // Details
    expect(screen.getByText('Listening Tentacle')).toBeTruthy();
    expect(screen.getByText('https://10.0.0.5:10933/')).toBeTruthy();
    expect(screen.getByText('ABCDEF0123456789ABCD...')).toBeTruthy();
    expect(screen.getByText('Up to date')).toBeTruthy();

    // Environments with a name-fallback for an unknown id
    expect(screen.getByText('Environments (2)')).toBeTruthy();
    expect(screen.getByText('Dev')).toBeTruthy();
    expect(screen.getByText('Environments-404')).toBeTruthy();

    // Target tags
    expect(screen.getByText('Target Tags (2)')).toBeTruthy();
    expect(screen.getByText('web-server')).toBeTruthy();
    expect(screen.getByText('app')).toBeTruthy();

    // Tenants + tenant tags
    expect(screen.getByText('Tenants (1)')).toBeTruthy();
    expect(screen.getByText('Tenants-1')).toBeTruthy();
    expect(screen.getByText('Tenant Tags (1)')).toBeTruthy();
    expect(screen.getByText('ring/beta')).toBeTruthy();

    // Pull-to-refresh
    fireEvent(screen.UNSAFE_getByType(RefreshControl), 'refresh');
    expect(refetch).toHaveBeenCalled();
  });

  it('renders a disabled machine with empty collections and hidden Unknown status', () => {
    mockUseMachine.mockReturnValue({
      data: makeMachine({
        HealthStatus: 'Unavailable',
        Status: 'Unknown',
        StatusSummary: null,
        IsDisabled: true,
        Uri: null,
        Thumbprint: null,
        HasLatestCalamari: false,
        Endpoint: { CommunicationStyle: 'CloudRegion' },
        EnvironmentIds: [],
        Roles: [],
        TenantIds: [],
        TenantTags: [],
      }),
      isLoading: false,
      error: null,
      refetch,
    });
    mockUseEnvironments.mockReturnValue({ data: undefined });

    render(<MachineDetailScreen />);

    expect(screen.getByText('Unavailable')).toBeTruthy();
    // Status 'Unknown' is suppressed
    expect(screen.queryByText('Unknown')).toBeNull();
    expect(screen.getByText('This target is disabled.')).toBeTruthy();
    expect(screen.getByText('This machine is disabled')).toBeTruthy();
    expect(screen.getByText('Needs update')).toBeTruthy();
    expect(screen.getByText('Cloud Region')).toBeTruthy();
    expect(screen.getByText('No environments assigned')).toBeTruthy();
    expect(screen.getByText('No target tags assigned')).toBeTruthy();
    expect(screen.queryByText(/^Tenants \(/)).toBeNull();
    expect(screen.queryByText(/^Tenant Tags \(/)).toBeNull();
  });

  it('covers the remaining communication-style, health and status branches', () => {
    const variants: [string, string, string, string][] = [
      ['TentacleActive', 'Polling Tentacle', 'HasWarnings', 'Offline'],
      ['Ssh', 'SSH', 'Unhealthy', 'Disabled'],
      ['Kubernetes', 'Kubernetes Agent', 'MysteryHealth', 'NeedsUpgrade'],
      ['KubernetesTentacle', 'Kubernetes Agent', 'Healthy', 'SomeStatus'],
      ['AzureWebApp', 'Azure Web App', 'Healthy', 'Online'],
      ['AzureCloudService', 'Azure Cloud Service', 'Healthy', 'Online'],
      ['AzureServiceFabricCluster', 'Service Fabric', 'Healthy', 'Online'],
      ['OfflineDrop', 'Offline Drop', 'Healthy', 'Online'],
      ['StepPackage', 'Cloud Region', 'Healthy', 'Online'],
      ['None', 'Cloud Region', 'Healthy', 'Online'],
      ['SomethingElse', 'SomethingElse', 'Healthy', 'Online'],
      ['', 'Unknown', 'Healthy', 'Online'],
    ];

    for (const [style, label, health, status] of variants) {
      mockUseMachine.mockReturnValue({
        data: makeMachine({
          Endpoint: { CommunicationStyle: style },
          HealthStatus: health,
          Status: status,
          StatusSummary: undefined,
          TenantIds: [],
          TenantTags: [],
        }),
        isLoading: false,
        error: null,
        refetch,
      });

      const view = render(<MachineDetailScreen />);
      expect(screen.getByText(label)).toBeTruthy();
      expect(screen.getByText(health)).toBeTruthy();
      // No StatusSummary and not disabled -> enabled message
      expect(screen.getByText('This target is enabled.')).toBeTruthy();
      view.unmount();
    }
  });

  it('runs a health check and navigates to the created task', async () => {
    render(<MachineDetailScreen />);

    fireEvent.press(screen.getByText('Run Health Check'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Run Health Check',
      'This will trigger a health check task for this machine. Continue?',
      expect.any(Array)
    );

    await pressAlertButton('Run Health Check');

    expect(mutateAsync).toHaveBeenCalledWith(MACHINE_ID);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Health Check Started',
        'The health check task has been created.',
        expect.any(Array)
      );
    });

    await pressAlertButton('View Task');
    expect(mockRouter.push).toHaveBeenCalledWith('/task/ServerTasks-42');
  });

  it('shows the error message when the health check fails', async () => {
    mutateAsync.mockRejectedValue(new Error('tentacle offline'));

    render(<MachineDetailScreen />);

    fireEvent.press(screen.getByText('Run Health Check'));
    await pressAlertButton('Run Health Check');

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'tentacle offline');
    });
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Error);
  });

  it('falls back to a generic error message when the failure has no message', async () => {
    mutateAsync.mockRejectedValue({});

    render(<MachineDetailScreen />);

    fireEvent.press(screen.getByText('Run Health Check'));
    await pressAlertButton('Run Health Check');

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to start health check');
    });
  });
});
