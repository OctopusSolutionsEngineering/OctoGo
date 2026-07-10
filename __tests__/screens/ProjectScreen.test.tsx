/**
 * Tests for the Project detail screen
 * Covers the `!!project.Description` header branch, the channels section
 * (collapsed channelLifecycleName ternary) and the `!!resource.Namespace`
 * row in the Kubernetes live status modal, both ways.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

// Mock vector icons to avoid loading expo-font/expo-asset in tests
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Ionicons: (props: { name: string }) => React.createElement(Text, props, props.name),
  };
});

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'Projects-1' }),
  Stack: { Screen: () => null },
}));

jest.mock('../../src/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../src/context/FavoritesContext', () => ({
  useFavorites: jest.fn(),
}));

jest.mock('../../src/hooks/useOctopusQuery', () => ({
  useProject: jest.fn(),
  useReleases: jest.fn(),
  useCreateDeployment: jest.fn(),
  useProjectSummary: jest.fn(),
  useDeploymentProcess: jest.fn(),
  useProjectRunbooks: jest.fn(),
  useProjectVariables: jest.fn(),
  useProjectChannels: jest.fn(),
  useDeployments: jest.fn(),
  useProjectProgression: jest.fn(),
  useKubernetesLiveStatus: jest.fn(),
  useEnvironments: jest.fn(),
  useLifecycle: jest.fn(),
  useTenants: jest.fn(),
}));

import { useAuth } from '../../src/context/AuthContext';
import { useFavorites } from '../../src/context/FavoritesContext';
import {
  useProject,
  useReleases,
  useCreateDeployment,
  useProjectSummary,
  useDeploymentProcess,
  useProjectRunbooks,
  useProjectVariables,
  useProjectChannels,
  useDeployments,
  useProjectProgression,
  useKubernetesLiveStatus,
  useEnvironments,
  useLifecycle,
  useTenants,
} from '../../src/hooks/useOctopusQuery';
import ProjectDetailScreen from '../../app/project/[id]';

const mockUseProject = useProject as jest.Mock;
const mockUseLifecycle = useLifecycle as jest.Mock;
const mockUseProjectChannels = useProjectChannels as jest.Mock;
const mockUseKubernetesLiveStatus = useKubernetesLiveStatus as jest.Mock;
const mockUseProjectSummary = useProjectSummary as jest.Mock;

const project = {
  Id: 'Projects-1',
  Name: 'Web App',
  Description: 'A demo project for the mobile app',
  IsDisabled: false,
  LifecycleId: 'Lifecycles-1',
  Logo: null,
};

const dashboardItem = {
  Id: 'di-1',
  ProjectId: 'Projects-1',
  EnvironmentId: 'Environments-1',
  ReleaseId: 'Releases-1',
  DeploymentId: 'Deployments-1',
  ReleaseVersion: '1.0.0',
  State: 'Success',
  Created: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  IsCurrent: true,
  IsCompleted: true,
  Duration: '00:01:00',
};

const k8sStatus = {
  DeploymentId: 'Deployments-1',
  ApplicationStatus: 'Healthy',
  ApplicationStatusMessage: null,
  Resources: [
    // With a namespace -> namespace row rendered
    { Name: 'web-deployment', Kind: 'Deployment', Status: 'Healthy', Namespace: 'production' },
    // Without a namespace -> no namespace row
    { Name: 'web-service', Kind: 'Service', Status: 'InSync', Namespace: '' },
  ],
  LastUpdated: new Date().toISOString(),
  IsAvailable: true,
};

describe('ProjectDetailScreen', () => {
  beforeEach(() => {
    (useAuth as jest.Mock).mockReturnValue({
      currentInstance: { id: 'instance-1', serverUrl: 'https://meanski.octopus.app' },
    });
    (useFavorites as jest.Mock).mockReturnValue({
      isFavorite: jest.fn().mockReturnValue(false),
      toggleFavorite: jest.fn(),
    });
    mockUseProject.mockReturnValue({
      data: project,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    (useReleases as jest.Mock).mockReturnValue({
      data: {
        Items: [{ Id: 'Releases-1', Version: '1.0.0', ProjectId: 'Projects-1' }],
      },
      refetch: jest.fn(),
    });
    mockUseProjectSummary.mockReturnValue({
      data: {
        Environments: [{ Id: 'Environments-1', Name: 'Production' }],
        Items: [dashboardItem],
      },
      isLoading: false,
      refetch: jest.fn(),
    });
    (useDeployments as jest.Mock).mockReturnValue({
      data: {
        Items: [
          {
            Id: 'Deployments-1',
            ReleaseId: 'Releases-1',
            EnvironmentId: 'Environments-1',
            Created: dashboardItem.Created,
            Name: 'Deploy to Production',
          },
        ],
        TotalResults: 1,
      },
      refetch: jest.fn(),
      isFetching: false,
    });
    (useProjectProgression as jest.Mock).mockReturnValue({ refetch: jest.fn() });
    (useDeploymentProcess as jest.Mock).mockReturnValue({ data: { Steps: [] } });
    (useProjectRunbooks as jest.Mock).mockReturnValue({ data: [] });
    (useProjectVariables as jest.Mock).mockReturnValue({ data: { Variables: [] } });
    mockUseProjectChannels.mockReturnValue({
      data: [
        // Inherits the project lifecycle
        { Id: 'Channels-1', Name: 'Default Channel', IsDefault: true, LifecycleId: null },
        // Uses the same lifecycle explicitly (no override)
        { Id: 'Channels-2', Name: 'Hotfix Channel', IsDefault: false, LifecycleId: 'Lifecycles-1' },
      ],
    });
    (useEnvironments as jest.Mock).mockReturnValue({
      data: [{ Id: 'Environments-1', Name: 'Production' }],
      refetch: jest.fn(),
    });
    mockUseLifecycle.mockReturnValue({
      data: {
        Id: 'Lifecycles-1',
        Name: 'Default Lifecycle',
        Phases: [],
        ReleaseRetentionPolicy: { ShouldKeepForever: true },
        TentacleRetentionPolicy: { ShouldKeepForever: false, QuantityToKeep: 3, Unit: 'Items' },
      },
      isLoading: false,
      refetch: jest.fn(),
    });
    (useTenants as jest.Mock).mockReturnValue({ data: undefined });
    (useCreateDeployment as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    });
    mockUseKubernetesLiveStatus.mockImplementation(
      (_projectId: string, envId?: string) =>
        envId === 'Environments-1'
          ? { data: k8sStatus, isLoading: false }
          : { data: undefined, isLoading: false }
    );
  });

  it('renders the project header including the description', () => {
    render(<ProjectDetailScreen />);

    expect(screen.getByText('Web App')).toBeTruthy();
    expect(screen.getByText('A demo project for the mobile app')).toBeTruthy();
    expect(screen.getByText('Active')).toBeTruthy();
  });

  it('does not render a description line when the project has none', () => {
    mockUseProject.mockReturnValue({
      data: { ...project, Description: '' },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<ProjectDetailScreen />);

    expect(screen.getByText('Web App')).toBeTruthy();
    expect(screen.queryByText('A demo project for the mobile app')).toBeNull();
  });

  it('shows the lifecycle name for channels when the channels section is expanded', () => {
    render(<ProjectDetailScreen />);

    fireEvent.press(screen.getByText('Channels'));

    expect(screen.getByText('Default Channel')).toBeTruthy();
    expect(screen.getByText('Hotfix Channel')).toBeTruthy();
    // Channel without its own LifecycleId inherits the project lifecycle
    expect(screen.getByText('Default Lifecycle (inherited)')).toBeTruthy();
    // Channel with an explicit LifecycleId shows the lifecycle name only
    expect(screen.getByText('Default Lifecycle')).toBeTruthy();
  });

  it('shows Kubernetes resource namespaces only when present', () => {
    render(<ProjectDetailScreen />);

    // K8s live status badge for the environment; the badge handler calls
    // e.stopPropagation(), so provide an event payload.
    fireEvent.press(screen.getByText('Healthy'), { stopPropagation: () => {} });

    expect(screen.getByText('Production - Live Status')).toBeTruthy();
    expect(screen.getByText('web-deployment')).toBeTruthy();
    expect(screen.getByText('web-service')).toBeTruthy();
    // Only the resource with a namespace renders the namespace line
    expect(screen.getByText('Namespace: production')).toBeTruthy();
    expect(screen.queryAllByText(/^Namespace:/)).toHaveLength(1);
  });

  it('renders the deployments grid with the release version', () => {
    render(<ProjectDetailScreen />);

    expect(screen.getByText('Deployments')).toBeTruthy();
    expect(screen.getAllByText('1.0.0').length).toBeGreaterThan(0);
  });

  it('shows the loading screen while the project loads', () => {
    mockUseProject.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    });

    render(<ProjectDetailScreen />);

    expect(screen.getByText('Loading project...')).toBeTruthy();
  });

  it('shows an error view when the project fails to load', () => {
    mockUseProject.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { message: 'Project unavailable' },
      refetch: jest.fn(),
    });

    render(<ProjectDetailScreen />);

    expect(screen.getByText('Project unavailable')).toBeTruthy();
  });
});
