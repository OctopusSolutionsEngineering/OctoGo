/**
 * Tests for the Project detail screen
 * Covers the `!!project.Description` header branch, the channels section
 * (collapsed channelLifecycleName ternary) and the `!!resource.Namespace`
 * row in the Kubernetes live status modal, both ways.
 */

import React from 'react';
import { Alert, Modal, RefreshControl } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';

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
  // Render headerRight so the favorite toggle in the header is testable
  Stack: {
    Screen: ({ options }: { options?: { headerRight?: () => React.ReactNode } }) =>
      options?.headerRight ? options.headerRight() : null,
  },
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

  it('shows a not-found error when the project is missing without an error', () => {
    mockUseProject.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<ProjectDetailScreen />);

    expect(screen.getByText('Project not found')).toBeTruthy();
  });

  it('toggles the favorite from the header button', () => {
    const toggleFavorite = jest.fn();
    (useFavorites as jest.Mock).mockReturnValue({
      isFavorite: jest.fn().mockReturnValue(true),
      toggleFavorite,
    });

    render(<ProjectDetailScreen />);

    // isFavorite -> filled star icon
    fireEvent.press(screen.getByText('star'));

    expect(toggleFavorite).toHaveBeenCalledWith('Projects-1');
  });

  it('collapses an expanded section when its header is pressed', () => {
    render(<ProjectDetailScreen />);

    expect(screen.getByText('Current Versions')).toBeTruthy();

    fireEvent.press(screen.getByText('Dashboard'));
    expect(screen.queryByText('Current Versions')).toBeNull();

    fireEvent.press(screen.getByText('Dashboard'));
    expect(screen.getByText('Current Versions')).toBeTruthy();
  });

  it('refetches all project data on pull to refresh', () => {
    const refetchProject = jest.fn();
    const refetchEnvironments = jest.fn();
    mockUseProject.mockReturnValue({
      data: project,
      isLoading: false,
      error: null,
      refetch: refetchProject,
    });
    (useEnvironments as jest.Mock).mockReturnValue({
      data: [{ Id: 'Environments-1', Name: 'Production' }],
      refetch: refetchEnvironments,
    });

    render(<ProjectDetailScreen />);

    fireEvent(screen.UNSAFE_getByType(RefreshControl), 'refresh');

    expect(refetchProject).toHaveBeenCalled();
    expect(refetchEnvironments).toHaveBeenCalled();
  });

  describe('environment filtering by lifecycle', () => {
    const summaryWithEnvs = {
      Environments: [
        { Id: 'Environments-1', Name: 'Production' },
        { Id: 'Environments-2', Name: 'Staging' },
        { Id: 'Environments-3', Name: 'UAT' },
      ],
      Items: [dashboardItem],
    };

    it('filters the grid to environments present in the lifecycle phases', () => {
      mockUseProjectSummary.mockReturnValue({
        data: summaryWithEnvs,
        isLoading: false,
        refetch: jest.fn(),
      });
      mockUseLifecycle.mockReturnValue({
        data: {
          Id: 'Lifecycles-1',
          Name: 'Default Lifecycle',
          Phases: [
            {
              Id: 'Phases-1',
              Name: 'Rollout',
              AutomaticDeploymentTargets: ['Environments-1'],
              OptionalDeploymentTargets: ['Environments-2'],
              MinimumEnvironmentsBeforePromotion: 0,
              IsOptionalPhase: false,
            },
          ],
          ReleaseRetentionPolicy: { ShouldKeepForever: true },
          TentacleRetentionPolicy: { ShouldKeepForever: false, QuantityToKeep: 3, Unit: 'Items' },
        },
        isLoading: false,
        refetch: jest.fn(),
      });

      render(<ProjectDetailScreen />);

      expect(screen.getByText('PRODUCTION')).toBeTruthy();
      expect(screen.getByText('STAGING')).toBeTruthy();
      expect(screen.queryByText('UAT')).toBeNull();
    });

    it('shows all summary environments when phases define no explicit targets', () => {
      mockUseProjectSummary.mockReturnValue({
        data: summaryWithEnvs,
        isLoading: false,
        refetch: jest.fn(),
      });
      mockUseLifecycle.mockReturnValue({
        data: {
          Id: 'Lifecycles-1',
          Name: 'Default Lifecycle',
          Phases: [{ Id: 'Phases-1', Name: 'Implicit', MinimumEnvironmentsBeforePromotion: 0 }],
        },
        isLoading: false,
        refetch: jest.fn(),
      });

      render(<ProjectDetailScreen />);

      // 'UAT' appears in both the Current Versions row and the grid header
      expect(screen.getAllByText('UAT').length).toBeGreaterThan(0);
    });

    it('shows all summary environments while the lifecycle has not loaded', () => {
      mockUseProjectSummary.mockReturnValue({
        data: summaryWithEnvs,
        isLoading: false,
        refetch: jest.fn(),
      });
      mockUseLifecycle.mockReturnValue({
        data: { Id: 'Lifecycles-1', Name: 'Default Lifecycle' },
        isLoading: false,
        refetch: jest.fn(),
      });

      render(<ProjectDetailScreen />);

      expect(screen.getAllByText('UAT').length).toBeGreaterThan(0);
    });

    it('falls back to all summary environments when lifecycle filtering removes everything', () => {
      mockUseProjectSummary.mockReturnValue({
        data: summaryWithEnvs,
        isLoading: false,
        refetch: jest.fn(),
      });
      mockUseLifecycle.mockReturnValue({
        data: {
          Id: 'Lifecycles-1',
          Name: 'Default Lifecycle',
          Phases: [
            {
              Id: 'Phases-1',
              Name: 'Elsewhere',
              AutomaticDeploymentTargets: ['Environments-99'],
              MinimumEnvironmentsBeforePromotion: 0,
            },
          ],
        },
        isLoading: false,
        refetch: jest.fn(),
      });

      render(<ProjectDetailScreen />);

      expect(screen.getAllByText('UAT').length).toBeGreaterThan(0);
    });

    it('shows all environments when a channel overrides the project lifecycle', () => {
      mockUseProjectSummary.mockReturnValue({
        data: summaryWithEnvs,
        isLoading: false,
        refetch: jest.fn(),
      });
      mockUseProjectChannels.mockReturnValue({
        data: [
          { Id: 'Channels-1', Name: 'Default Channel', IsDefault: true, LifecycleId: 'Lifecycles-2' },
        ],
      });

      render(<ProjectDetailScreen />);

      expect(screen.getAllByText('UAT').length).toBeGreaterThan(0);
    });

    it('uses all environments in the space when the summary has none', () => {
      mockUseProjectSummary.mockReturnValue({
        data: { Environments: [], Items: [] },
        isLoading: false,
        refetch: jest.fn(),
      });
      (useEnvironments as jest.Mock).mockReturnValue({
        data: [
          { Id: 'Environments-1', Name: 'Production' },
          { Id: 'Environments-2', Name: 'Staging' },
        ],
        refetch: jest.fn(),
      });

      render(<ProjectDetailScreen />);

      // Empty-set lifecycle ids -> unfiltered fallback list
      expect(screen.getByText('PRODUCTION')).toBeTruthy();
      expect(screen.getByText('STAGING')).toBeTruthy();
    });

    it('filters the space-wide environment fallback by the lifecycle', () => {
      mockUseProjectSummary.mockReturnValue({
        data: { Environments: [], Items: [] },
        isLoading: false,
        refetch: jest.fn(),
      });
      (useEnvironments as jest.Mock).mockReturnValue({
        data: [
          { Id: 'Environments-1', Name: 'Production' },
          { Id: 'Environments-2', Name: 'Staging' },
        ],
        refetch: jest.fn(),
      });
      mockUseLifecycle.mockReturnValue({
        data: {
          Id: 'Lifecycles-1',
          Name: 'Default Lifecycle',
          Phases: [
            {
              Id: 'Phases-1',
              Name: 'Prod only',
              AutomaticDeploymentTargets: ['Environments-1'],
              MinimumEnvironmentsBeforePromotion: 0,
            },
          ],
        },
        isLoading: false,
        refetch: jest.fn(),
      });

      render(<ProjectDetailScreen />);

      expect(screen.getByText('PRODUCTION')).toBeTruthy();
      expect(screen.queryByText('STAGING')).toBeNull();
    });
  });

  describe('deployments grid states', () => {
    it('shows a loading message while the dashboard loads', () => {
      mockUseProjectSummary.mockReturnValue({
        data: undefined,
        isLoading: true,
        refetch: jest.fn(),
      });

      render(<ProjectDetailScreen />);

      expect(screen.getByText('Loading dashboard...')).toBeTruthy();
    });

    it('shows a message when no environments are configured', () => {
      mockUseProjectSummary.mockReturnValue({
        data: { Environments: [], Items: [] },
        isLoading: false,
        refetch: jest.fn(),
      });
      (useEnvironments as jest.Mock).mockReturnValue({ data: undefined, refetch: jest.fn() });

      render(<ProjectDetailScreen />);

      expect(screen.getByText('No environments configured')).toBeTruthy();
    });

    it('shows an empty state when there are no releases', () => {
      (useReleases as jest.Mock).mockReturnValue({ data: { Items: [] }, refetch: jest.fn() });

      render(<ProjectDetailScreen />);

      expect(screen.getByText('No releases')).toBeTruthy();
    });

    it('renders per-state colors, active deployments and navigates from cells', () => {
      const envs = [
        { Id: 'Environments-1', Name: 'Production' },
        { Id: 'Environments-2', Name: 'Staging' },
        { Id: 'Environments-3', Name: 'UAT' },
        { Id: 'Environments-4', Name: 'Dev' },
        { Id: 'Environments-5', Name: 'Test' },
      ];
      const makeItem = (envNum: number, state: string) => ({
        ...dashboardItem,
        Id: `di-${envNum}`,
        EnvironmentId: `Environments-${envNum}`,
        DeploymentId: `Deployments-${envNum}`,
        State: state,
      });
      mockUseProjectSummary.mockReturnValue({
        data: {
          Environments: envs,
          Items: [
            makeItem(1, 'Success'),
            makeItem(2, 'Executing'),
            makeItem(3, 'Failed'),
            makeItem(4, 'Canceled'),
            makeItem(5, 'Mystery'),
          ],
        },
        isLoading: false,
        refetch: jest.fn(),
      });
      (useDeployments as jest.Mock).mockReturnValue({
        data: {
          Items: envs.map((env, i) => ({
            Id: `Deployments-${i + 1}`,
            ReleaseId: 'Releases-1',
            EnvironmentId: env.Id,
            Created: dashboardItem.Created,
            Name: `Deploy ${i + 1}`,
          })),
          TotalResults: 5,
        },
        refetch: jest.fn(),
        isFetching: false,
      });

      render(<ProjectDetailScreen />);

      // Active deployment badge for the Executing environment
      expect(screen.getByText(/^Deploying/)).toBeTruthy();

      // Failed grid cell renders the close-circle icon; pressing the cell
      // navigates to that deployment
      fireEvent.press(screen.getByText('close-circle'));
      expect(mockPush).toHaveBeenCalledWith('/deployment/Deployments-3');

      // Pressing a Current Versions cell navigates to its latest deployment
      fireEvent.press(screen.getByText('Production'));
      expect(mockPush).toHaveBeenCalledWith('/deployment/Deployments-1');
    });

    it('expands and collapses the full release list', () => {
      (useReleases as jest.Mock).mockReturnValue({
        data: {
          Items: [1, 2, 3, 4, 5, 6].map((n) => ({
            Id: `Releases-${n}`,
            Version: `${n}.0.0`,
            ProjectId: 'Projects-1',
          })),
        },
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
          TotalResults: 50,
        },
        refetch: jest.fn(),
        isFetching: false,
      });

      render(<ProjectDetailScreen />);

      expect(screen.queryByText('6.0.0')).toBeNull();

      fireEvent.press(screen.getByText('Show All Releases (6)'));
      expect(screen.getByText('6.0.0')).toBeTruthy();
      expect(screen.getByText('Showing 1 of 50 total deployments')).toBeTruthy();

      fireEvent.press(screen.getByText('Show Less'));
      expect(screen.queryByText('6.0.0')).toBeNull();
    });
  });

  describe('deploy modal', () => {
    const setupEmptyStagingCell = () => {
      mockUseProjectSummary.mockReturnValue({
        data: {
          Environments: [
            { Id: 'Environments-1', Name: 'Production' },
            { Id: 'Environments-2', Name: 'Staging' },
          ],
          Items: [dashboardItem],
        },
        isLoading: false,
        refetch: jest.fn(),
      });
    };

    it('deploys a release from an empty cell and offers to view the task', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const mutateAsync = jest.fn().mockResolvedValue({ TaskId: 'ServerTasks-9' });
      (useCreateDeployment as jest.Mock).mockReturnValue({ mutateAsync, isPending: false });
      setupEmptyStagingCell();

      render(<ProjectDetailScreen />);

      // Empty Staging cell shows the small deploy button
      fireEvent.press(screen.getByText('add-circle-outline'));

      expect(screen.getByText('Deploy Release')).toBeTruthy();
      expect(screen.getByText('Target Environment')).toBeTruthy();

      fireEvent.press(screen.getByText('Deploy Now'));

      await waitFor(() => {
        expect(mutateAsync).toHaveBeenCalledWith({
          releaseId: 'Releases-1',
          environmentId: 'Environments-2',
        });
        expect(alertSpy).toHaveBeenCalledWith(
          'Deployment Started',
          '1.0.0 is being deployed to Staging',
          expect.any(Array)
        );
      });

      // Invoke the "View Task" alert button
      const buttons = alertSpy.mock.calls[0][2] as Array<{ text: string; onPress?: () => void }>;
      buttons.find((b) => b.text === 'View Task')?.onPress?.();
      expect(mockPush).toHaveBeenCalledWith('/task/ServerTasks-9');
    });

    it('alerts when the deployment fails to start and supports cancel/close', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const mutateAsync = jest.fn().mockRejectedValue(new Error('boom'));
      (useCreateDeployment as jest.Mock).mockReturnValue({ mutateAsync, isPending: false });
      setupEmptyStagingCell();

      render(<ProjectDetailScreen />);

      // Open then cancel
      fireEvent.press(screen.getByText('add-circle-outline'));
      fireEvent.press(screen.getByText('Cancel'));
      expect(screen.queryByText('Deploy Now')).toBeNull();

      // Open then close via the X button
      fireEvent.press(screen.getByText('add-circle-outline'));
      fireEvent.press(screen.getByText('close'));
      expect(screen.queryByText('Deploy Now')).toBeNull();

      // Open then close via the hardware back handler
      fireEvent.press(screen.getByText('add-circle-outline'));
      fireEvent(screen.UNSAFE_getAllByType(Modal)[1], 'requestClose');
      expect(screen.queryByText('Deploy Now')).toBeNull();

      // Open and confirm; deployment fails
      fireEvent.press(screen.getByText('add-circle-outline'));
      fireEvent.press(screen.getByText('Deploy Now'));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          'Deployment Failed',
          'Failed to start deployment. Please try again.'
        );
      });
    });
  });

  describe('kubernetes live status', () => {
    const makeK8s = (status: string, resources: unknown[] = []) => ({
      DeploymentId: 'Deployments-1',
      ApplicationStatus: status,
      ApplicationStatusMessage: null,
      Resources: resources,
      LastUpdated: new Date().toISOString(),
      IsAvailable: true,
    });

    const setupFiveEnvs = (statusByEnv: Record<string, ReturnType<typeof makeK8s>>) => {
      const envs = [
        { Id: 'Environments-1', Name: 'Production' },
        { Id: 'Environments-2', Name: 'Staging' },
        { Id: 'Environments-3', Name: 'UAT' },
        { Id: 'Environments-4', Name: 'Dev' },
        { Id: 'Environments-5', Name: 'Test' },
      ];
      mockUseProjectSummary.mockReturnValue({
        data: {
          Environments: envs,
          Items: envs.map((env, i) => ({
            ...dashboardItem,
            Id: `di-${i + 1}`,
            EnvironmentId: env.Id,
            DeploymentId: `Deployments-${i + 1}`,
          })),
        },
        isLoading: false,
        refetch: jest.fn(),
      });
      mockUseKubernetesLiveStatus.mockImplementation((_projectId: string, envId?: string) => ({
        data: envId ? statusByEnv[envId] : undefined,
        isLoading: false,
      }));
    };

    it('renders badges and modal details for degraded/progressing/out-of-sync/missing states', () => {
      const resources = [
        { Name: 'r-healthy', Kind: 'Deployment', Status: 'Healthy', Namespace: 'prod' },
        { Name: 'r-insync', Kind: 'Service', Status: 'InSync', Namespace: '' },
        { Name: 'r-progressing', Kind: 'Pod', Status: 'Progressing', Namespace: '' },
        { Name: 'r-degraded', Kind: 'Pod', Status: 'Degraded', Namespace: '' },
        { Name: 'r-outofsync', Kind: 'ConfigMap', Status: 'OutOfSync', Namespace: '' },
        { Name: 'r-missing', Kind: 'Secret', Status: 'Missing', Namespace: '' },
        { Name: 'r-suspended', Kind: 'CronJob', Status: 'Suspended', Namespace: '' },
        { Name: 'r-unknown', Kind: 'Job', Status: 'Unknown', Namespace: '' },
      ];
      setupFiveEnvs({
        'Environments-1': makeK8s('Healthy', resources),
        'Environments-2': makeK8s('Progressing'),
        'Environments-3': makeK8s('Degraded'),
        'Environments-4': makeK8s('OutOfSync'),
        'Environments-5': makeK8s('Missing'),
      });

      render(<ProjectDetailScreen />);

      expect(screen.getByText('Progressing')).toBeTruthy();
      expect(screen.getByText('Degraded')).toBeTruthy();

      // Out of Sync: open, then close via the hardware back handler
      fireEvent.press(screen.getByText('Out of Sync'), { stopPropagation: () => {} });
      expect(screen.getByText('Dev - Live Status')).toBeTruthy();
      fireEvent(screen.UNSAFE_getAllByType(Modal)[2], 'requestClose');
      expect(screen.queryByText('Dev - Live Status')).toBeNull();

      // Healthy env: shows every resource status label
      fireEvent.press(screen.getByText('Healthy'), { stopPropagation: () => {} });
      expect(screen.getByText('Production - Live Status')).toBeTruthy();
      expect(screen.getByText('In Sync')).toBeTruthy();
      expect(screen.getByText('Suspended')).toBeTruthy();
      expect(screen.getByText('r-unknown')).toBeTruthy();
      expect(screen.getByText('8 resources')).toBeTruthy();
      fireEvent.press(screen.getByText('Done'));
      expect(screen.queryByText('Production - Live Status')).toBeNull();

      // Missing env has no resources; close with the X button
      fireEvent.press(screen.getByText('Missing'), { stopPropagation: () => {} });
      expect(screen.getByText('No resources found')).toBeTruthy();
      expect(screen.getByText('0 resources')).toBeTruthy();
      fireEvent.press(screen.getByText('close'));
      expect(screen.queryByText('No resources found')).toBeNull();

      // Degraded env: covers the degraded icon branch in the modal
      fireEvent.press(screen.getByText('Degraded'), { stopPropagation: () => {} });
      expect(screen.getByText('UAT - Live Status')).toBeTruthy();
    });

    it('renders badges for waiting/unknown/unavailable states', () => {
      setupFiveEnvs({
        'Environments-1': makeK8s('Healthy'),
        'Environments-2': makeK8s('Waiting'),
        'Environments-3': makeK8s('Unknown'),
        'Environments-4': makeK8s('Unavailable'),
        'Environments-5': makeK8s('Progressing'),
      });

      render(<ProjectDetailScreen />);

      expect(screen.getByText('Unavailable')).toBeTruthy();

      fireEvent.press(screen.getByText('Waiting'), { stopPropagation: () => {} });
      expect(screen.getByText('Staging - Live Status')).toBeTruthy();
      fireEvent(screen.UNSAFE_getAllByType(Modal)[2], 'requestClose');

      fireEvent.press(screen.getByText('Unknown'), { stopPropagation: () => {} });
      expect(screen.getByText('UAT - Live Status')).toBeTruthy();
      fireEvent(screen.UNSAFE_getAllByType(Modal)[2], 'requestClose');

      fireEvent.press(screen.getByText('Unavailable'), { stopPropagation: () => {} });
      expect(screen.getByText('Dev - Live Status')).toBeTruthy();
    });
  });

  describe('runbooks section', () => {
    it('lists runbooks and navigates on press', () => {
      (useProjectRunbooks as jest.Mock).mockReturnValue({
        data: [
          { Id: 'Runbooks-1', Name: 'Restart App', Description: 'Restarts all services' },
          { Id: 'Runbooks-2', Name: 'Cleanup' },
        ],
      });

      render(<ProjectDetailScreen />);

      fireEvent.press(screen.getByText('Runbooks'));

      expect(screen.getByText('Restarts all services')).toBeTruthy();
      expect(screen.getByText('Cleanup')).toBeTruthy();

      fireEvent.press(screen.getByText('Restart App'));
      expect(mockPush).toHaveBeenCalledWith('/runbook/Runbooks-1');
    });
  });

  describe('variables section', () => {
    const makeVariables = () => {
      const vars = Array.from({ length: 17 }, (_, i) => ({
        Id: `Variables-${i + 1}`,
        Name: `var-${i + 1}`,
        Value: `value-${i + 1}`,
        IsSensitive: false,
      }));
      vars[0] = { ...vars[0], IsSensitive: true };
      vars[1] = { ...vars[1], Value: '' };
      // Duplicate name (scoped variable) is de-duplicated in the list
      vars.push({ Id: 'Variables-dup', Name: 'var-3', Value: 'other-scope', IsSensitive: false });
      return vars;
    };

    it('renders sensitive/empty values and paginates the list', () => {
      (useProjectVariables as jest.Mock).mockReturnValue({
        data: { Variables: makeVariables() },
      });

      render(<ProjectDetailScreen />);

      fireEvent.press(screen.getByText('Variables'));

      expect(screen.getByText('••••••')).toBeTruthy();
      expect(screen.getByText('(empty)')).toBeTruthy();
      // Duplicate name renders once
      expect(screen.getAllByText('var-3')).toHaveLength(1);
      expect(screen.queryByText('var-17')).toBeNull();

      fireEvent.press(screen.getByText('Show 2 more'));
      expect(screen.getByText('var-17')).toBeTruthy();

      fireEvent.press(screen.getByText('Show less'));
      expect(screen.queryByText('var-17')).toBeNull();
    });

    it('opens the variable modal on long press and copies name and value', async () => {
      (useProjectVariables as jest.Mock).mockReturnValue({
        data: { Variables: makeVariables() },
      });

      render(<ProjectDetailScreen />);

      fireEvent.press(screen.getByText('Variables'));
      fireEvent(screen.getByText('var-4'), 'longPress');

      expect(screen.getByText('Variable Details')).toBeTruthy();

      // Copy name, then copy value
      const copyButtons = screen.getAllByText('copy-outline');
      fireEvent.press(copyButtons[0]);
      fireEvent.press(copyButtons[1]);
      await waitFor(() => {
        expect(Clipboard.setStringAsync).toHaveBeenCalledWith('var-4');
        expect(Clipboard.setStringAsync).toHaveBeenCalledWith('value-4');
      });

      fireEvent.press(screen.getByText('Done'));
      expect(screen.queryByText('Variable Details')).toBeNull();

      // Sensitive variables hide their value in the modal
      fireEvent(screen.getByText('var-1'), 'longPress');
      expect(screen.getByText('Sensitive value hidden for security')).toBeTruthy();

      fireEvent(screen.UNSAFE_getAllByType(Modal)[0], 'requestClose');
      expect(screen.queryByText('Variable Details')).toBeNull();
    });
  });

  describe('empty sections', () => {
    it('shows empty states for runbooks, variables and channels', () => {
      (useProjectVariables as jest.Mock).mockReturnValue({ data: { Variables: [] } });
      mockUseProjectChannels.mockReturnValue({ data: undefined });

      render(<ProjectDetailScreen />);

      fireEvent.press(screen.getByText('Runbooks'));
      fireEvent.press(screen.getByText('Variables'));
      fireEvent.press(screen.getByText('Channels'));

      expect(screen.getByText('No runbooks')).toBeTruthy();
      expect(screen.getByText('No variables')).toBeTruthy();
      expect(screen.getByText('No channels')).toBeTruthy();
    });
  });

  describe('lifecycle modal', () => {
    it('opens from a channel row and shows phases, badges and retention', () => {
      mockUseLifecycle.mockReturnValue({
        data: {
          Id: 'Lifecycles-1',
          Name: 'Default Lifecycle',
          Description: 'Standard rollout',
          Phases: [
            {
              Id: 'Phases-1',
              Name: 'Rollout',
              AutomaticDeploymentTargets: ['Environments-1'],
              OptionalDeploymentTargets: ['Environments-2'],
              MinimumEnvironmentsBeforePromotion: 1,
              IsOptionalPhase: true,
            },
            {
              Id: 'Phases-2',
              Name: 'Verification',
              MinimumEnvironmentsBeforePromotion: 0,
              IsOptionalPhase: false,
            },
          ],
          ReleaseRetentionPolicy: { ShouldKeepForever: true },
          TentacleRetentionPolicy: { ShouldKeepForever: false, QuantityToKeep: 3, Unit: 'Items' },
        },
        isLoading: false,
        refetch: jest.fn(),
      });
      (useEnvironments as jest.Mock).mockReturnValue({
        data: [
          { Id: 'Environments-1', Name: 'Production' },
          { Id: 'Environments-2', Name: 'Staging' },
        ],
        refetch: jest.fn(),
      });

      render(<ProjectDetailScreen />);

      fireEvent.press(screen.getByText('Channels'));
      fireEvent.press(screen.getByText('Default Lifecycle (inherited)'));

      expect(screen.getByText('Standard rollout')).toBeTruthy();
      expect(screen.getByText('Rollout')).toBeTruthy();
      expect(screen.getByText('Verification')).toBeTruthy();
      expect(screen.getByText('Auto-deploy')).toBeTruthy();
      expect(screen.getByText('Manual')).toBeTruthy();
      expect(screen.getByText('Requires 1 environment before promotion')).toBeTruthy();
      expect(screen.getByText('Optional')).toBeTruthy();
      expect(screen.getByText('Releases: Keep forever')).toBeTruthy();
      expect(screen.getByText('Tentacle: Keep 3 items')).toBeTruthy();

      fireEvent.press(screen.getByText('Done'));
      expect(screen.queryByText('Standard rollout')).toBeNull();
    });

    it('shows the no-phases message and closes via the hardware back handler', () => {
      render(<ProjectDetailScreen />);

      fireEvent.press(screen.getByText('Channels'));
      fireEvent.press(screen.getByText('Default Lifecycle (inherited)'));

      expect(screen.getByText('No phases configured')).toBeTruthy();

      fireEvent(screen.UNSAFE_getAllByType(Modal)[3], 'requestClose');
      expect(screen.queryByText('No phases configured')).toBeNull();
    });

    it('shows the could-not-load message when the lifecycle is missing', () => {
      mockUseLifecycle.mockReturnValue({
        data: undefined,
        isLoading: false,
        refetch: jest.fn(),
      });

      render(<ProjectDetailScreen />);

      fireEvent.press(screen.getByText('Channels'));
      fireEvent.press(screen.getAllByText('Default Lifecycle (inherited)')[0]);

      expect(screen.getByText('Could not load lifecycle')).toBeTruthy();
    });
  });
});
