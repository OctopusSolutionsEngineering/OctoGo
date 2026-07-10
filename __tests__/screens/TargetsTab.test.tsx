/**
 * Tests for the Targets tab screen
 * Covers the health status colour/icon helpers, the target-type label and
 * communication-style icon helpers (including role-based hints), health
 * filtering, navigation, refresh, and loading / error / empty states.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { RefreshControl } from 'react-native';

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

jest.mock('../../src/context/ThemeContext', () => {
  const actual = jest.requireActual('../../src/context/ThemeContext');
  return {
    ...actual,
    useColors: () => actual.darkColors,
  };
});

jest.mock('../../src/hooks/useOctopusQuery', () => ({
  useMachines: jest.fn(),
  useEnvironments: jest.fn(),
}));

import { useMachines, useEnvironments } from '../../src/hooks/useOctopusQuery';
import TargetsScreen from '../../app/(tabs)/targets';

const mockUseMachines = useMachines as jest.Mock;
const mockUseEnvironments = useEnvironments as jest.Mock;

const makeMachine = (overrides: Record<string, unknown> = {}) => ({
  Id: 'Machines-1',
  Name: 'Target One',
  HealthStatus: 'Healthy',
  EnvironmentIds: ['Environments-1'],
  Roles: ['web-server'],
  Endpoint: { CommunicationStyle: 'TentaclePassive' },
  IsDisabled: false,
  ...overrides,
});

const setMachines = (items: unknown[], extra: Record<string, unknown> = {}) => {
  mockUseMachines.mockReturnValue({
    data: { Items: items },
    isLoading: false,
    error: null,
    refetch: jest.fn(),
    ...extra,
  });
};

describe('TargetsScreen', () => {
  beforeEach(() => {
    setMachines([]);
    mockUseEnvironments.mockReturnValue({
      data: [
        { Id: 'Environments-1', Name: 'Production' },
        { Id: 'Environments-2', Name: 'Staging' },
      ],
    });
  });

  it('renders health icons and filter counts for each health status', () => {
    setMachines([
      makeMachine({ Id: 'Machines-1', Name: 'Alpha', HealthStatus: 'Healthy' }),
      makeMachine({ Id: 'Machines-2', Name: 'Bravo', HealthStatus: 'HasWarnings' }),
      makeMachine({ Id: 'Machines-3', Name: 'Charlie', HealthStatus: 'Unhealthy' }),
      makeMachine({ Id: 'Machines-4', Name: 'Delta', HealthStatus: 'Unavailable' }),
      makeMachine({ Id: 'Machines-5', Name: 'Echo', HealthStatus: undefined }),
    ]);

    render(<TargetsScreen />);

    expect(screen.getByText('checkmark-circle')).toBeTruthy();
    expect(screen.getByText('warning')).toBeTruthy();
    expect(screen.getByText('close-circle')).toBeTruthy();
    expect(screen.getByText('pause-circle')).toBeTruthy();
    expect(screen.getByText('help-circle')).toBeTruthy();

    expect(screen.getByText('Healthy (1)')).toBeTruthy();
    expect(screen.getByText('Warnings (1)')).toBeTruthy();
    expect(screen.getByText('Issues (2)')).toBeTruthy();
  });

  it('labels the common target types and shows environment/role/disabled badges', () => {
    setMachines([
      makeMachine({
        Id: 'Machines-1',
        Name: 'K8s Cluster',
        Endpoint: { CommunicationStyle: 'Kubernetes' },
        Roles: ['k8s-cluster', 'east', 'west'],
        EnvironmentIds: ['Environments-1', 'Environments-2'],
      }),
      makeMachine({
        Id: 'Machines-2',
        Name: 'Listener',
        Endpoint: { CommunicationStyle: 'TentaclePassive' },
        Roles: ['backend'],
        IsDisabled: true,
      }),
      makeMachine({
        Id: 'Machines-3',
        Name: 'Poller',
        Endpoint: { CommunicationStyle: 'TentacleActive' },
        Roles: ['backend'],
        EnvironmentIds: ['Environments-404'],
      }),
      makeMachine({
        Id: 'Machines-4',
        Name: 'Linux Box',
        Endpoint: { CommunicationStyle: 'Ssh' },
        Roles: [],
        EnvironmentIds: [],
      }),
      makeMachine({
        Id: 'Machines-5',
        Name: 'Web App',
        Endpoint: { CommunicationStyle: 'AzureWebApp' },
      }),
      makeMachine({
        Id: 'Machines-6',
        Name: 'Drop Zone',
        Endpoint: { CommunicationStyle: 'OfflineDrop' },
      }),
    ]);

    render(<TargetsScreen />);

    // Type labels
    expect(screen.getByText('Kubernetes')).toBeTruthy();
    expect(screen.getByText('Listening Tentacle')).toBeTruthy();
    expect(screen.getByText('Polling Tentacle')).toBeTruthy();
    expect(screen.getByText('SSH')).toBeTruthy();
    expect(screen.getByText('Azure Web App')).toBeTruthy();
    expect(screen.getByText('Offline Drop')).toBeTruthy();

    // Type icons
    expect(screen.getByText('cube')).toBeTruthy();
    expect(screen.getAllByText('desktop')).toHaveLength(2);
    expect(screen.getByText('terminal')).toBeTruthy();
    expect(screen.getByText('globe')).toBeTruthy();
    expect(screen.getByText('folder')).toBeTruthy();

    // Roles: first role plus "+n" overflow
    expect(screen.getByText('k8s-cluster +2')).toBeTruthy();

    // Environments: name plus "+n", unknown env fallback, none at all
    expect(screen.getByText('Production +1')).toBeTruthy();
    expect(screen.getByText('Environment')).toBeTruthy();

    // Disabled badge
    expect(screen.getByText('Disabled')).toBeTruthy();
  });

  it('labels azure/cloud/role-hinted targets and handles missing endpoint data', () => {
    setMachines([
      makeMachine({
        Id: 'Machines-11',
        Name: 'Cloud Service',
        Endpoint: { CommunicationStyle: 'AzureCloudService' },
      }),
      makeMachine({
        Id: 'Machines-12',
        Name: 'Fabric',
        Endpoint: { CommunicationStyle: 'AzureServiceFabricCluster' },
      }),
      makeMachine({
        Id: 'Machines-13',
        Name: 'Step Pkg',
        Endpoint: { CommunicationStyle: 'StepPackage' },
      }),
      makeMachine({
        Id: 'Machines-14',
        Name: 'Docker Host',
        Endpoint: { CommunicationStyle: 'None' },
        Roles: ['docker-host'],
      }),
      makeMachine({
        Id: 'Machines-15',
        Name: 'DB Server',
        Endpoint: { CommunicationStyle: '' },
        Roles: ['sql-database'],
      }),
      makeMachine({
        Id: 'Machines-16',
        Name: 'Web Farm',
        Endpoint: { CommunicationStyle: 'CustomThing' },
        Roles: ['iis-frontend'],
      }),
      makeMachine({
        Id: 'Machines-17',
        Name: 'Kube By Role',
        Endpoint: { CommunicationStyle: 'TentaclePassive' },
        Roles: ['kube-node'],
      }),
      // No Id (keyExtractor fallback), no Endpoint / Roles / EnvironmentIds
      makeMachine({
        Id: undefined,
        Name: 'Bare Machine',
        Endpoint: undefined,
        Roles: undefined,
        EnvironmentIds: undefined,
      }),
    ]);

    render(<TargetsScreen />);

    expect(screen.getByText('Azure Cloud Service')).toBeTruthy();
    expect(screen.getByText('Service Fabric')).toBeTruthy();
    // StepPackage, None and empty style all map to Cloud Region
    expect(screen.getAllByText('Cloud Region')).toHaveLength(3);
    expect(screen.getByText('CustomThing')).toBeTruthy();
    expect(screen.getByText('Kubernetes')).toBeTruthy();
    // Missing endpoint falls back to the raw "Unknown" style
    expect(screen.getByText('Unknown')).toBeTruthy();

    // Role-hinted icons: docker -> layers, db -> server, web -> globe, k8s -> cube
    expect(screen.getByText('layers')).toBeTruthy();
    expect(screen.getByText('globe')).toBeTruthy();
    expect(screen.getByText('cube')).toBeTruthy();
    expect(screen.getAllByText('cloud')).toHaveLength(2);
    expect(screen.getByText('cloud-outline')).toBeTruthy();
    // DB role and the bare default both use the server icon
    expect(screen.getAllByText('server').length).toBeGreaterThanOrEqual(2);
  });

  it('filters machines by health status when filter pills are pressed', () => {
    // No environments loaded: the environment map falls back to empty
    mockUseEnvironments.mockReturnValue({ data: undefined });
    setMachines([
      makeMachine({ Id: 'Machines-1', Name: 'Alpha', HealthStatus: 'Healthy' }),
      makeMachine({ Id: 'Machines-2', Name: 'Bravo', HealthStatus: 'HasWarnings' }),
      makeMachine({ Id: 'Machines-3', Name: 'Charlie', HealthStatus: 'Unhealthy' }),
      makeMachine({ Id: 'Machines-4', Name: 'Delta', HealthStatus: 'Unavailable' }),
      makeMachine({ Id: 'Machines-5', Name: 'Echo', HealthStatus: undefined }),
    ]);

    render(<TargetsScreen />);

    fireEvent.press(screen.getByText('Healthy (1)'));
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.queryByText('Bravo')).toBeNull();
    expect(screen.queryByText('Echo')).toBeNull();

    fireEvent.press(screen.getByText('Warnings (1)'));
    expect(screen.getByText('Bravo')).toBeTruthy();
    expect(screen.queryByText('Alpha')).toBeNull();

    fireEvent.press(screen.getByText('Issues (2)'));
    expect(screen.getByText('Charlie')).toBeTruthy();
    expect(screen.getByText('Delta')).toBeTruthy();
    expect(screen.queryByText('Alpha')).toBeNull();

    fireEvent.press(screen.getByText('All'));
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Bravo')).toBeTruthy();
  });

  it('shows filter-specific empty states', () => {
    render(<TargetsScreen />);

    expect(screen.getByText('No deployment targets found')).toBeTruthy();
    expect(screen.getByText('Add deployment targets in Octopus Deploy to see them here')).toBeTruthy();

    fireEvent.press(screen.getByText('Healthy (0)'));
    expect(screen.getByText('No healthy targets')).toBeTruthy();
    expect(screen.getByText('Try a different filter to see more targets')).toBeTruthy();

    fireEvent.press(screen.getByText('Issues (0)'));
    expect(screen.getByText('No targets with issues')).toBeTruthy();
  });

  it('does not render the empty state while loading', () => {
    setMachines([], { isLoading: true });

    render(<TargetsScreen />);

    expect(screen.queryByText('No deployment targets found')).toBeNull();
  });

  it('navigates to the machine when a card is pressed', () => {
    setMachines([makeMachine({ Id: 'Machines-42', Name: 'Tap Me' })]);

    render(<TargetsScreen />);

    fireEvent.press(screen.getByText('Tap Me'));

    expect(mockPush).toHaveBeenCalledWith('/machine/Machines-42');
  });

  it('shows an error view when loading machines fails', () => {
    setMachines([], { data: undefined, error: { message: 'Machines unavailable' } });

    render(<TargetsScreen />);

    expect(screen.getByText('Machines unavailable')).toBeTruthy();
  });

  it('refetches when pull-to-refresh is triggered', () => {
    const refetch = jest.fn();
    setMachines([makeMachine()], { refetch });

    render(<TargetsScreen />);

    fireEvent(screen.UNSAFE_getByType(RefreshControl), 'refresh');

    expect(refetch).toHaveBeenCalled();
  });
});
