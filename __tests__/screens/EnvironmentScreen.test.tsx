/**
 * Tests for the Environment detail screen (app/environment/[id].tsx)
 * Covers loading / error / not-found states, the health summary,
 * machine rows (target type + icon helper branches), navigation and refresh.
 */

import React from 'react';
import { RefreshControl } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams } from 'expo-router';

// Keep icon rendering trivial but observable (renders the icon name as text)
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Ionicons: (props: { name: string }) => React.createElement(Text, props, props.name),
  };
});

// Override the global expo-router mock so we can control params and assert navigation
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(),
  useSegments: () => [],
  Stack: { Screen: () => null },
  Tabs: { Screen: () => null },
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../../src/hooks/useOctopusQuery', () => ({
  useEnvironment: jest.fn(),
  useMachines: jest.fn(),
}));

import { useEnvironment, useMachines } from '../../src/hooks/useOctopusQuery';
import EnvironmentDetailScreen from '../../app/environment/[id]';

const mockUseEnvironment = useEnvironment as jest.Mock;
const mockUseMachines = useMachines as jest.Mock;

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
};

const makeMachine = (overrides: Record<string, unknown> = {}) => ({
  Id: 'Machines-1',
  Name: 'machine-1',
  HealthStatus: 'Healthy',
  IsDisabled: false,
  Roles: [] as string[],
  Endpoint: { CommunicationStyle: 'TentaclePassive' },
  ...overrides,
});

// 10 machines (FlatList initial render batch) covering the helper branches
const machineFixtures = [
  makeMachine({ Id: 'Machines-1', Name: 'k8s-prod', Endpoint: { CommunicationStyle: 'Kubernetes' }, Roles: ['k8s-cluster', 'backup'] }),
  makeMachine({ Id: 'Machines-2', Name: 'listener-01', Endpoint: { CommunicationStyle: 'TentaclePassive' }, Roles: ['app'], HealthStatus: 'HasWarnings' }),
  makeMachine({ Id: 'Machines-3', Name: 'poller-01', Endpoint: { CommunicationStyle: 'TentacleActive' }, Roles: ['sql-db'], HealthStatus: 'Unhealthy' }),
  makeMachine({ Id: 'Machines-4', Name: 'ssh-box', Endpoint: { CommunicationStyle: 'Ssh' }, HealthStatus: 'Unavailable', IsDisabled: true }),
  makeMachine({ Id: 'Machines-5', Name: 'az-web', Endpoint: { CommunicationStyle: 'AzureWebApp' }, Roles: ['web-frontend'], HealthStatus: 'SomethingWeird' }),
  makeMachine({ Id: 'Machines-6', Name: 'az-cloud', Endpoint: { CommunicationStyle: 'AzureCloudService' }, Roles: undefined }),
  makeMachine({ Id: 'Machines-7', Name: 'fabric-01', Endpoint: { CommunicationStyle: 'AzureServiceFabricCluster' } }),
  makeMachine({ Id: 'Machines-8', Name: 'step-pkg', Endpoint: { CommunicationStyle: 'StepPackage' } }),
  makeMachine({ Id: 'Machines-9', Name: 'offline-drop', Endpoint: { CommunicationStyle: 'OfflineDrop' } }),
  makeMachine({ Id: 'Machines-10', Name: 'docker-host', Endpoint: undefined, Roles: ['docker-host'] }),
];

describe('EnvironmentDetailScreen', () => {
  const refetchEnv = jest.fn();
  const refetchMachines = jest.fn();

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'Environments-1' });

    mockUseEnvironment.mockReturnValue({
      data: { Id: 'Environments-1', Name: 'Production' },
      isLoading: false,
      error: null,
      refetch: refetchEnv,
    });
    mockUseMachines.mockReturnValue({
      data: { Items: machineFixtures },
      isLoading: false,
      refetch: refetchMachines,
    });
  });

  it('shows the loading screen while the environment loads', () => {
    mockUseEnvironment.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: refetchEnv,
    });
    mockUseMachines.mockReturnValue({
      data: undefined,
      isLoading: true,
      refetch: refetchMachines,
    });

    render(<EnvironmentDetailScreen />);

    expect(screen.getByText('Loading environment...')).toBeTruthy();
  });

  it('shows an error view and retries both queries', () => {
    mockUseEnvironment.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { message: 'Server exploded' },
      refetch: refetchEnv,
    });
    mockUseMachines.mockReturnValue({
      data: undefined,
      isLoading: false,
      refetch: refetchMachines,
    });

    render(<EnvironmentDetailScreen />);

    expect(screen.getByText('Server exploded')).toBeTruthy();

    fireEvent.press(screen.getByText('Try Again'));
    expect(refetchEnv).toHaveBeenCalled();
    expect(refetchMachines).toHaveBeenCalled();
  });

  it('shows a not-found error when the environment is missing', () => {
    mockUseEnvironment.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
      refetch: refetchEnv,
    });
    mockUseMachines.mockReturnValue({
      data: undefined,
      isLoading: false,
      refetch: refetchMachines,
    });

    render(<EnvironmentDetailScreen />);

    expect(screen.getByText('Environment not found')).toBeTruthy();
  });

  it('renders the health summary and machine rows with target type labels', () => {
    render(<EnvironmentDetailScreen />);

    // Health summary: 6 healthy, 1 warning, 1 unhealthy, 1 unavailable
    expect(screen.getByText('6')).toBeTruthy();
    expect(screen.getAllByText('1')).toHaveLength(3);
    expect(screen.getByText('Healthy')).toBeTruthy();
    expect(screen.getByText('Warnings')).toBeTruthy();
    expect(screen.getByText('Unhealthy')).toBeTruthy();
    expect(screen.getByText('Unavailable')).toBeTruthy();

    expect(screen.getByText('Deployment Targets (10)')).toBeTruthy();

    // Target type labels (helper branches)
    expect(screen.getByText('Kubernetes')).toBeTruthy();
    expect(screen.getByText('Listening Tentacle')).toBeTruthy();
    expect(screen.getByText('Polling Tentacle')).toBeTruthy();
    expect(screen.getByText('SSH')).toBeTruthy();
    expect(screen.getByText('Azure Web App')).toBeTruthy();
    expect(screen.getByText('Azure Cloud Service')).toBeTruthy();
    expect(screen.getByText('Service Fabric')).toBeTruthy();
    expect(screen.getByText('Cloud Region')).toBeTruthy();
    expect(screen.getByText('Offline Drop')).toBeTruthy();
    // Missing Endpoint falls back to 'Unknown'
    expect(screen.getByText('Unknown')).toBeTruthy();

    // Roles: first role plus +N overflow
    expect(screen.getByText('k8s-cluster +1')).toBeTruthy();
    // Disabled badge
    expect(screen.getByText('Disabled')).toBeTruthy();

    // Health icon branches (icon names rendered as text by the Ionicons mock)
    expect(screen.getAllByText('checkmark-circle').length).toBeGreaterThan(0);
    expect(screen.getByText('warning')).toBeTruthy();
    expect(screen.getByText('close-circle')).toBeTruthy();
    expect(screen.getByText('pause-circle')).toBeTruthy();
    expect(screen.getByText('help-circle')).toBeTruthy();
  });

  it('navigates to a machine when its card is pressed', () => {
    render(<EnvironmentDetailScreen />);

    fireEvent.press(screen.getByText('k8s-prod'));

    expect(Haptics.impactAsync).toHaveBeenCalled();
    expect(mockRouter.push).toHaveBeenCalledWith('/machine/Machines-1');
  });

  it('covers the remaining target type and icon branches', () => {
    mockUseMachines.mockReturnValue({
      data: {
        Items: [
          makeMachine({ Id: 'Machines-20', Name: 'empty-style', Endpoint: { CommunicationStyle: '' } }),
          makeMachine({ Id: 'Machines-21', Name: 'none-style', Endpoint: { CommunicationStyle: 'None' } }),
          makeMachine({ Id: 'Machines-22', Name: 'weird-style', Endpoint: { CommunicationStyle: 'WeirdStyle' }, Roles: ['web-iis'] }),
          makeMachine({ Id: 'Machines-23', Name: 'kube-role', Endpoint: { CommunicationStyle: 'TentaclePassive' }, Roles: ['kube-agents'] }),
        ],
      },
      isLoading: false,
      refetch: refetchMachines,
    });

    render(<EnvironmentDetailScreen />);

    // '' and 'None' both map to Cloud Region
    expect(screen.getAllByText('Cloud Region')).toHaveLength(2);
    // Unrecognised style is rendered verbatim
    expect(screen.getByText('WeirdStyle')).toBeTruthy();
    // k8s inferred from roles despite Tentacle style
    expect(screen.getByText('Kubernetes')).toBeTruthy();
  });

  it('shows an empty state when there are no deployment targets and refreshes', () => {
    mockUseMachines.mockReturnValue({
      data: { Items: [] },
      isLoading: false,
      refetch: refetchMachines,
    });

    render(<EnvironmentDetailScreen />);

    expect(screen.getByText('Deployment Targets (0)')).toBeTruthy();
    expect(screen.getByText('No deployment targets')).toBeTruthy();

    // Pull-to-refresh triggers both refetches
    fireEvent(screen.UNSAFE_getByType(RefreshControl), 'refresh');
    expect(refetchEnv).toHaveBeenCalled();
    expect(refetchMachines).toHaveBeenCalled();
  });
});
